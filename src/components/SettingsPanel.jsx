/**
 * SettingsPanel — slide-over settings drawer
 *
 * Sections:
 *   1. Branding  — customer logo upload + dashboard title
 *   2. SLA       — global switchover/switchback targets + per-app overrides
 *   3. Timezone  — IANA timezone picker
 *   4. Pinned    — manage pinned applications
 */

import { useState, useRef } from 'react'
import {
  X, Settings, Upload, Trash2, Pin, PinOff, Clock,
  ChevronDown, Save, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings, DEFAULT_SETTINGS } from '../context/SettingsContext'

// ── Common IANA timezone list ─────────────────────────────────────────────────

const TZ_LIST = [
  { label: 'UTC',                   value: 'UTC'                    },
  { label: 'London (GMT/BST)',       value: 'Europe/London'          },
  { label: 'Paris / Berlin (CET)',   value: 'Europe/Paris'           },
  { label: 'Dubai (GST +4)',         value: 'Asia/Dubai'             },
  { label: 'Riyadh (AST +3)',        value: 'Asia/Riyadh'            },
  { label: 'Mumbai (IST +5:30)',     value: 'Asia/Kolkata'           },
  { label: 'Singapore (SGT +8)',     value: 'Asia/Singapore'         },
  { label: 'Tokyo (JST +9)',         value: 'Asia/Tokyo'             },
  { label: 'Sydney (AEST/AEDT)',     value: 'Australia/Sydney'       },
  { label: 'New York (ET)',          value: 'America/New_York'       },
  { label: 'Chicago (CT)',           value: 'America/Chicago'        },
  { label: 'Denver (MT)',            value: 'America/Denver'         },
  { label: 'Los Angeles (PT)',       value: 'America/Los_Angeles'    },
  { label: 'São Paulo (BRT -3)',     value: 'America/Sao_Paulo'      },
  { label: 'Johannesburg (SAST +2)',  value: 'Africa/Johannesburg'   },
  { label: 'Cairo (EET +2)',         value: 'Africa/Cairo'           },
  { label: 'Hong Kong (HKT +8)',     value: 'Asia/Hong_Kong'         },
  { label: 'Seoul (KST +9)',         value: 'Asia/Seoul'             },
  { label: 'Istanbul (TRT +3)',      value: 'Europe/Istanbul'        },
  { label: 'Moscow (MSK +3)',        value: 'Europe/Moscow'          },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }) {
  const t = useT()
  return (
    <div className={`border-b ${t.border} pb-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-blue-400" />
        <h3 className={`text-sm font-semibold ${t.text}`}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  const t = useT()
  return <label className={`block text-xs font-medium mb-1 ${t.textMuted}`}>{children}</label>
}

function NumInput({ value, onChange, min = 1, max = 1440 }) {
  const t = useT()
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className={`w-24 px-2 py-1.5 rounded-lg border text-xs font-mono ${t.inputBg} ${t.border} ${t.text} focus:outline-none focus:ring-1 focus:ring-blue-500`}
    />
  )
}

// ── Branding section ─────────────────────────────────────────────────────────

function BrandingSection({ settings, save }) {
  const t      = useT()
  const fileRef = useRef(null)

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => save({ customerLogo: ev.target.result })
    reader.readAsDataURL(file)
  }

  return (
    <Section title="Branding" icon={Settings}>
      {/* Dashboard title */}
      <div className="mb-4">
        <FieldLabel>Dashboard Title</FieldLabel>
        <input
          type="text"
          placeholder="Resiliency Dashboard"
          value={settings.customerName}
          onChange={(e) => save({ customerName: e.target.value })}
          className={`w-full px-3 py-1.5 rounded-lg border text-xs ${t.inputBg} ${t.border} ${t.text} focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        <p className={`text-xs mt-1 ${t.textFaint}`}>Leave blank to use default "Resiliency Dashboard"</p>
      </div>

      {/* Logo upload */}
      <div>
        <FieldLabel>Customer Logo</FieldLabel>
        <div className="flex items-center gap-3">
          {settings.customerLogo ? (
            <img
              src={settings.customerLogo}
              alt="Customer logo"
              className="h-10 max-w-[120px] object-contain rounded"
            />
          ) : (
            <div className={`h-10 w-24 rounded border-2 border-dashed ${t.borderDash} flex items-center justify-center`}>
              <span className={`text-xs ${t.textFaint}`}>No logo</span>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          {settings.customerLogo && (
            <button
              onClick={() => save({ customerLogo: null })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:opacity-80"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>
        <p className={`text-xs mt-1 ${t.textFaint}`}>PNG, SVG or JPEG. Recommended: 120×40 px. Stored locally in browser.</p>
      </div>
    </Section>
  )
}

// ── SLA section ──────────────────────────────────────────────────────────────

function SlaSection({ settings, saveSla, appNames }) {
  const t = useT()
  const [newApp, setNewApp] = useState('')

  const globalSW  = settings.sla?.switchover ?? 30
  const globalSB  = settings.sla?.switchback ?? 60
  const globalFO  = settings.sla?.failover   ?? 30
  const globalFB  = settings.sla?.failback   ?? 60
  const perApp    = settings.sla?.perApp    ?? {}

  function updateGlobal(phase, val) {
    saveSla({ [phase]: val })
  }

  function updatePerApp(app, phase, val) {
    const updated = { ...perApp, [app]: { ...(perApp[app] || {}), [phase]: val } }
    saveSla({ perApp: updated })
  }

  function removePerApp(app) {
    const { [app]: _, ...rest } = perApp
    saveSla({ perApp: rest })
  }

  function addApp() {
    const name = newApp.trim()
    if (!name || perApp[name]) return
    saveSla({ perApp: { ...perApp, [name]: { switchover: globalSW, switchback: globalSB, failover: globalFO, failback: globalFB } } })
    setNewApp('')
  }

  return (
    <Section title="SLA Targets" icon={Clock}>
      {/* Note about readiness */}
      <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-300">
          <strong>Readiness</strong> phase has no SLA target — excluded from all RTO calculations.
        </p>
      </div>

      {/* Global defaults */}
      <div className="mb-5">
        <p className={`text-xs font-medium mb-2 ${t.textSub}`}>Global Defaults</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <FieldLabel>Switchover SLA (min)</FieldLabel>
            <NumInput value={globalSW} onChange={(v) => updateGlobal('switchover', v)} />
          </div>
          <div>
            <FieldLabel>Switchback SLA (min)</FieldLabel>
            <NumInput value={globalSB} onChange={(v) => updateGlobal('switchback', v)} />
          </div>
          <div>
            <FieldLabel>Failover SLA (min)</FieldLabel>
            <NumInput value={globalFO} onChange={(v) => updateGlobal('failover', v)} />
          </div>
          <div>
            <FieldLabel>Failback SLA (min)</FieldLabel>
            <NumInput value={globalFB} onChange={(v) => updateGlobal('failback', v)} />
          </div>
        </div>
      </div>

      {/* Per-app overrides */}
      <div>
        <p className={`text-xs font-medium mb-2 ${t.textSub}`}>Per-Application Overrides</p>
        {Object.keys(perApp).length > 0 && (
          <div className={`rounded-lg border ${t.border} overflow-hidden mb-3 overflow-x-auto`}>
            <table className="w-full text-xs min-w-[480px]">
              <thead className={`${t.tableHead}`}>
                <tr>
                  {['Application', 'Switchover', 'Switchback', 'Failover', 'Failback', ''].map((h) => (
                    <th key={h} className={`text-left px-3 py-2 font-medium ${t.textMuted}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(perApp).map(([app, vals]) => (
                  <tr key={app} className={`border-t ${t.border}`}>
                    <td className={`px-3 py-2 font-medium ${t.textSub} whitespace-nowrap`}>{app}</td>
                    {['switchover', 'switchback', 'failover', 'failback'].map((ph) => (
                      <td key={ph} className="px-3 py-1.5">
                        <NumInput
                          value={vals[ph] ?? settings.sla?.[ph] ?? 30}
                          onChange={(v) => updatePerApp(app, ph, v)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      <button onClick={() => removePerApp(app)}
                        className="p-1 rounded text-red-400 hover:text-red-300">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add app row */}
        <div className="flex gap-2">
          <input
            list="app-names"
            placeholder="Application name…"
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addApp()}
            className={`flex-1 px-2 py-1.5 rounded-lg border text-xs ${t.inputBg} ${t.border} ${t.text} focus:outline-none focus:ring-1 focus:ring-blue-500`}
          />
          <datalist id="app-names">
            {appNames.map((a) => <option key={a} value={a} />)}
          </datalist>
          <button
            onClick={addApp}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
          >
            Add
          </button>
        </div>
      </div>
    </Section>
  )
}

// ── Timezone section ─────────────────────────────────────────────────────────

function TimezoneSection({ settings, save }) {
  const t = useT()
  const current = settings.timezone || 'UTC'
  const nowStr  = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: current,
  })

  return (
    <Section title="Timezone" icon={Clock}>
      <FieldLabel>Display Timezone</FieldLabel>
      <div className="relative mb-2">
        <select
          value={current}
          onChange={(e) => save({ timezone: e.target.value })}
          className={`w-full px-3 py-1.5 pr-8 rounded-lg border text-xs appearance-none ${t.inputBg} ${t.border} ${t.text} focus:outline-none focus:ring-1 focus:ring-blue-500`}
        >
          {TZ_LIST.map(({ label, value }) => (
            <option key={value} value={value}>{label} — {value}</option>
          ))}
        </select>
        <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${t.textFaint}`} />
      </div>
      <p className={`text-xs ${t.textFaint}`}>
        Current time in selected zone: <span className="font-mono text-blue-400">{nowStr}</span>
      </p>
    </Section>
  )
}

// ── Pinned apps section ──────────────────────────────────────────────────────

function PinnedSection({ settings, togglePin, appNames }) {
  const t = useT()
  const pinned = settings.pinnedApps || []

  if (appNames.length === 0) {
    return (
      <Section title="Pinned Applications" icon={Pin}>
        <p className={`text-xs ${t.textFaint}`}>Load the dashboard first to see available applications.</p>
      </Section>
    )
  }

  return (
    <Section title="Pinned Applications" icon={Pin}>
      <p className={`text-xs mb-3 ${t.textMuted}`}>
        Pinned apps appear at the top of the Application DR Status grid.
      </p>
      <div className="flex flex-wrap gap-2">
        {appNames.map((app) => {
          const isPinned = pinned.includes(app)
          return (
            <button
              key={app}
              onClick={() => togglePin(app)}
              title={isPinned ? 'Unpin' : 'Pin to top'}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isPinned
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                  : `${t.border} ${t.textMuted} hover:opacity-80`
              }`}
            >
              {isPinned ? <Pin className="w-3 h-3" /> : <PinOff className="w-3 h-3" />}
              {app}
            </button>
          )
        })}
      </div>
    </Section>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SettingsPanel({ onClose, appNames = [] }) {
  const t = useT()
  const { settings, save, saveSla, togglePin } = useSettings()

  function handleReset() {
    if (!confirm('Reset all settings to defaults?')) return
    save(DEFAULT_SETTINGS)
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer (slides in from right) */}
      <div className={`relative z-10 ml-auto w-full max-w-md h-full flex flex-col shadow-2xl overflow-hidden ${t.card} border-l ${t.border}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${t.border} flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-400" />
            <h2 className={`text-sm font-semibold ${t.text}`}>Settings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80`}
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button onClick={onClose}
              className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <BrandingSection settings={settings} save={save} />
          <SlaSection settings={settings} saveSla={saveSla} appNames={appNames} />
          <TimezoneSection settings={settings} save={save} />
          <PinnedSection settings={settings} togglePin={togglePin} appNames={appNames} />
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 px-5 py-3 border-t ${t.border}`}>
          <p className={`text-xs text-center ${t.textFaint}`}>
            Settings saved automatically · Stored in browser localStorage
          </p>
        </div>
      </div>
    </div>
  )
}
