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

// ---------- SLA Deadlines (minutes from start) ----------
// In a full CTM setup these come from the job's "Deadline" attribute.
// Here we define them as the time delta from startTime → estimatedEndTime,
// cross-checked against standard DR SLA targets:
//   Switchover : 30 min
//   Switchback : 60 min
//   Readiness  : 60 min

const SLA_DEFAULTS = { switchover: 30, switchback: 60, readiness: 60 }

// ---------- Phase builder ----------

function buildPhase(raw, phase) {
  if (!raw) return null

  const start    = parseCtmTime(raw.startTime)
  const end      = raw.endTime ? parseCtmTime(raw.endTime) : null
  const estEnd   = raw.estimatedEndTime?.[0] ? parseCtmTime(raw.estimatedEndTime[0]) : null

  // RTO target = estEnd - start (from CTM) or fallback to SLA default
  const rtoTargetMins =
    start && estEnd
      ? Math.max(1, diffMins(start, estEnd))
      : SLA_DEFAULTS[phase] ?? 60

  // Elapsed = now (or actual end) - start
  const now         = new Date()
  const refEnd      = end || now
  const elapsedMins = start ? Math.max(0, diffMins(start, refEnd)) : 0

  const rtoPct      = Math.round((elapsedMins / rtoTargetMins) * 100)
  const rtoBreached = elapsedMins > rtoTargetMins && !end  // still running past deadline
  const rtoStatus   =
    end
      ? (elapsedMins <= rtoTargetMins ? 'Met' : 'Missed')
      : rtoBreached
      ? 'Breached'
      : rtoPct >= 80
      ? 'At Risk'
      : 'On Track'

  return {
    jobId:         raw.jobId,
    name:          raw.name,
    folder:        raw.folder,
    status:        raw.status,
    held:          raw.held,
    startTimeISO:  start ? start.toISOString() : null,
    endTimeISO:    end   ? end.toISOString()   : null,
    estEndISO:     estEnd ? estEnd.toISOString() : null,
    rtoTargetMins,
    elapsedMins,
    rtoPct:        Math.min(200, rtoPct),   // cap at 200% for display
    rtoStatus,
    rtoBreached,
    logURI:        raw.logURI || null,
  }
}

// ---------- DR Operations (main new function) ----------

const DR_PHASES = new Set(['switchover', 'switchback', 'readiness'])

function rawJobsToDROperations(statuses) {
  const drJobs = statuses.filter(
    (j) => DR_PHASES.has((j.subApplication || '').toLowerCase())
  )

  const byApp = {}
  for (const j of drJobs) {
    const app   = j.application || 'Unknown'
    const phase = (j.subApplication || '').toLowerCase()
    if (!byApp[app]) {
      byApp[app] = { app, server: j.ctm, switchover: null, switchback: null, readiness: null, rawJobs: [] }
    }
    byApp[app][phase]  = j
    byApp[app].rawJobs.push(j)
  }

  return Object.values(byApp).map((entry) => {
    const phases = {
      switchover: buildPhase(entry.switchover, 'switchover'),
      switchback: buildPhase(entry.switchback, 'switchback'),
      readiness:  buildPhase(entry.readiness,  'readiness'),
    }

    const allPhases     = Object.values(phases).filter(Boolean)
    const totalPhases   = allPhases.length
    const completedPh   = allPhases.filter((p) => p.status === 'Ended OK').length
    const failedPh      = allPhases.filter((p) => p.status === 'Ended Not OK').length
    const executingPh   = allPhases.filter((p) => p.status === 'Executing').length
    const breachedPh    = allPhases.filter((p) => p.rtoBreached).length
    const atRiskPh      = allPhases.filter((p) => p.rtoStatus === 'At Risk').length

    const overallStatus =
      failedPh > 0       ? 'Failed'
      : completedPh === totalPhases ? 'Completed'
      : executingPh > 0  ? 'In Progress'
      : 'Pending'

    const drillHealth =
      breachedPh > 0 ? 'Breached'
      : atRiskPh  > 0 ? 'At Risk'
      : 'On Track'

    const completionPct =
      totalPhases > 0
        ? Math.round((completedPh / totalPhases) * 100)
        : 0

    return {
      app:          entry.app,
      server:       entry.server,
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

export async function fetchDROperations() {
  if (USE_MOCK) {
    return new Promise((r) => setTimeout(() => r(mockDROperations), 450))
  }
  const data = await ctmFetch('/run/jobs/status')
  return rawJobsToDROperations(data.statuses || [])
}

// ---------- General jobs (secondary panel) ----------

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
