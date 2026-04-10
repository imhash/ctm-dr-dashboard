/**
 * Control-M Automation API Service
 *
 * Auth: x-api-key header (base64-encoded API key — no login step needed for SaaS)
 * CORS: Vite dev proxy at /ctm-api → se-preprod-aapi.us1.controlm.com
 *
 * Env vars (.env):
 *   VITE_CTM_API_URL  — proxy base path  (default: /ctm-api)
 *   VITE_CTM_API_KEY  — base64 API key
 *   VITE_USE_MOCK     — "true" to use local mock data
 *
 * SLA NOTE:
 *   - estimatedEndTime from CTM API is unreliable (often returns []).
 *   - SLA deadlines are computed as: startTime + user-configured SLA target (minutes).
 *   - Readiness phase has NO SLA — all RTO fields are null for readiness.
 *   - slaConfig is passed in from the app settings (useSettings hook).
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

function ctmIso(ts) {
  const dt = parseCtmTime(ts)
  return dt ? dt.toISOString() : null
}

function diffMins(a, b) {
  if (!a || !b) return null
  return Math.round((b.getTime() - a.getTime()) / 60000)
}

// ---------- Phase builder ----------
//
// slaTargetMins:
//   null  → Readiness phase (no SLA — skip all RTO calculations)
//   number → SLA deadline = startTime + slaTargetMins
//
// NOTE: estimatedEndTime from the CTM API is NOT used because it returns []
//       empty in the SaaS environment. The deadline is derived from user-configured SLA.

function buildPhase(raw, phase, slaTargetMins) {
  if (!raw) return null

  const start = parseCtmTime(raw.startTime)
  const end   = raw.endTime ? parseCtmTime(raw.endTime) : null
  const hasSLA = slaTargetMins != null && phase !== 'readiness'

  const now         = new Date()
  const refEnd      = end || now
  const elapsedMins = start ? Math.max(0, diffMins(start, refEnd)) : 0

  if (!hasSLA) {
    // Readiness: return phase data without any RTO metrics
    return {
      jobId:        raw.jobId,
      name:         raw.name,
      folder:       raw.folder,
      status:       raw.status,
      held:         raw.held,
      startTimeISO: start ? start.toISOString() : null,
      endTimeISO:   end   ? end.toISOString()   : null,
      estEndISO:    null,           // no deadline for readiness
      hasSLA:       false,
      rtoTargetMins:  null,
      elapsedMins,
      rtoPct:       null,
      rtoStatus:    'N/A',
      rtoBreached:  false,
      logURI:       raw.logURI || null,
    }
  }

  // SLA phase: compute deadline from startTime + slaTargetMins
  const rtoTargetMins = Number(slaTargetMins)
  const deadline      = start ? new Date(start.getTime() + rtoTargetMins * 60_000) : null

  const rtoPct      = rtoTargetMins > 0 ? Math.round((elapsedMins / rtoTargetMins) * 100) : 0
  const rtoBreached = !end && elapsedMins > rtoTargetMins   // still running past deadline
  const rtoStatus   =
    end
      ? (elapsedMins <= rtoTargetMins ? 'Met' : 'Missed')
      : rtoBreached
      ? 'Breached'
      : rtoPct >= 80
      ? 'At Risk'
      : 'On Track'

  return {
    jobId:        raw.jobId,
    name:         raw.name,
    folder:       raw.folder,
    status:       raw.status,
    held:         raw.held,
    startTimeISO: start    ? start.toISOString()    : null,
    endTimeISO:   end      ? end.toISOString()      : null,
    estEndISO:    deadline ? deadline.toISOString() : null,   // SLA deadline
    hasSLA:       true,
    rtoTargetMins,
    elapsedMins,
    rtoPct:       Math.min(200, rtoPct),
    rtoStatus,
    rtoBreached,
    logURI:       raw.logURI || null,
  }
}

// ---------- DR Operations ----------

const DR_PHASES = new Set(['switchover', 'switchback', 'readiness'])

/**
 * @param {Array}  statuses   — raw CTM job status array
 * @param {object} slaConfig  — { switchover: number, switchback: number, perApp: { [app]: { switchover, switchback } } }
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
      byApp[app] = { app, server: j.ctm, switchover: null, switchback: null, readiness: null }
    }
    byApp[app][phase] = j
  }

  return Object.values(byApp).map((entry) => {
    // Resolve SLA targets per app + phase (readiness always gets null)
    function getSLA(phase) {
      if (phase === 'readiness') return null
      const perApp = slaConfig.perApp?.[entry.app]
      if (perApp?.[phase] != null) return Number(perApp[phase])
      return slaConfig[phase] != null ? Number(slaConfig[phase]) : (phase === 'switchover' ? 30 : 60)
    }

    const phases = {
      switchover: buildPhase(entry.switchover, 'switchover', getSLA('switchover')),
      switchback: buildPhase(entry.switchback, 'switchback', getSLA('switchback')),
      readiness:  buildPhase(entry.readiness,  'readiness',  null),
    }

    const allPhases    = Object.values(phases).filter(Boolean)
    const totalPhases  = allPhases.length
    const completedPh  = allPhases.filter((p) => p.status === 'Ended OK').length
    const failedPh     = allPhases.filter((p) => p.status === 'Ended Not OK').length
    const executingPh  = allPhases.filter((p) => p.status === 'Executing').length

    // Health is only assessed on SLA phases (switchover + switchback)
    const slaPhases    = allPhases.filter((p) => p.hasSLA)
    const breachedPh   = slaPhases.filter((p) => p.rtoBreached).length
    const atRiskPh     = slaPhases.filter((p) => p.rtoStatus === 'At Risk').length

    const overallStatus =
      failedPh > 0                   ? 'Failed'
      : completedPh === totalPhases  ? 'Completed'
      : executingPh > 0              ? 'In Progress'
      : 'Pending'

    const drillHealth =
      breachedPh > 0 ? 'Breached'
      : atRiskPh > 0 ? 'At Risk'
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
    startTime: ctmIso(raw.startTime),
    endTime:   ctmIso(raw.endTime),
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
  const active   = jobs.filter((j) => j.status === 'Executing').length
  const ok       = jobs.filter((j) => j.status === 'Ended OK').length
  const failed   = jobs.filter((j) => j.status === 'Ended Not OK').length
  const waiting  = jobs.filter((j) => j.status.startsWith('Wait')).length
  const server   = jobs[0]?.server || 'IN01'
  return {
    prod: { ...mockEnvComparison.prod, label: 'Production (reference)' },
    dr: {
      label: 'Live — Control-M SaaS',
      servers: [server],
      status: 'Active',
      activeJobs: active,
      completedJobs: ok,
      failedJobs: failed,
      waitingJobs: waiting,
      agentsConnected: 9,
      agentsTotal: 10,
      lastSync: new Date().toISOString(),
      version: '9.21.x (SaaS)',
      uptime: 'Managed SaaS',
      avgJobDuration: '—',
      slaCompliance: jobs.length > 0 ? +((ok / jobs.length) * 100).toFixed(1) : 0,
    },
  }
}

export async function fetchAgents() {
  return new Promise((r) => setTimeout(() => r(mockAgents), 420))
}
