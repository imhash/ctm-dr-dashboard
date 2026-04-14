import { useState, useCallback, useMemo } from 'react'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight,
  Save, Server, Cpu, AlertCircle
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

// ─── constants ────────────────────────────────────────────────────────────────

const CRITICALITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low']

const PRESET_COLORS = [
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Pink',   value: '#ec4899' },
]

const CRITICALITY_COLORS = {
  Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  High:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Low:      'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

function newId() {
  try { return crypto.randomUUID() } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
}

function blankServer() {
  return { id: newId(), server: '', ip: '', datacenter: '', agents: [] }
}

function blankAgent() {
  return { name: '', ip: '' }
}

function blankService() {
  return {
    id: newId(),
    name: 'New Service',
    criticality: 'High',
    color: '#3b82f6',
    description: '',
    prod: [],
    dr: [],
  }
}

// ─── AgentRow ─────────────────────────────────────────────────────────────────

function AgentRow({ agent, agentNames, onChange, onDelete, t }) {
  return (
    <div className={`flex items-center gap-2 rounded px-2 py-1 ${t.inner} border ${t.border}`}>
      <Cpu size={13} className="text-slate-400 shrink-0" />
      <input
        list="agent-names-list"
        value={agent.name}
        onChange={e => onChange({ ...agent, name: e.target.value })}
        placeholder="agent name"
        className={`flex-1 min-w-0 bg-transparent text-sm ${t.text} placeholder:${t.textFaint} outline-none`}
      />
      <span className={`text-xs ${t.textMuted}`}>/</span>
      <input
        value={agent.ip}
        onChange={e => onChange({ ...agent, ip: e.target.value })}
        placeholder="IP"
        className={`w-28 bg-transparent text-sm ${t.text} placeholder:${t.textFaint} outline-none font-mono`}
      />
      <button
        onClick={onDelete}
        className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"
        title="Remove agent"
      >
        <Trash2 size={13} />
      </button>

      <datalist id="agent-names-list">
        {agentNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}

// ─── ServerCard ───────────────────────────────────────────────────────────────

function ServerCard({ server, zone, agentNames, onChange, onDelete, t }) {
  const [expanded, setExpanded] = useState(true)

  const accentText = zone === 'prod' ? 'text-green-400' : 'text-cyan-400'
  const accentBorder = zone === 'prod' ? 'border-green-500/30' : 'border-cyan-500/30'

  function updateAgent(idx, updated) {
    const agents = server.agents.map((a, i) => i === idx ? updated : a)
    onChange({ ...server, agents })
  }

  function deleteAgent(idx) {
    onChange({ ...server, agents: server.agents.filter((_, i) => i !== idx) })
  }

  function addAgent() {
    onChange({ ...server, agents: [...server.agents, blankAgent()] })
  }

  return (
    <div className={`rounded-lg border ${accentBorder} ${t.inner} overflow-hidden`}>
      {/* card header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${t.tableHead}`}
        onClick={() => setExpanded(v => !v)}
      >
        {expanded
          ? <ChevronDown size={14} className={`shrink-0 ${accentText}`} />
          : <ChevronRight size={14} className={`shrink-0 ${accentText}`} />
        }
        <Server size={13} className={`shrink-0 ${accentText}`} />
        <span className={`text-sm font-medium flex-1 truncate ${t.text}`}>
          {server.server || <span className={t.textFaint}>Unnamed server</span>}
        </span>
        {server.ip && (
          <span className={`text-xs font-mono ${t.textMuted} mr-2`}>{server.ip}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"
          title="Remove server"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-3">
          {/* server fields */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className={`text-xs ${t.textMuted}`}>Server hostname</span>
              <input
                value={server.server}
                onChange={e => onChange({ ...server, server: e.target.value })}
                placeholder="ctm-server-01"
                className={`w-full rounded px-2 py-1.5 text-sm border ${t.border} ${t.inputBg} ${t.text} placeholder:${t.textFaint} outline-none focus:border-blue-500/60`}
              />
            </label>
            <label className="space-y-1">
              <span className={`text-xs ${t.textMuted}`}>IP Address</span>
              <input
                value={server.ip}
                onChange={e => onChange({ ...server, ip: e.target.value })}
                placeholder="10.0.0.1"
                className={`w-full rounded px-2 py-1.5 text-sm border ${t.border} ${t.inputBg} ${t.text} placeholder:${t.textFaint} outline-none focus:border-blue-500/60 font-mono`}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className={`text-xs ${t.textMuted}`}>Datacenter</span>
            <input
              value={server.datacenter}
              onChange={e => onChange({ ...server, datacenter: e.target.value })}
              placeholder="e.g. Dubai DC1"
              className={`w-full rounded px-2 py-1.5 text-sm border ${t.border} ${t.inputBg} ${t.text} placeholder:${t.textFaint} outline-none focus:border-blue-500/60`}
            />
          </label>

          {/* agents */}
          <div className="space-y-1.5">
            <span className={`text-xs font-medium ${t.textMuted} uppercase tracking-wide`}>Agents</span>
            {server.agents.length === 0 && (
              <p className={`text-xs ${t.textFaint} italic`}>No agents — add one below</p>
            )}
            {server.agents.map((agent, idx) => (
              <AgentRow
                key={idx}
                agent={agent}
                agentNames={agentNames}
                onChange={updated => updateAgent(idx, updated)}
                onDelete={() => deleteAgent(idx)}
                t={t}
              />
            ))}
            <button
              onClick={addAgent}
              className={`flex items-center gap-1.5 text-xs ${accentText} hover:opacity-80 transition-opacity mt-1`}
            >
              <Plus size={12} /> Add Agent
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ServerSection ────────────────────────────────────────────────────────────

function ServerSection({ label, zone, servers, agentNames, onChange, t }) {
  const isprod = zone === 'prod'
  const accentText    = isprod ? 'text-green-400' : 'text-cyan-400'
  const accentBg      = isprod ? 'bg-green-500/10' : 'bg-cyan-500/10'

  function updateServer(idx, updated) {
    onChange(servers.map((s, i) => i === idx ? updated : s))
  }

  function deleteServer(idx) {
    onChange(servers.filter((_, i) => i !== idx))
  }

  function addServer() {
    onChange([...servers, blankServer()])
  }

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 py-1 border-b ${t.border}`}>
        <span className={`text-xs font-bold uppercase tracking-widest ${accentText}`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>({servers.length} server{servers.length !== 1 ? 's' : ''})</span>
      </div>

      {servers.length === 0 && (
        <p className={`text-xs ${t.textFaint} italic px-1`}>No servers configured</p>
      )}

      <div className="space-y-2">
        {servers.map((srv, idx) => (
          <ServerCard
            key={srv.id}
            server={srv}
            zone={zone}
            agentNames={agentNames}
            onChange={updated => updateServer(idx, updated)}
            onDelete={() => deleteServer(idx)}
            t={t}
          />
        ))}
      </div>

      <button
        onClick={addServer}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-dashed ${t.borderDash} ${accentText} hover:${accentBg} transition-colors`}
      >
        <Plus size={12} /> Add {isprod ? 'PROD' : 'DR'} Server
      </button>
    </div>
  )
}

// ─── EditPanel ────────────────────────────────────────────────────────────────

function EditPanel({ service, agentNames, onSave, onDelete, t }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(service)))

  // sync when selected service changes from outside
  useMemo(() => {
    setDraft(JSON.parse(JSON.stringify(service)))
  }, [service.id])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(service)

  function field(key, value) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function handleSave() {
    onSave(draft)
  }

  function handleDelete() {
    if (window.confirm(`Delete service "${service.name}"? This cannot be undone.`)) {
      onDelete(service.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* panel header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border} shrink-0`}>
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-transparent"
            style={{ backgroundColor: draft.color, ringColor: draft.color }}
          />
          <h2 className={`text-base font-semibold ${t.text}`}>
            {draft.name || <span className={t.textFaint}>Unnamed Service</span>}
          </h2>
          {isDirty && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors`}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium transition-colors
              ${isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : `${t.inner} ${t.textMuted} cursor-not-allowed border ${t.border}`
              }`}
          >
            <Save size={14} /> Save Service
          </button>
        </div>
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* basic info */}
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className={`text-xs font-medium ${t.textMuted}`}>Service Name</span>
            <input
              value={draft.name}
              onChange={e => field('name', e.target.value)}
              placeholder="e.g. CRM"
              className={`w-full rounded-md px-3 py-2 text-sm border ${t.border} ${t.inputBg} ${t.text} placeholder:${t.textFaint} outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30`}
            />
          </label>
          <label className="space-y-1.5">
            <span className={`text-xs font-medium ${t.textMuted}`}>Criticality</span>
            <select
              value={draft.criticality}
              onChange={e => field('criticality', e.target.value)}
              className={`w-full rounded-md px-3 py-2 text-sm border ${t.border} ${t.inputBg} ${t.text} outline-none focus:border-blue-500/60 cursor-pointer`}
            >
              {CRITICALITY_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className={`text-xs font-medium ${t.textMuted}`}>Description</span>
          <input
            value={draft.description}
            onChange={e => field('description', e.target.value)}
            placeholder="Optional description of this business service"
            className={`w-full rounded-md px-3 py-2 text-sm border ${t.border} ${t.inputBg} ${t.text} placeholder:${t.textFaint} outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30`}
          />
        </label>

        {/* color picker */}
        <div className="space-y-2">
          <span className={`text-xs font-medium ${t.textMuted}`}>Color</span>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => field('color', value)}
                title={label}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 border-2
                  ${draft.color === value ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                style={{ backgroundColor: value }}
              />
            ))}
            <input
              type="color"
              value={draft.color}
              onChange={e => field('color', e.target.value)}
              title="Custom color"
              className="w-7 h-7 rounded-full cursor-pointer border-2 border-transparent hover:border-white transition-all bg-transparent"
            />
          </div>
        </div>

        <hr className={`border-t ${t.border}`} />

        {/* production servers */}
        <ServerSection
          label="Production Servers"
          zone="prod"
          servers={draft.prod}
          agentNames={agentNames}
          onChange={servers => field('prod', servers)}
          t={t}
        />

        <hr className={`border-t ${t.border}`} />

        {/* DR servers */}
        <ServerSection
          label="DR Servers"
          zone="dr"
          servers={draft.dr}
          agentNames={agentNames}
          onChange={servers => field('dr', servers)}
          t={t}
        />

        {/* bottom save strip */}
        {isDirty && (
          <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${t.inner} border border-yellow-500/30`}>
            <span className="flex items-center gap-2 text-sm text-yellow-400">
              <AlertCircle size={15} />
              You have unsaved changes
            </span>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Save size={14} /> Save Service
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ServiceListItem ──────────────────────────────────────────────────────────

function ServiceListItem({ service, selected, dirty, onClick, t }) {
  const critClass = CRITICALITY_COLORS[service.criticality] || CRITICALITY_COLORS.Low

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors group
        ${selected
          ? `${t.tableHead} border ${t.border} ring-1 ring-blue-500/40`
          : `hover:${t.inner} border border-transparent`
        }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: service.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium truncate ${t.text}`}>{service.name}</span>
          {dirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${critClass}`}>
            {service.criticality}
          </span>
          <span className={`text-[10px] ${t.textFaint}`}>
            {(service.prod?.length ?? 0)}P / {(service.dr?.length ?? 0)}DR
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew, t }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className={`w-16 h-16 rounded-2xl ${t.inner} border ${t.border} flex items-center justify-center`}>
        <Server size={28} className={t.textFaint} />
      </div>
      <div>
        <p className={`text-base font-medium ${t.text}`}>No service selected</p>
        <p className={`text-sm ${t.textMuted} mt-1`}>
          Select a service from the list or create a new one.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <Plus size={15} /> New Service
      </button>
    </div>
  )
}

