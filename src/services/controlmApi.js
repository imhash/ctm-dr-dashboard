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

  // Build step records ordered chronologically
  const steps = jobs
    .map(buildStep)
    .sort((a, b) => {
      const ta = a.startTimeISO ? new Date(a.startTimeISO).getTime() : 0
      const tb = b.startTimeISO ? new Date(b.startTimeISO).getTime() : 0
      return ta - tb
    })

  // Aggregate step counts
  const totalSteps     = steps.length
  const completedSteps = steps.filter((s) => s.status === 'Ended OK').length
  const failedSteps    = steps.filter((s) => s.status === 'Ended Not OK').length
  const runningSteps   = steps.filter((s) => s.status === 'Executing').length

  // Derive overall phase status (worst-case wins)
  const overallStatus =
    failedSteps > 0  ? 'Ended Not OK'
    : runningSteps > 0 ? 'Executing'
    : completedSteps === totalSteps ? 'Ended OK'
    : jobs[0]?.status || 'Unknown'

  // Phase timing: use earliest start and latest end across all steps
  const starts = steps.map((s) => s.startTimeISO).filter(Boolean).sort()
  const ends   = steps.map((s) => s.endTimeISO).filter(Boolean).sort()
  const phaseStart = starts[0] ? new Date(starts[0]) : null
  const phaseEnd   = ends[ends.length - 1] ? new Date(ends[ends.length - 1]) : null

  // Representative folder/jobId (first step)
  const folder = steps[0]?.folder  || ''
  const jobId  = steps[0]?.jobId   || ''

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
  switchover: [],
  switchback: [],
  readiness:  [],
  failover:   [],
  failback:   [],
})

/**
 * @param {Array}  statuses   — raw CTM job status array
 * @param {object} slaConfig  — { switchover, switchback, failover, failback, readiness: no SLA, perApp: {...} }
 */
function rawJobsToDROperations(statuses, slaConfig = {}) {
  const drJobs = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase())
  )

  const byApp = {}
  for (const j of drJobs) {
    const app   = j.application || 'Unknown'
    const phase = (j.subApplication || '').toLowerCase()
    if (!byApp[app]) {
      byApp[app] = { app, server: j.ctm, ...EMPTY_BY_PHASE() }
    }
    byApp[app][phase].push(j)
  }

  return Object.values(byApp).map((entry) => {
    // Resolve SLA per app + phase
    function getSLA(phase) {
      if (phase === 'readiness') return null
      const perApp = slaConfig.perApp?.[entry.app]
      if (perApp?.[phase] != null) return Number(perApp[phase])
      if (slaConfig[phase] != null) return Number(slaConfig[phase])
      // Defaults
      if (phase === 'switchover' || phase === 'failover')  return 30
      if (phase === 'switchback' || phase === 'failback')  return 60
      return 30
    }

    const phases = {
      switchover: buildPhaseFromJobs(entry.switchover, 'switchover', getSLA('switchover')),
      switchback: buildPhaseFromJobs(entry.switchback, 'switchback', getSLA('switchback')),
      readiness:  buildPhaseFromJobs(entry.readiness,  'readiness',  null),
      failover:   buildPhaseFromJobs(entry.failover,   'failover',   getSLA('failover')),
      failback:   buildPhaseFromJobs(entry.failback,   'failback',   getSLA('failback')),
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
