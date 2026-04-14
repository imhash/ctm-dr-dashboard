/**
 * PhaseStepReport — workflow step detail modal
 *
 * Shows all CTM jobs (steps) within a single DR phase in chronological order.
 * Mimics CTM Workflow Monitor: steps numbered 1/N, progress bar, failure drill-down.
 *
 * Props:
 *   app       — application name
 *   phase     — 'switchover' | 'switchback' | 'readiness' | 'failover' | 'failback'
 *   phaseData — phase object from controlmApi (includes .steps[])
 *   onClose   — close handler
 */

import { X, CheckCircle2, XCircle, Clock, Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

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
  if (status === 'Ended OK')     return <CheckCircle2 className="w-4 h-4 text-green-400" />
  if (status === 'Ended Not OK') return <XCircle      className="w-4 h-4 text-red-400"   />
  if (status === 'Executing')    return <Loader2      className="w-4 h-4 text-cyan-400 animate-spin" />
  return                                <Clock        className="w-4 h-4 text-slate-400" />
}

function stepRowClass(status, t) {
  if (status === 'Ended Not OK') return `border-t border-red-500/30 bg-red-500/5`
  if (status === 'Executing')    return `border-t border-cyan-500/20 bg-cyan-500/5`
  if (status === 'Ended OK')     return `border-t ${t.border}`
  return `border-t ${t.border} opacity-70`
}

function fmtElapsed(mins) {
  if (mins == null) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

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

  const overallOk    = phaseData?.status === 'Ended OK'
  const overallFail  = phaseData?.status === 'Ended Not OK'
  const overallRun   = phaseData?.status === 'Executing'

  const progressPct  = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border ${t.card} ${t.border} overflow-hidden`}>

        {/* ── Header ── */}
        <div className={`flex-shrink-0 px-6 py-4 border-b ${t.border} ${colors.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${colors.border} ${colors.accent} ${colors.bg}`}>
                  {label}
                </span>
                <h2 className={`text-base font-semibold ${t.text}`}>{app}</h2>
                {overallOk   && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-green-500/40 bg-green-500/10 text-green-400"><CheckCircle2 className="w-3 h-3" />Completed</span>}
                {overallFail && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400"><XCircle className="w-3 h-3" />Failed</span>}
                {overallRun  && <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-400"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />Running</span>}
              </div>

              {/* Timing */}
              <div className={`flex gap-4 mt-1.5 text-xs ${t.textMuted}`}>
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

          {/* Progress bar: steps X / N */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={t.textMuted}>
                Workflow progress:
                <span className={`font-mono ml-1 font-semibold ${colors.accent}`}>{done}/{total} steps</span>
              </span>
              <div className="flex gap-3">
                {failed > 0  && <span className="text-red-400">   {failed} failed</span>}
                {running > 0 && <span className="text-cyan-400">{running} running</span>}
                <span className={`font-mono ${colors.accent}`}>{progressPct}%</span>
              </div>
            </div>
            <div className={`h-2 rounded-full overflow-hidden ${t.inner}`}>
              {/* Completed (green) */}
              <div className="h-full flex">
                <div
                  className="h-full bg-green-500 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
                {failed > 0 && (
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${Math.round((failed / total) * 100)}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Failure summary banner (if any failures) ── */}
        {failed > 0 && (
          <div className="flex-shrink-0 px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-400">
                {failed} step{failed > 1 ? 's' : ''} failed in this workflow
              </p>
              <p className="text-xs text-red-300/70 mt-0.5">
                Failed steps are highlighted below. Open the CTM output log for full error details.
              </p>
            </div>
          </div>
        )}

        {/* ── Steps table ── */}
        <div className="flex-1 overflow-y-auto">
          {steps.length === 0 ? (
            <div className={`flex items-center justify-center h-32 text-sm ${t.textMuted}`}>
              No step data available for this phase.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[600px]">
              <thead className={`sticky top-0 ${t.tableHead} ${t.textMuted}`}>
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-12">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Job / Step Name</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">Start</th>
                  <th className="text-left px-4 py-2.5 font-medium w-20">End</th>
                  <th className="text-left px-4 py-2.5 font-medium w-16">Duration</th>
                  <th className="text-left px-4 py-2.5 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <>
                    <tr key={step.jobId || i} className={stepRowClass(step.status, t)}>
                      {/* Step number */}
                      <td className={`px-4 py-2.5 font-mono font-semibold ${
                        step.status === 'Ended Not OK' ? 'text-red-400' :
                        step.status === 'Ended OK'     ? 'text-green-400' :
                        step.status === 'Executing'    ? 'text-cyan-400' :
                        t.textFaint
                      }`}>
                        {i + 1}/{total}
                      </td>

                      {/* Step name */}
                      <td className={`px-4 py-2.5`}>
                        <div className="flex items-center gap-2">
                          {stepStatusIcon(step.status)}
                          <div>
                            <p className={`font-medium ${t.text}`}>{step.name}</p>
                            {step.folder && step.folder !== step.name && (
                              <p className={`text-xs font-mono mt-0.5 ${t.textFaint}`}>{step.folder}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status pill */}
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
                          step.status === 'Executing'    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                          : step.status === 'Ended OK'   ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : step.status === 'Ended Not OK' ? 'bg-red-500/10 border-red-500/30 text-red-400'
                          : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                        }`}>
                          {step.status === 'Executing' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />
                          )}
                          {step.status}
                        </span>
                      </td>

                      {/* Start */}
                      <td className={`px-4 py-2.5 font-mono ${t.textMuted}`}>
                        {fmtTime(step.startTimeISO, { second: undefined }) || '—'}
                      </td>

                      {/* End */}
                      <td className={`px-4 py-2.5 font-mono ${t.textMuted}`}>
                        {step.endTimeISO
                          ? fmtTime(step.endTimeISO, { second: undefined })
                          : step.status === 'Executing' ? <span className="text-cyan-400/70 text-xs">Running…</span>
                          : '—'}
                      </td>

                      {/* Duration */}
                      <td className={`px-4 py-2.5 font-mono ${t.textMuted}`}>
                        {fmtElapsed(step.elapsedMins)}
                      </td>

                      {/* Log link */}
                      <td className="px-4 py-2.5">
                        {step.logURI && (
                          <a href={step.logURI} target="_blank" rel="noopener noreferrer"
                            title="View CTM output log"
                            className="text-blue-400 hover:text-blue-300">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>

                    {/* Error detail row */}
                    {step.errorDetail && (
                      <tr key={`${step.jobId}-err`} className="bg-red-500/5 border-b border-red-500/20">
                        <td className="px-4 py-1" />
                        <td colSpan={6} className="px-4 pb-2">
                          <div className="flex items-start gap-2 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-red-300 font-medium">Error detail</p>
                              <p className="text-xs text-red-300/70 mt-0.5 font-mono whitespace-pre-wrap break-all">
                                {step.errorDetail}
                              </p>
                              {step.logURI && (
                                <a href={step.logURI} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1">
                                  <ExternalLink className="w-3 h-3" />
                                  Open full output log in CTM
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={`flex-shrink-0 flex items-center justify-between px-6 py-3 border-t ${t.border}`}>
          <p className={`text-xs ${t.textFaint}`}>
            {total} step{total !== 1 ? 's' : ''} · {phaseData?.folder || 'CTM Workflow'}
          </p>
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
