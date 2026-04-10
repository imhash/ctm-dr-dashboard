import { ArrowUpDown, CheckCircle2, XCircle, Clock, Wifi, WifiOff } from 'lucide-react'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function SlaBar({ value }) {
  const color =
    value >= 99 ? 'bg-green-500' :
    value >= 95 ? 'bg-amber-500' : 'bg-red-500'
  const text =
    value >= 99 ? 'text-green-400' :
    value >= 95 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-mono ${text}`}>{value}%</span>
    </div>
  )
}

function EnvColumn({ data, isActive }) {
  const isOnDrill = data.status.includes('Drill')

  return (
    <div className={`flex-1 rounded-xl border p-4 flex flex-col gap-3 ${
      isActive
        ? 'bg-[#1a1d27] border-blue-500/30'
        : 'bg-[#161926] border-[#2a2d3a]'
    }`}>
      {/* Env label */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{data.label}</p>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{data.servers.join(', ')}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
          isOnDrill
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            : data.status === 'Active'
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {isOnDrill ? <Wifi className="w-3 h-3" /> : data.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {data.status}
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricBox label="Active Jobs"    value={data.activeJobs}    color={data.activeJobs > 0 ? 'text-cyan-400' : 'text-slate-300'} />
        <MetricBox label="Completed"      value={data.completedJobs} color="text-green-400" />
        <MetricBox label="Failed"         value={data.failedJobs}    color={data.failedJobs > 0 ? 'text-red-400' : 'text-slate-300'} />
        <MetricBox label="Waiting"        value={data.waitingJobs}   color={data.waitingJobs > 0 ? 'text-amber-400' : 'text-slate-300'} />
      </div>

      {/* Agents */}
      <div className="border-t border-[#2a2d3a] pt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Agents Connected</span>
          <span className={data.agentsConnected === data.agentsTotal ? 'text-green-400' : 'text-amber-400'}>
            {data.agentsConnected}/{data.agentsTotal}
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${data.agentsConnected === data.agentsTotal ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${(data.agentsConnected / data.agentsTotal) * 100}%` }}
          />
        </div>
      </div>

      {/* SLA */}
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">SLA Compliance</span>
        </div>
        <SlaBar value={data.slaCompliance} />
      </div>

      {/* Footer meta */}
      <div className="grid grid-cols-2 gap-1.5 text-xs border-t border-[#2a2d3a] pt-3">
        <div>
          <p className="text-slate-500">CTM Version</p>
          <p className="text-slate-300 font-mono mt-0.5">{data.version}</p>
        </div>
        <div>
          <p className="text-slate-500">Uptime</p>
          <p className="text-slate-300 font-mono mt-0.5">{data.uptime}</p>
        </div>
        <div>
          <p className="text-slate-500">Avg Job Duration</p>
          <p className="text-slate-300 font-mono mt-0.5">{data.avgJobDuration}</p>
        </div>
        <div>
          <p className="text-slate-500">Last Sync</p>
          <p className="text-slate-300 font-mono mt-0.5">{formatDate(data.lastSync)}</p>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ label, value, color = 'text-slate-300' }) {
  return (
    <div className="bg-[#0f1117] rounded-lg px-3 py-2">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}

export default function DRvsProdComparison({ data }) {
  if (!data) return null

  const delta = {
    failed: data.dr.failedJobs - data.prod.failedJobs,
    sla: (data.dr.slaCompliance - data.prod.slaCompliance).toFixed(1),
    agents: data.dr.agentsConnected - data.prod.agentsConnected,
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Production vs DR Comparison</h2>
          <p className="text-xs text-slate-500 mt-0.5">Live environment metrics side by side</p>
        </div>
        <ArrowUpDown className="w-4 h-4 text-slate-500" />
      </div>

      {/* Delta strip */}
      <div className="flex gap-2 flex-wrap text-xs">
        <DeltaBadge label="Failed Jobs Δ" value={delta.failed} invert />
        <DeltaBadge label="SLA Δ" value={Number(delta.sla)} suffix="%" />
        <DeltaBadge label="Agents Δ" value={delta.agents} />
      </div>

      {/* Side-by-side columns */}
      <div className="flex gap-3">
        <EnvColumn data={data.prod} isActive={false} />
        <EnvColumn data={data.dr}   isActive />
      </div>
    </div>
  )
}

function DeltaBadge({ label, value, suffix = '', invert = false }) {
  // invert = true means a positive delta is bad (e.g. more failures)
  const isNeutral = value === 0
  const isBad = invert ? value > 0 : value < 0
  const isGood = invert ? value < 0 : value > 0

  const color = isNeutral
    ? 'bg-slate-500/10 border-slate-500/30 text-slate-400'
    : isBad
    ? 'bg-red-500/10 border-red-500/30 text-red-400'
    : 'bg-green-500/10 border-green-500/30 text-green-400'

  const sign = value > 0 ? '+' : ''

  return (
    <span className={`px-2.5 py-1 rounded-full border text-xs ${color}`}>
      {label}: {sign}{value}{suffix}
    </span>
  )
}