// ─── ServiceConfigPage (main) ─────────────────────────────────────────────────

export default function ServiceConfigPage({ agents = [], onClose }) {
  const t = useT()
  const { settings, save } = useSettings()

  // canonical list from settings (source of truth after saves)
  const [services, setServices] = useState(
    () => JSON.parse(JSON.stringify(settings.businessServices ?? []))
  )
  const [selectedId, setSelectedId] = useState(services[0]?.id ?? null)
  // track which service IDs have local draft changes not yet saved to global settings
  const [dirtyIds, setDirtyIds] = useState(new Set())

  const agentNames = useMemo(() => {
    if (!agents || agents.length === 0) return []
    return [...new Set(agents.map(a => a.nodeid ?? a.name ?? a).filter(Boolean))]
  }, [agents])

  const selectedService = services.find(s => s.id === selectedId) ?? null

  function handleSelectService(id) {
    setSelectedId(id)
  }

  function handleNewService() {
    const svc = blankService()
    setServices(prev => [...prev, svc])
    setSelectedId(svc.id)
    setDirtyIds(prev => new Set([...prev, svc.id]))
  }

  function handleSaveService(draft) {
    const updated = services.map(s => s.id === draft.id ? draft : s)
    setServices(updated)
    // persist to global settings
    save({ businessServices: updated })
    // clear dirty flag
    setDirtyIds(prev => {
      const next = new Set(prev)
      next.delete(draft.id)
      return next
    })
  }

  function handleDeleteService(id) {
    const updated = services.filter(s => s.id !== id)
    setServices(updated)
    save({ businessServices: updated })
    setDirtyIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setSelectedId(updated[0]?.id ?? null)
  }

  // When user edits a draft inside EditPanel, track as dirty
  // (EditPanel manages its own local state; we just need to detect if the saved
  //  version differs from what's in services — the yellow dot on the list item
  //  is shown via dirtyIds which EditPanel signals through onSave clearing it)
  // We mark dirty when a service is newly created (blankService). Additional
  // fine-grained dirty per-edit is kept inside EditPanel's own isDirty state.

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${t.pageBg}`}>
      {/* top bar */}
      <header className={`flex items-center justify-between px-5 py-3 border-b ${t.border} ${t.card} shrink-0`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 text-sm ${t.textSub} hover:${t.text} transition-colors`}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className={`${t.textFaint} text-sm`}>|</span>
          <h1 className={`text-sm font-semibold ${t.text}`}>Service Configuration</h1>
          <span className={`text-xs ${t.textFaint}`}>— Resiliency Dashboard</span>
        </div>
        <button
          onClick={handleNewService}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> New Service
        </button>
      </header>

      {/* body */}
      <div className="flex flex-1 min-h-0">
        {/* left sidebar — services list */}
        <aside className={`w-64 shrink-0 border-r ${t.border} flex flex-col`}>
          <div className={`px-4 py-3 border-b ${t.border}`}>
            <p className={`text-xs font-semibold uppercase tracking-widest ${t.textMuted}`}>
              Business Services
            </p>
            <p className={`text-xs ${t.textFaint} mt-0.5`}>{services.length} configured</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {services.length === 0 && (
              <p className={`text-xs ${t.textFaint} italic px-2 mt-4 text-center`}>
                No services yet.
              </p>
            )}
            {services.map(svc => (
              <ServiceListItem
                key={svc.id}
                service={svc}
                selected={svc.id === selectedId}
                dirty={dirtyIds.has(svc.id)}
                onClick={() => handleSelectService(svc.id)}
                t={t}
              />
            ))}
          </div>
          <div className={`px-2 py-3 border-t ${t.border}`}>
            <button
              onClick={handleNewService}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs ${t.textSub} border border-dashed ${t.borderDash} hover:border-blue-500/50 hover:text-blue-400 transition-colors`}
            >
              <Plus size={12} /> Add Service
            </button>
          </div>
        </aside>

        {/* right edit panel */}
        <main className={`flex-1 min-w-0 ${t.card}`}>
          {selectedService ? (
            <EditPanel
              key={selectedService.id}
              service={selectedService}
              agentNames={agentNames}
              onSave={handleSaveService}
              onDelete={handleDeleteService}
              t={t}
            />
          ) : (
            <EmptyState onNew={handleNewService} t={t} />
          )}
        </main>
      </div>
    </div>
  )
}
