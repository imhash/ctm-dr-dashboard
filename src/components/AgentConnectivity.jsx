import { useState } from 'react'
import { Monitor, Server, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { useT } from '../context/ThemeContext'

const STATUS_CONFIG = {
  Connected:    { color: 'text-green-400',  dot: 'bg-green-400',  icon: Wifi,          cardBorder: 'border-green-500/20',  cardBg: 'bg-green-500/5'  },
  Disconnected: { color: 'text-red-400',    dot: 'bg-red-400',    icon: WifiOff,       cardBorder: 'border-red-500/20',    cardBg: 'bg-red-500/5'    },
  Warning:      { color: 'text-amber-400',  dot: 'bg-amber-400',  icon: AlertTriangle, cardBorder: 'border-amber-500/20',  cardBg: 'bg-amber-500/5'  },
}

const ENV_FILTERS    = ['All', 'DR', 'PROD']
const STATUS_FILTERS = ['All', 'Connected', 'Warning', 'Disconnected']

function formatPing(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function AgentCard({ agent }) {
  const t   = useT()
  const cfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.Disconnected
  const Icon         = cfg.icon
  const PlatformIcon = agent.platform === 'Windows' ? Monitor : Server

  return (
    <div className={`border rounded-lg p-3 flex flex-col gap-2 ${cfg.cardBorder} ${cfg.cardBg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${agent.status === 'Connected' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-mono font-medium truncate ${t.text}`}>{agent.name}</span>
        </div>
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} />
      </div>

      <p className={`text-xs font-mono truncate ${t.textFaint}`}>{agent.host}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-xs px-1.5 py-0.5 rounded border ${
          agent.env === 'DR'
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
          {agent.env}
        </span>
        <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}>
          <PlatformIcon className="w-3 h-3" />{agent.platform}
        </span>
        {agent.activeJobs > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            {agent.activeJobs} job{agent.activeJobs > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className={`flex items-center justify-between text-xs border-t pt-1.5 ${t.border}`}>
        <span className={`font-mono ${t.textFaint}`}>{agent.datacenter}</span>
        <span className={t.textFaint}>{formatPing(agent.lastPing)}</span>
      </div>
    </div>
  )
}

function FilterGroup({ label, options, value, onChange }) {
  const t = useT()
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs ${t.textFaint}`}>{label}:</span>
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            value === opt
              ? 'bg-blue-600 border-blue-500 text-white'
              : `border-transparent ${t.border} ${t.textMuted} hover:opacity-80`}`}>
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function AgentConnectivity({ agents }) {
  const t = useT()
  const [envFilter,    setEnvFilter]    = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = agents.filter((a) =>
    (envFilter    === 'All' || a.env    === envFilter) &&
    (statusFilter === 'All' || a.status === statusFilter)
  )

  const counts = {
    connected:    agents.filter((a) => a.status === 'Connected').length,
    warning:      agents.filter((a) => a.status === 'Warning').length,
    disconnected: agents.filter((a) => a.status === 'Disconnected').length,
  }

  return (
    <div className={`${t.card} border ${t.border} rounded-xl p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className={`text-sm font-semibold ${t.text}`}>Agent / Host Connectivity</h2>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>{agents.length} total agents</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" />{counts.connected}</span>
          <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-400" />{counts.warning}</span>
          <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" />{counts.disconnected}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <FilterGroup label="Env"    options={ENV_FILTERS}    value={envFilter}    onChange={setEnvFilter} />
        <FilterGroup label="Status" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
        {filtered.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        {filtered.length === 0 && (
          <p className={`col-span-4 text-center text-xs py-8 ${t.textFaint}`}>No agents match the current filters.</p>
        )}
      </div>
    </div>
  )
}
