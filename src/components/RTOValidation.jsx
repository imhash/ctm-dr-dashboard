import { useState, useEffect } from 'react'
import { BarChart2, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { useT } from '../context/ThemeContext'

const RTO_COLORS = {
  'On Track': { bar: '#4ade80', text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  'At Risk':  { bar: '#fbbf24', text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30'  },
  'Breached': { bar: '#f87171', text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
  'Met':      { bar: '#4ade80', text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  'Missed':   { bar: '#f87171', text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
  'N/A':      { bar: '#475569', text: 'text-slate-500',  bg: 'bg-slate-800/50',  border: 'border-slate-700'     },
}

const PHASE_COLORS = {
  switchover: '#38bdf8',
  switchback: '#818cf8',
  readiness:  '#34d399',
}

function useLiveElapsed(startISO, isRunning) {
  const [mins, setMins] = useState(0)
  useEffect(() => {
    if (!startISO || !isRunning) return
    const t0 = new Date(startISO).getTime()
    const tick = () => setMins(Math.round((Date.now() - t0) / 60000))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [startISO, isRunning])
  return mins
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function RtoRow({ app, phase, data }) {
  const t = useT()
  const isRunning   = data?.status === 'Executing'
  const liveElapsed = useLiveElapsed(isRunning ? data?.startTimeISO : null, isRunning)

  if (!data) {
    return (
      <tr className={`border-t ${t.border} opacity-30`}>
        <td className={`px-4 py-2 text-xs ${t.textSub}`}>{app}</td>
        <td className="px-4 py-2">
          <span className={`text-xs px-2 py-0.5 rounded border border-dashed ${t.borderDash} ${t.textFaint} capitalize`}>{phase}</span>
        </td>
        <td colSpan={5} className={`px-4 py-2 text-xs italic ${t.textFaint}`}>Not configured for this application</td>
      </tr>
    )
  }

  const elapsed   = isRunning ? liveElapsed : data.elapsedMins
  const target    = data.rtoTargetMins
  const pct       = target > 0 ? Math.min(200, Math.round((elapsed / target) * 100)) : 0
  const rtoStatus =
    data.status === 'Ended OK'     ? (elapsed <= target ? 'Met' : 'Missed')
    : data.status === 'Ended Not OK' ? 'Missed'
    : pct >= 100 ? 'Breached'
    : pct >= 80  ? 'At Risk'
    : 'On Track'

  const c        = RTO_COLORS[rtoStatus] || RTO_COLORS['N/A']
  const barFill  = PHASE_COLORS[phase] || '#64748b'
  const overflow = pct > 100

  return (
    <tr className={`border-t ${t.border} ${t.cardHover} transition-colors`}>
      <td className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${t.text}`}>{app}</td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-0.5 rounded border capitalize font-medium"
          style={{ borderColor: barFill + '50', color: barFill, backgroundColor: barFill + '15' }}>
          {phase}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${
          data.status === 'Executing'    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          : data.status === 'Ended OK'   ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />}
          {data.status}
        </span>
      </td>
      <td className={`px-4 py-3 text-xs font-mono ${t.textMuted}`}>{fmt(data.startTimeISO)}</td>
      <td className={`px-4 py-3 text-xs font-mono whitespace-nowrap ${t.textSub}`}>
        {fmt(data.estEndISO)}<span className={`ml-1 ${t.textFaint}`}>(+{target}m)</span>
      </td>
      {/* RTO bar */}
      <td className="px-4 py-3 min-w-[180px]">
        <div className="flex flex-col gap-1">
          <div className="relative h-3 bg-slate-700/40 rounded overflow-hidden flex">
            <div className="h-full rounded transition-all duration-700"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barFill, opacity: 0.85 }} />
            {overflow && (
              <div className="h-full bg-red-500 animate-pulse"
                style={{ width: `${Math.min(pct - 100, 100)}%` }} />
            )}
            <div className="absolute right-0 top-0 h-full w-0.5 bg-white/20" title="SLA Deadline" />
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className={t.textFaint}>{elapsed}m</span>
            <span className={`font-semibold ${c.text}`}>{pct}%</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded border ${c.bg} ${c.border} ${c.text}`}>
          {rtoStatus === 'Met'      && <CheckCircle2 className="inline w-3 h-3 mr-1" />}
          {rtoStatus === 'Missed'   && <XCircle      className="inline w-3 h-3 mr-1" />}
          {rtoStatus === 'Breached' && <XCircle      className="inline w-3 h-3 mr-1" />}
          {rtoStatus === 'At Risk'  && <AlertTriangle className="inline w-3 h-3 mr-1" />}
          {rtoStatus === 'On Track' && <Clock         className="inline w-3 h-3 mr-1" />}
          {rtoStatus}
        </span>
      </td>
    </tr>
  )
}

function SummaryStrip({ operations }) {
  const allPhases = operations.flatMap(({ app, phases }) =>
    ['switchover', 'switchback', 'readiness'].map((ph) => ({ app, phase: ph, data: phases[ph] }))
  ).filter((r) => r.data)

  const on   = allPhases.filter((r) => r.data.rtoStatus === 'On Track').length
  const risk = allPhases.filter((r) => r.data.rtoStatus === 'At Risk').length
  const bad  = allPhases.filter((r) => ['Breached','Missed'].includes(r.data.rtoStatus)).length
  const met  = allPhases.filter((r) => r.data.rtoStatus === 'Met').length

  return (
    <div className="flex gap-4 flex-wrap">
      {[
        { label: 'On Track', v: on,   color: 'text-green-400', I: Clock         },
        { label: 'At Risk',  v: risk, color: 'text-amber-400', I: AlertTriangle },
        { label: 'Breached', v: bad,  color: 'text-red-400',   I: XCircle       },
        { label: 'SLA Met',  v: met,  color: 'text-green-400', I: CheckCircle2  },
      ].map(({ label, v, color, I }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          <I className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-slate-400">{label}:</span>
          <span className={`font-bold ${color}`}>{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function RTOValidation({ operations }) {
  const t = useT()
  if (!operations?.length) return null

  const rows = operations.flatMap(({ app, phases }) =>
    ['switchover', 'switchback', 'readiness'].map((ph) => ({ app, phase: ph, data: phases[ph] }))
  )

  return (
    <div className={`${t.card} border ${t.border} rounded-xl p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <h2 className={`text-sm font-semibold ${t.text}`}>RTO Validation</h2>
          </div>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
            Fixed SLA deadline vs actual elapsed time — per application &amp; phase
          </p>
        </div>
        <SummaryStrip operations={operations} />
      </div>

      {/* Phase colour legend */}
      <div className="flex gap-4 text-xs flex-wrap">
        {Object.entries(PHASE_COLORS).map(([ph, col]) => (
          <span key={ph} className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: col }} />
            <span className={`capitalize ${t.textMuted}`}>{ph}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-3">
          <span className="w-3 h-2 rounded-sm bg-red-500" />
          <span className={t.textMuted}>SLA breach overflow</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-0.5 h-3 bg-white/25" />
          <span className={t.textMuted}>Deadline marker</span>
        </span>
      </div>

      {/* Table */}
      <div className={`overflow-x-auto rounded-lg border ${t.border}`}>
        <table className="w-full text-xs min-w-[740px]">
          <thead className={`${t.tableHead} ${t.textMuted} sticky top-0`}>
            <tr>
              {['Application','Phase','Job Status','Start Time','SLA Deadline','RTO Progress','SLA Status'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ app, phase, data }) => (
              <RtoRow key={`${app}-${phase}`} app={app} phase={phase} data={data} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
