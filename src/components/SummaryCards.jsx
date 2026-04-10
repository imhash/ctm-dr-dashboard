import { Layers, ArrowRightLeft, ArrowLeftRight, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useT } from '../context/ThemeContext'

function StatCard({ icon: Icon, label, value, sub, color, border }) {
  const t = useT()
  return (
    <div className={`${t.card} border ${border} rounded-xl p-4 flex items-center gap-4`}>
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold leading-none ${t.text}`}>{value}</p>
        <p className={`text-xs mt-1 truncate ${t.textMuted}`}>{label}</p>
        {sub && <p className={`text-xs mt-0.5 truncate ${t.textFaint}`}>{sub}</p>}
      </div>
    </div>
  )
}

export default function SummaryCards({ operations }) {
  if (!operations?.length) return null

  const allPhases = operations.flatMap(({ phases }) =>
    ['switchover', 'switchback', 'readiness'].map((ph) => phases[ph]).filter(Boolean)
  )

  const apps        = operations.length
  const switchovers = operations.filter((o) => o.phases.switchover).length
  const switchbacks = operations.filter((o) => o.phases.switchback).length
  const readiness   = operations.filter((o) => o.phases.readiness).length
  const breached    = allPhases.filter((p) => ['Breached', 'Missed'].includes(p.rtoStatus)).length
  const atRisk      = allPhases.filter((p) => p.rtoStatus === 'At Risk').length
  const completed   = operations.filter((o) => o.overallStatus === 'Completed').length
  const totalPh     = operations.reduce((a, o) => a + o.totalPhases, 0)
  const donePh      = operations.reduce((a, o) => a + o.completedPhases, 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-6 py-4">
      <StatCard icon={Layers}        label="Applications in Drill"   value={apps}                    sub={`${completed} completed`}                 color="bg-blue-500/15 text-blue-400"    border="border-blue-500/20" />
      <StatCard icon={ArrowRightLeft} label="Switchovers"             value={switchovers}             sub="active phases"                            color="bg-sky-500/15 text-sky-400"      border="border-sky-500/20" />
      <StatCard icon={ArrowLeftRight} label="Switchbacks"             value={switchbacks}             sub="active phases"                            color="bg-violet-500/15 text-violet-400" border="border-violet-500/20" />
      <StatCard icon={ShieldCheck}    label="Readiness Checks"        value={readiness}               sub="active phases"                            color="bg-emerald-500/15 text-emerald-400" border="border-emerald-500/20" />
      <StatCard
        icon={AlertTriangle}
        label="RTO At Risk / Breached"
        value={breached + atRisk}
        sub={`${breached} breached · ${atRisk} at risk`}
        color={(breached + atRisk) > 0 ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}
        border={(breached + atRisk) > 0 ? 'border-red-500/20' : 'border-green-500/20'}
      />
      <StatCard
        icon={CheckCircle2}
        label="Drill Completion"
        value={`${donePh}/${totalPh}`}
        sub="phases complete"
        color={donePh === totalPh && totalPh > 0 ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'}
        border={donePh === totalPh && totalPh > 0 ? 'border-green-500/20' : 'border-slate-500/20'}
      />
    </div>
  )
}
