import { RefreshCw, Shield, Clock, Sun, Moon, FileSpreadsheet, Settings, Network } from 'lucide-react'
import { useTheme, useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

const IS_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export default function Header({
  lastRefresh, autoRefresh, onToggleAuto,
  onRefresh, loading, onLogout, onReport, hasData, onSettings, onTopology,
}) {
  const { dark, toggle } = useTheme()
  const t = useT()
  const { settings, fmtTime } = useSettings()

  const dashboardTitle = settings.customerName?.trim() || 'Resiliency Dashboard'

  const formattedTime = lastRefresh
    ? fmtTime(lastRefresh.toISOString())
    : '--:--:--'

  return (
    <header className={`border-b px-6 py-4 ${t.header}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          {/* Customer logo or default shield icon */}
          {settings.customerLogo ? (
            <img
              src={settings.customerLogo}
              alt="Customer logo"
              className="h-9 max-w-[120px] object-contain rounded"
            />
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
          )}
          <div>
            <h1 className={`text-lg font-semibold leading-tight ${t.text}`}>
              {dashboardTitle}
            </h1>
            <p className={`text-xs ${t.textMuted}`}>
              Disaster Recovery · Switchover · Switchback · Readiness
            </p>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3 flex-wrap">

          {/* Connection badge */}
          {IS_MOCK ? (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Mock Data
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live — se-preprod SaaS
            </span>
          )}

          {/* Last refresh */}
          <div className={`flex items-center gap-1.5 text-xs ${t.textMuted}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last: <span className={`font-mono ${t.textSub}`}>{formattedTime}</span>
            </span>
          </div>

          {/* Auto-refresh toggle */}
          <label className={`flex items-center gap-2 text-xs cursor-pointer select-none ${t.textMuted}`}>
            <span>Auto</span>
            <button
              onClick={onToggleAuto}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none ${
                autoRefresh ? 'bg-blue-600' : dark ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block w-3.5 h-3.5 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ${
                  autoRefresh ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          {/* Dark / Light toggle */}
          <button
            onClick={toggle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-1.5 rounded-lg border transition-colors ${t.card} ${t.border} ${t.textMuted} hover:opacity-80`}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Agent Topology (NOC View) */}
          <button
            onClick={onTopology}
            title="Agent Topology — NOC View"
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${t.card} ${t.border} ${t.textMuted} hover:opacity-80`}
          >
            <Network className="w-4 h-4" />
            <span className="hidden sm:inline">Topology</span>
          </button>

          {/* Settings */}
          <button
            onClick={onSettings}
            title="Open settings"
            className={`p-1.5 rounded-lg border transition-colors ${t.card} ${t.border} ${t.textMuted} hover:opacity-80`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Generate Report */}
          {hasData && (
            <button
              onClick={onReport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-600 text-white transition-colors font-medium"
              title="Generate DR Drill Summary Report"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Report
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Logout */}
          {onLogout && (
            <button
              onClick={onLogout}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${t.border} ${t.textMuted} hover:opacity-80`}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
