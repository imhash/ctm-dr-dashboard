/**
 * PhaseStepReport — workflow step detail modal
 *
 * Shows all CTM jobs (steps) within a single DR phase in chronological order.
 * Mimics CTM Workflow Monitor: steps numbered 1/N, progress bar, failure drill-down.
 * Log output is fetched via the authenticated API proxy and displayed inline.
 */

import { useState } from 'react'
import {
  X, CheckCircle2, XCircle, Clock, Loader2,
  FileText, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import { fetchJobOutput } from '../services/controlmApi'

const PHASE_LABELS = {
  switchover: 'Switchover',
  switchback: 'Switchback',
  readiness:  'Readiness',
  failover:   'Failover',
  failback:   'Failback',
}

const PHASE_COLORS = {
  switchover: { accent: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30'    },
  switchback: { accent: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
  readiness:  { accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30'},
  failover:   { accent: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30' },
  failback:   { accent: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30'   },
}

function stepStatusIcon(status) {
  if (status === 'Ended OK')     return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
  if (status === 'Ended Not OK') return <XCircle      className="w-4 h-4 text-red-400 flex-shrink-0"   />
  if (status === 'Executing')    return <Loader2      className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
  return                                <Clock        className="w-4 h-4 text-slate-400 flex-shrink-0" />
}

function fmtElapsed(mins) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Inline log viewer (per-step) ──────────────────────────────────────────────

function LogPanel({ jobId, stepName }) {
  const t = useT()
  const [state, setState] = useState('idle')   // idle | loading | ok | error
  const [output, setOutput] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [open,   setOpen]   = useState(false)

  async function load() {
    if (state === 'loading') return
    if (state === 'ok') { setOpen((p) => !p); return }

    setState('loading')
    setOpen(true)
    try {
      const text = await fetchJobOutput(jobId)
      setOutput(text || '(empty output)')
      setState('ok')
    } catch (e) {
      setErrMsg(e.message)
      setState('error')
    }
  }

  return (
    <div>
      <button
        onClick={load}
        disabled={state === 'loading'}
        title="View CTM output log"
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
          state === 'error'
            ? 'border-red-500/40 text-red-400 bg-red-500/10'
            : `${t.border} ${t.textMuted} hover:opacity-80`
        } disabled:opacity-50`}
      >
        {state === 'loading'
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FileText className="w-3.5 h-3.5" />}
        {state === 'loading' ? 'Loading…'
          : state === 'error' ? 'Load failed'
          : open ? 'Hide Log'
          : 'View Log'}
        {state === 'ok' && (open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>

      {/* Log output panel */}
      {open && state === 'ok' && (
        <div className={`mt-2 rounded-lg border ${t.border} overflow-hidden`}>
          <div className={`flex items-center justify-between px-3 py-1.5 ${t.tableHead} border-b ${t.border}`}>
            <span className={`text-xs font-medium ${t.textMuted}`}>Output log — {stepName}</span>
            <button onClick={() => setOpen(false)} className={`${t.textFaint} hover:opacity-70`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <pre className={`text-xs font-mono p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto ${t.inner} ${t.textSub} leading-relaxed`}>
            {output}
          </pre>
        </div>
      )}

      {/* Error state */}
      {open && state === 'error' && (
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Could not load log: {errMsg}</span>
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function PhaseStepReport({ app, phase, phaseData, onClose }) {
  const t           = useT()
  const { fmtTime } = useSettings()

  const label   = PHASE_LABELS[phase] || phase
  const colors  = PHASE_COLORS[phase] || PHASE_COLORS.switchover
  const steps   = phaseData?.steps || []
  const total   = phaseData?.totalSteps     || steps.length
  const done    = phaseData?.completedSteps ?? steps.filter((s) => s.status === 'Ended OK').length
  const failed  = phaseData?.failedSteps    ?? steps.filter((s) => s.status === 'Ended Not OK').length
  const running = phaseData?.runningSteps   ?? steps.filter((s) => s.status === 'Executing').length

  const overallFail  = phaseData?.status === 'Ended Not OK'
  const overallRun   = phaseData?.status === 'Executing'
  const overallOk    = phaseData?.status === 'Ended OK'

  const progressPct  = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${t.card} ${t.border} overflow-hidden`}>

        {/* ── Header ── */}
        <div className={`flex-shrink-0 px-6 py-4 border-b ${t.border} ${colors.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${colors.border} ${colors.accent} ${colors.bg}`}>
                  {label}
                </span>
                <h2 className={`text-base font-semibold ${t.text}`}>{app}</h2>
                {overallOk   && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400"><CheckCircle2 className="w-3 h-3" />Completed</span>}
                {overallFail && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400"><XCircle className="w-3 h-3" />Failed</span>}
                {overallRun  && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />Running</span>}
              </div>

              <div className={`flex gap-4 mt-1.5 text-xs flex-wrap ${t.textMuted}`}>
                {phaseData?.startTimeISO && (
                  <span>Start: <span className={`font-mono ${t.textSub}`}>{fmtTime(phaseData.startTimeISO)}</span></span>
                )}
                {phaseData?.estEndISO && phaseData.hasSLA && (
                  <span>SLA deadline: <span className={`font-mono ${colors.accent}`}>{fmtTime(phaseData.estEndISO)}</span></span>
                )}
                {phaseData?.endTimeISO && (
                  <span>End: <span className={`font-mono ${t.textSub}`}>{fmtTime(phaseData.endTimeISO)}</span></span>
                )}
                {phaseData?.elapsedMins != null && (
                  <span>Duration: <span className={`font-mono ${t.textSub}`}>{fmtElapsed(phaseData.elapsedMins)}</span></span>
                )}
              </div>
            </div>

            <button onClick={onClose} className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80 flex-shrink-0`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={t.textMuted}>
                Workflow progress:
                <span className={`font-mono ml-1 font-semibold ${colors.accent}`}>{done}/{total} steps</span>
              </span>
              <div className="flex gap-3">
                {failed > 0  && <span className="text-red-400">{failed} failed</span>}
                {running > 0 && <span className="text-cyan-400">{running} running</span>}
                <span className={`font-mono ${colors.accent}`}>{progressPct}%</span>
              </div>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${t.inner} flex`}>
              <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
              {failed > 0 && (
                <div className="h-full bg-red-500" style={{ width: `${Math.round((failed / total) * 100)}%` }} />
              )}
            </div>
          </div>
        </div>

        {/* Failure banner */}
        {failed > 0 && (
          <div className="flex-shrink-0 px-6 py-2.5 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">
              <strong>{failed} step{failed > 1 ? 's' : ''} failed.</strong>
              {' '}Expand the log for each failed step to see the full CTM output.
            </p>
          </div>
        )}

        {/* ── Steps table ── */}
        <div className="flex-1 overflow-y-auto">
          {steps.length === 0 ? (
            <div className={`flex items-center justify-center h-32 text-sm ${t.textMuted}`}>
              No step data available for this phase.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[580px]">
              <thead className={`sticky top-0 ${t.tableHead} ${t.textMuted}`}>
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Job / Step Name</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">Start</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">End</th>
                  <th className="text-left px-4 py-2.5 font-medium w-16">Duration</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Log</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => {
                  const isOk   = step.status === 'Ended OK'
                  const isFail = step.status === 'Ended Not OK'
                  const isRun  = step.status === 'Executing'

                  return (
                    <>
                      <tr
                        key={step.jobId || i}
                        className={`border-t ${
                          isFail ? `border-red-500/30 bg-red-500/5`
                          : isRun ? `border-cyan-500/20 bg-cyan-500/5`
                          : t.border
                        } ${t.cardHover} transition-colors`}
                      >
                        {/* Step number */}
                        <td className={`px-4 py-3 font-mono font-bold text-sm ${
                          isFail ? 'text-red-400' :
                          isOk   ? 'text-green-400' :
                          isRun  ? 'text-cyan-400' :
                          t.textFaint
                        }`}>
                          {i + 1}/{total}
                        </td>

                        {/* Step name + icon */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {stepStatusIcon(step.status)}
                            <div className="min-w-0">
                              <p className={`font-medium leading-snug ${t.text}`}>{step.name}</p>
                              {step.folder && step.folder !== step.name && (
                                <p className={`text-xs font-mono mt-0.5 truncate ${t.textFaint}`}>{step.folder}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status pill */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                            isRun  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : isOk  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : isFail ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}>
                            {isRun && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />}
                            {step.status}
                          </span>
                        </td>

                        {/* Start */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {fmtTime(step.startTimeISO, { second: undefined }) || '—'}
                        </td>

                        {/* End */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {step.endTimeISO
                            ? fmtTime(step.endTimeISO, { second: undefined })
                            : isRun ? <span className="text-cyan-400/70 text-xs italic">Running…</span>
                            : '—'}
                        </td>

                        {/* Duration */}
                        <td className={`px-4 py-3 font-mono ${t.textMuted}`}>
                          {fmtElapsed(step.elapsedMins)}
                        </td>

                        {/* Log button (fetches via API proxy) */}
                        <td className="px-4 py-3">
                          {step.jobId
                            ? <LogPanel jobId={step.jobId} stepName={step.name} />
                            : <span className={`text-xs ${t.textFaint}`}>—</span>
                          }
                        </td>
                      </tr>

                      {/* Inline error detail for failed steps */}
                      {isFail && step.errorDetail && (
                        <tr key={`${step.jobId}-err`} className="bg-red-500/5 border-b border-red-500/20">
                          <td className="px-4 py-1" />
                          <td colSpan={6} className="px-4 pb-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-red-400 mb-0.5">Error detail (from CTM status)</p>
                                <p className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">
                                  {step.errorDetail}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-3 border-t ${t.border}`}>
          <p className={`text-xs ${t.textFaint}`}>
            {total} step{total !== 1 ? 's' : ''} · {phaseData?.folder || 'CTM Workflow'} · Log fetched via API proxy
          </p>
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
