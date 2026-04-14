/**
 * Control-M Automation API Service
 *
 * Auth: x-api-key header (base64-encoded API key)
 * CORS: Vite dev proxy at /ctm-api → se-preprod-aapi.us1.controlm.com
 *
 * DR Phases (subApplication field values, case-insensitive):
 *   switchover, switchback, readiness, failover, failback
 *
 * SLA:
 *   - SLA deadline = startTime + user-configured minutes (estimatedEndTime is unreliable in SaaS)
 *   - Readiness has NO SLA
 *   - slaConfig passed in from useSettings hook
 *
 * Step tracking:
 *   - ALL jobs sharing the same app + subApplication are collected as "steps"
 *   - Ordered by start time ascending (chronological workflow order)
 *   - Step count displayed as completedSteps/totalSteps (e.g. 3/12)
 */

import {
  mockDROperations,
  mockJobs,
  mockEnvComparison,
  mockAgents,
} from '../data/mockData'

const BASE_URL = import.meta.env.VITE_CTM_API_URL || '/ctm-api'
const API_KEY  = import.meta.env.VITE_CTM_API_KEY  || ''
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ---------- Core fetch ----------

async function ctmFetch(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`CTM API ${res.status} — ${path}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ---------- Time helpers ----------

/** Control-M timestamps: "yyyyMMddHHmmss" → Date */
export function parseCtmTime(ts) {
  if (!ts || ts.length < 8) return null
  const y  = parseInt(ts.slice(0, 4),  10)
  const mo = parseInt(ts.slice(4, 6),  10) - 1
  const d  = parseInt(ts.slice(6, 8),  10)
  const h  = ts.length >= 10 ? parseInt(ts.slice(8,  10), 10) : 0
  const mi = ts.length >= 12 ? parseInt(ts.slice(10, 12), 10) : 0
  const s  = ts.length >= 14 ? parseInt(ts.slice(12, 14), 10) : 0
  const dt = new Date(y, mo, d, h, mi, s)
  return isNaN(dt.getTime()) ? null : dt
}

function diffMins(a, b) {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

// ---------- Job type helpers ----------

// CTM container/folder types — these are workflow wrappers, NOT executable steps.
// Individual job types (Job, Command, Script, OS, SAP, etc.) are the actual steps.
const FOLDER_TYPES = new Set([
  'folder', 'simplefolder', 'subfolder', 'smartfolder',
])

function isExecutableJob(raw) {
  const type = (raw.type || '').toLowerCase()
  // If no type info at all, check if the job name matches its own folder name
  // (folder entries typically have name === folder in CTM status response)
  if (!type) return raw.name !== raw.folder
  return !FOLDER_TYPES.has(type)
}

// ---------- Step builder ----------
// Converts a raw CTM job object into a step record (one row in PhaseStepReport)

function buildStep(raw) {
  const start = parseCtmTime(raw.startTime)
  const end   = raw.endTime ? parseCtmTime(raw.endTime) : null
  const now   = new Date()
  const elapsed = start ? Math.max(0, diffMins(start, end || now)) : 0

  // Extract error detail from available fields
  let errorDetail = null
  if (raw.status === 'Ended Not OK') {
    errorDetail = raw.held
      || raw.statusReason
      || raw.description
      || 'Job ended with errors — check CTM output log for details'
  }

  return {
    jobId:        raw.jobId,
    name:         raw.name,
    folder:       raw.folder,
    status:       raw.status,
    held:         raw.held  || null,
    startTimeISO: start ? start.toISOString() : null,
    endTimeISO:   end   ? end.toISOString()   : null,
    elapsedMins:  elapsed,
    logURI:       raw.logURI || null,
    errorDetail,
  }
}

// ---------- Phase builder ----------
//
// Accepts an ARRAY of raw CTM jobs belonging to the same app + phase.
// Returns a single phase object with step-level detail included.
//
// slaTargetMins:
//   null   → Readiness / no SLA phase — skip RTO calculations
//   number → SLA deadline = earliest startTime + slaTargetMins

function buildPhaseFromJobs(jobs, phase, slaTargetMins) {
  if (!jobs || jobs.length === 0) return null

  // Separate folder/container entries from actual executable jobs
  const folderEntries = jobs.filter((j) => !isExecutableJob(j))
  const execJobs      = jobs.filter(isExecutableJob)

  // Steps = only executable jobs; fall back to all if type info is absent
  const stepJobs = execJobs.length > 0 ? execJobs : jobs

  // Build step records ordered chronologically
  const steps = stepJobs
    .map(buildStep)
    .sort((a, b) => {
      const ta = a.startTimeISO ? new Date(a.startTimeISO).getTime() : 0
      const tb = b.startTimeISO ? new Date(b.startTimeISO).getTime() : 0
      return ta - tb
    })

  // Aggregate step counts (based on executable steps only)
  const totalSteps     = steps.length
  const completedSteps = steps.filter((s) => s.status === 'Ended OK').length
  const failedSteps    = steps.filter((s) => s.status === 'Ended Not OK').length
  const runningSteps   = steps.filter((s) => s.status === 'Executing').length

  // Overall phase status: worst-case across all jobs (folder entry may reflect overall)
  const allFailed  = jobs.some((j) => j.status === 'Ended Not OK')
  const anyRunning = jobs.some((j) => j.status === 'Executing')
  const allOk      = jobs.every((j) => j.status === 'Ended OK')
  const overallStatus =
    allFailed   ? 'Ended Not OK'
    : anyRunning ? 'Executing'
    : allOk      ? 'Ended OK'
    : jobs[0]?.status || 'Unknown'

  // Phase timing: use folder entry if available (it carries the full workflow window),
  // otherwise derive from individual step timings
  const folderJob = folderEntries[0]
  let phaseStart, phaseEnd

  if (folderJob?.startTime) {
    phaseStart = parseCtmTime(folderJob.startTime)
    phaseEnd   = folderJob.endTime ? parseCtmTime(folderJob.endTime) : null
  } else {
    const starts = steps.map((s) => s.startTimeISO).filter(Boolean).sort()
    const ends   = steps.map((s) => s.endTimeISO).filter(Boolean).sort()
    phaseStart = starts[0] ? new Date(starts[0]) : null
    phaseEnd   = ends[ends.length - 1] ? new Date(ends[ends.length - 1]) : null
  }

  // Folder name: prefer the folder entry's own name (= workflow folder name in CTM)
  const folder = folderJob?.name || folderJob?.folder || steps[0]?.folder || ''
  const jobId  = folderJob?.jobId || steps[0]?.jobId || ''

  const hasSLA      = slaTargetMins != null && phase !== 'readiness'
  const now         = new Date()
  const refEnd      = phaseEnd || now
  const elapsedMins = phaseStart ? Math.max(0, diffMins(phaseStart, refEnd)) : 0

  if (!hasSLA) {
    return {
      jobId, folder, status: overallStatus,
      startTimeISO: phaseStart ? phaseStart.toISOString() : null,
      endTimeISO:   phaseEnd   ? phaseEnd.toISOString()   : null,
      estEndISO:    null,
      hasSLA:       false,
      rtoTargetMins:  null,
      elapsedMins,
      rtoPct:       null,
      rtoStatus:    'N/A',
      rtoBreached:  false,
      steps,
      totalSteps,
      completedSteps,
      failedSteps,
      runningSteps,
    }
  }

  // SLA phase
  const rtoTargetMins = Number(slaTargetMins)
  const deadline      = phaseStart ? new Date(phaseStart.getTime() + rtoTargetMins * 60_000) : null
  const rtoPct        = rtoTargetMins > 0 ? Math.round((elapsedMins / rtoTargetMins) * 100) : 0
  const rtoBreached   = !phaseEnd && elapsedMins > rtoTargetMins
  const rtoStatus     =
    phaseEnd
      ? (elapsedMins <= rtoTargetMins ? 'Met' : 'Missed')
      : rtoBreached
      ? 'Breached'
      : rtoPct >= 80
      ? 'At Risk'
      : 'On Track'

  return {
    jobId, folder, status: overallStatus,
    startTimeISO: phaseStart ? phaseStart.toISOString() : null,
    endTimeISO:   phaseEnd   ? phaseEnd.toISOString()   : null,
    estEndISO:    deadline   ? deadline.toISOString()   : null,
    hasSLA:       true,
    rtoTargetMins,
    elapsedMins,
    rtoPct:       Math.min(200, rtoPct),
    rtoStatus,
    rtoBreached,
    steps,
    totalSteps,
    completedSteps,
    failedSteps,
    runningSteps,
  }
}

// ---------- DR Operations ----------

const DR_PHASES = new Set(['switchover', 'switchback', 'readiness', 'failover', 'failback'])

const EMPTY_BY_PHASE = () => ({
  switchover: { folder: null, steps: [] },
  switchback: { folder: null, steps: [] },
  readiness:  { folder: null, steps: [] },
  failover:   { folder: null, steps: [] },
  failback:   { folder: null, steps: [] },
})

/**
 * BFS traversal: collect ALL executable leaf jobs inside a CTM folder.
 *
 * CTM folder hierarchy can be many levels deep:
 *   DR Folder (subApplication=Switchover)
 *     └─ Sub-folder (e.g. mha-AI-Vsphere-SRM-Test)
 *          └─ Actual job
 *
 * The full status list is a flat array where each entry has a `folder` field
 * pointing to its direct parent. We BFS from `rootFolderName` collecting only
 * leaf-level executable jobs.
 *
 * @param {Map<string, Array>} childrenByFolder  - pre-built: folderName → [children]
 * @param {string}             rootFolderName
 * @returns {Array} executable job raw objects
 */
function collectLeafJobs(childrenByFolder, rootFolderName) {
  const result  = []
  const queue   = [rootFolderName]
  const visited = new Set()

  while (queue.length > 0) {
    const name = queue.shift()
    if (visited.has(name)) continue
    visited.add(name)

    const children = childrenByFolder.get(name) || []
    for (const child of children) {
      if (isExecutableJob(child)) {
        result.push(child)
      } else {
        // Sub-folder: recurse into it
        queue.push(child.name)
      }
    }
  }

  return result
}

/**
 * @param {Array}  statuses   — raw CTM job status array
 * @param {object} slaConfig  — { switchover, switchback, failover, failback, perApp: {...} }
 */
function rawJobsToDROperations(statuses, slaConfig = {}) {
  // ── Step 1: Build a parent→children map for the entire status list ──
  // childrenByFolder: folderName → [raw job objects whose .folder === folderName]
  const childrenByFolder = new Map()
  for (const j of statuses) {
    const parent = j.folder || ''
    if (!childrenByFolder.has(parent)) childrenByFolder.set(parent, [])
    childrenByFolder.get(parent).push(j)
  }

  // ── Step 2: Find all TOP-LEVEL DR folder entries (have a DR subApplication) ──
  // These are the workflow containers for each phase.
  // A folder entry is identified by: type in FOLDER_TYPES OR name === folder (self-referencing)
  // OR it's a direct entry with subApplication set at the folder level.
  const drFolderEntries = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase()) && !isExecutableJob(j)
  )

  // Also include executable jobs that directly have a DR subApplication
  // (in case the DR job is a single job without a folder wrapper)
  const drDirectJobs = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase()) && isExecutableJob(j)
  )

  const byApp = {}

  // Process folder-based phases
  for (const folderEntry of drFolderEntries) {
    const app   = folderEntry.application || 'Unknown'
    const phase = (folderEntry.subApplication || '').toLowerCase()
    if (!byApp[app]) byApp[app] = { app, server: folderEntry.ctm, ...EMPTY_BY_PHASE() }

    // Keep the most recent folder entry (in case of multiple runs)
    const existing = byApp[app][phase].folder
    if (!existing || (folderEntry.startTime || '') > (existing.startTime || '')) {
      byApp[app][phase].folder = folderEntry
    }

    // BFS from this folder to collect all leaf executable jobs
    const leafJobs = collectLeafJobs(childrenByFolder, folderEntry.name)
    byApp[app][phase].steps.push(...leafJobs)
  }

  // Process direct (non-folder) DR jobs — add as steps if not already collected
  for (const job of drDirectJobs) {
    const app   = job.application || 'Unknown'
    const phase = (job.subApplication || '').toLowerCase()
    if (!byApp[app]) byApp[app] = { app, server: job.ctm, ...EMPTY_BY_PHASE() }

    // Avoid duplicates (may already be captured as a leaf from a folder BFS)
    const alreadyHave = byApp[app][phase].steps.some((s) => s.jobId === job.jobId)
    if (!alreadyHave) byApp[app][phase].steps.push(job)
  }

  return Object.values(byApp).map((entry) => {
    // Resolve SLA per app + phase
    function getSLA(ph) {
      if (ph === 'readiness') return null
      const perApp = slaConfig.perApp?.[entry.app]
      if (perApp?.[ph] != null) return Number(perApp[ph])
      if (slaConfig[ph]  != null) return Number(slaConfig[ph])
      if (ph === 'switchover' || ph === 'failover')  return 30
      if (ph === 'switchback' || ph === 'failback')  return 60
      return 30
    }

    // Build a jobs array for each phase: [folderEntry?, ...leafSteps]
    // buildPhaseFromJobs expects the full list so it can separate folder vs steps
    function jobsForPhase(ph) {
      const { folder, steps } = entry[ph]
      if (!folder && steps.length === 0) return []
      return folder ? [folder, ...steps] : steps
    }

    const phases = {
      switchover: buildPhaseFromJobs(jobsForPhase('switchover'), 'switchover', getSLA('switchover')),
      switchback: buildPhaseFromJobs(jobsForPhase('switchback'), 'switchback', getSLA('switchback')),
      readiness:  buildPhaseFromJobs(jobsForPhase('readiness'),  'readiness',  null),
      failover:   buildPhaseFromJobs(jobsForPhase('failover'),   'failover',   getSLA('failover')),
      failback:   buildPhaseFromJobs(jobsForPhase('failback'),   'failback',   getSLA('failback')),
    }

    const allPhases   = Object.values(phases).filter(Boolean)
    const totalPhases = allPhases.length
    const completedPh = allPhases.filter((p) => p.status === 'Ended OK').length
    const failedPh    = allPhases.filter((p) => p.status === 'Ended Not OK').length
    const executingPh = allPhases.filter((p) => p.status === 'Executing').length

    // Health only from SLA phases
    const slaPhases   = allPhases.filter((p) => p.hasSLA)
    const breachedPh  = slaPhases.filter((p) => p.rtoBreached).length
    const atRiskPh    = slaPhases.filter((p) => p.rtoStatus === 'At Risk').length

    const overallStatus =
      failedPh > 0                   ? 'Failed'
      : completedPh === totalPhases  ? 'Completed'
      : executingPh > 0              ? 'In Progress'
      : 'Pending'

    const drillHealth =
      failedPh > 0   ? 'Failed'
      : breachedPh > 0 ? 'Breached'
      : atRiskPh > 0   ? 'At Risk'
      : 'On Track'

    const completionPct =
      totalPhases > 0 ? Math.round((completedPh / totalPhases) * 100) : 0

    return {
      app:             entry.app,
      server:          entry.server,
      phases,
      totalPhases,
      completedPhases: completedPh,
      failedPhases:    failedPh,
      executingPhases: executingPh,
      breachedPhases:  breachedPh,
      overallStatus,
      drillHealth,
      completionPct,
    }
  })
}

/**
 * @param {object} slaConfig — from useSettings().settings.sla
 */
export async function fetchDROperations(slaConfig = {}) {
  if (USE_MOCK) {
    return new Promise((r) => setTimeout(() => r(mockDROperations), 450))
  }
  const data = await ctmFetch('/run/jobs/status')
  return rawJobsToDROperations(data.statuses || [], slaConfig)
}

// ---------- General jobs ----------

function mapJob(raw) {
  return {
    id:        raw.jobId,
    name:      raw.name,
    folder:    raw.folder,
    server:    raw.ctm,
    status:    raw.status,
    held:      raw.held,
    cyclic:    raw.cyclic,
    type:      raw.type,
    host:      raw.host,
    app:       raw.application || '',
    subApp:    raw.subApplication || '',
    startTime: raw.startTime ? parseCtmTime(raw.startTime)?.toISOString() : null,
    endTime:   raw.endTime   ? parseCtmTime(raw.endTime)?.toISOString()   : null,
    logURI:    raw.logURI,
  }
}

export async function fetchJobs(limit = 500) {
  if (USE_MOCK) {
    return new Promise((r) => setTimeout(() => r(mockJobs), 400))
  }
  const data = await ctmFetch(`/run/jobs/status?limit=${limit}`)
  return (data.statuses || []).map(mapJob)
}

export async function fetchEnvComparison(jobs) {
  if (USE_MOCK) {
    return new Promise((r) => setTimeout(() => r(mockEnvComparison), 450))
  }
  const active  = jobs.filter((j) => j.status === 'Executing').length
  const ok      = jobs.filter((j) => j.status === 'Ended OK').length
  const failed  = jobs.filter((j) => j.status === 'Ended Not OK').length
  const server  = jobs[0]?.server || 'IN01'
  return {
    prod: { ...mockEnvComparison.prod, label: 'Production (reference)' },
    dr: {
      label:           'Live — Control-M SaaS',
      servers:         [server],
      status:          'Active',
      activeJobs:      active,
      completedJobs:   ok,
      failedJobs:      failed,
      waitingJobs:     0,
      agentsConnected: 9,
      agentsTotal:     10,
      lastSync:        new Date().toISOString(),
      version:         '9.21.x (SaaS)',
      uptime:          'Managed SaaS',
      avgJobDuration:  '—',
      slaCompliance:   jobs.length > 0 ? +((ok / jobs.length) * 100).toFixed(1) : 0,
    },
  }
}

export async function fetchAgents() {
  return new Promise((r) => setTimeout(() => r(mockAgents), 420))
}

/**
 * Fetch the output log for a specific job.
 * CTM endpoint: GET /run/job/{jobId}/output  (returns plain text)
 */
export async function fetchJobOutput(jobId) {
  if (!jobId) throw new Error('jobId is required')
  const res = await fetch(`${BASE_URL}/run/job/${encodeURIComponent(jobId)}/output`, {
    headers: { 'x-api-key': API_KEY },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || 'No output available'}`)
  }
  // CTM returns plain text for this endpoint
  return res.text()
}
