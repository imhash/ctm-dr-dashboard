import { useState, useRef } from 'react'
import {
  X, Download, FileSpreadsheet, FileText,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronLeft, ChevronRight, Printer,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { buildReportRows, REPORT_COLUMNS } from '../utils/reportBuilder'
import { exportDrillReportXlsx, exportDrillReportCsv } from '../utils/exportXlsx'

// ── Colour helpers ────────────────────────────────────────────────────────────

function resultStyle(result) {
  switch (result) {
    case 'PASS':        return 'bg-green-500/15 text-green-400 border-green-500/30'
    case 'FAIL':        return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'IN PROGRESS': return 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    default:            return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

function slaStyle(status) {
  switch (status) {
    case 'Met':
    case 'On Track':  return 'bg-green-500/15 text-green-400 border-green-500/30'
    case 'At Risk':   return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'Missed':
    case 'Breached':  return 'bg-red-500/15 text-red-400 border-red-500/30'
    default:          return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

function phaseStyle(phase) {
  switch (phase) {
    case 'Switchover': return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    case 'Switchback': return 'bg-violet-500/15 text-violet-400 border-violet-500/30'
    case 'Readiness':  return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    default:           return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

function critStyle(crit) {
  switch (crit) {
    case 'Critical': return 'bg-red-500/15 text-red-400 border-red-500/30'
    case 'High':     return 'bg-orange-500/15 text-orange-400 border-orange-500/30'
    case 'Medium':   return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'Low':      return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
    default:         return 'bg-slate-500/15 text-slate-400 border-slate-500/30'
  }
}

// Columns that get a styled badge instead of plain text
const BADGE_COLS = new Set(['Overall Result', 'SLA Status', 'Failover / Failback', 'Criticality'])

function CellContent({ colKey, value }) {
  if (!value) return <span className="text-slate-600">—</span>
  if (!BADGE_COLS.has(colKey)) return <span>{value}</span>

  let style = ''
  if (colKey === 'Overall Result')      style = resultStyle(value)
  if (colKey === 'SLA Status')          style = slaStyle(value)
  if (colKey === 'Failover / Failback') style = phaseStyle(value)
  if (colKey === 'Criticality')         style = critStyle(value)

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${style}`}>
      {colKey === 'Overall Result' && value === 'PASS'        && <CheckCircle2 className="w-3 h-3" />}
      {colKey === 'Overall Result' && value === 'FAIL'        && <XCircle      className="w-3 h-3" />}
      {colKey === 'Overall Result' && value === 'IN PROGRESS' && <Clock        className="w-3 h-3" />}
      {colKey === 'SLA Status'     && value === 'At Risk'     && <AlertTriangle className="w-3 h-3" />}
      {value}
    </span>
  )
}

// ── Summary banner ────────────────────────────────────────────────────────────

function SummaryBanner({ rows }) {
  const t     = useT()
  const pass  = rows.filter((r) => r['Overall Result'] === 'PASS').length
  const fail  = rows.filter((r) => r['Overall Result'] === 'FAIL').length
  const prog  = rows.filter((r) => r['Overall Result'] === 'IN PROGRESS').length
  const apps  = [...new Set(rows.map((r) => r['Application Name']))].length
  const rtoOk = rows.filter((r) => ['Met','On Track'].includes(r['SLA Status'])).length
  const rtoBad= rows.filter((r) => ['Missed','Breached'].includes(r['SLA Status'])).length

  const items = [
    { label: 'Applications',   value: apps,   color: 'text-blue-400'  },
    { label: 'Phases Total',   value: rows.length, color: 'text-slate-300' },
    { label: 'PASS',           value: pass,   color: 'text-green-400' },
    { label: 'FAIL',           value: fail,   color: 'text-red-400'   },
    { label: 'In Progress',    value: prog,   color: 'text-cyan-400'  },
    { label: 'RTO Met',        value: rtoOk,  color: 'text-green-400' },
    { label: 'RTO Breached',   value: rtoBad, color: rtoBad > 0 ? 'text-red-400' : 'text-slate-400' },
  ]

  return (
    <div className={`grid grid-cols-4 md:grid-cols-7 gap-3 px-6 py-4 border-b ${t.border}`}>
      {items.map(({ label, value, color }) => (
        <div key={label} className={`${t.inner} rounded-lg px-3 py-2 text-center`}>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
          <p className={`text-xs mt-0.5 ${t.textFaint}`}>{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

function Pagination({ page, total, onPage }) {
  const t     = useT()
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <div className={`flex items-center justify-between px-4 py-2 border-t text-xs ${t.border} ${t.textMuted}`}>
      <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} rows</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className={`p-1 rounded disabled:opacity-30 ${t.cardHover}`}><ChevronLeft className="w-4 h-4" /></button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className={`w-6 h-6 rounded text-xs ${p === page ? 'bg-blue-600 text-white' : `${t.cardHover} ${t.textMuted}`}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === pages}
          className={`p-1 rounded disabled:opacity-30 ${t.cardHover}`}><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

// ── Visible column groups (matching the reference Excel groupings) ─────────────

const COL_GROUPS = [
  {
    id: 'core',
    label: 'Application',
    cols: ['#', 'Application Name', 'Criticality', 'Application Type', 'Service Impact'],
  },
  {
    id: 'rto',
    label: 'RTO / Test Window',
    cols: ['RTO Agreed (Hours)', 'RTO Agreed (Min)', 'Test Start Date', 'Test Start Time',
           'Test End Date', 'Test End Time', 'Test Duration', 'Failover / Failback'],
  },
  {
    id: 'downtime',
    label: 'Downtime',
    cols: ['Downtime Start Time', 'Downtime End Time', 'Overall Downtime'],
  },
  {
    id: 'result',
    label: 'Result',
    cols: ['SLA Status', 'Overall Result', 'CTM Job ID', 'CTM Folder', 'Team Participation', 'Remarks'],
  },
]

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function DrillReportModal({ operations, onClose }) {
  const t = useT()
  const [page,        setPage]       = useState(1)
  const [activeGroup, setActiveGroup]= useState('core')
  const [filter,      setFilter]     = useState('All')
  const tableRef = useRef(null)

  const rows      = buildReportRows(operations)
  const filters   = ['All', 'PASS', 'FAIL', 'IN PROGRESS']
  const filtered  = filter === 'All' ? rows : rows.filter((r) => r['Overall Result'] === filter)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const visibleCols = REPORT_COLUMNS.filter((c) =>
    COL_GROUPS.find((g) => g.id === activeGroup)?.cols.includes(c.key)
  )

  const ts = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative z-10 flex flex-col m-4 md:m-8 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-4rem)] ${t.card} border ${t.border}`}>

        {/* ── Header ── */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border} flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-600/20 border border-green-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className={`text-base font-semibold ${t.text}`}>DR Drill Summary Report</h2>
              <p className={`text-xs ${t.textMuted}`}>Generated {ts} · {rows.length} phases · {[...new Set(rows.map((r) => r['Application Name']))].length} applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export buttons */}
            <button
              onClick={() => exportDrillReportXlsx(rows)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Excel
            </button>
            <button
              onClick={() => exportDrillReportCsv(rows)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${t.border} ${t.textMuted} hover:opacity-80`}
            >
              <FileText className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={handlePrint}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${t.border} ${t.textMuted} hover:opacity-80`}
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button onClick={onClose}
              className={`p-1.5 rounded-lg border ${t.border} ${t.textMuted} hover:opacity-80`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Summary banner ── */}
        <SummaryBanner rows={rows} />

        {/* ── Toolbar: column group tabs + filter ── */}
        <div className={`flex items-center justify-between px-6 py-2 border-b gap-4 flex-wrap ${t.border} flex-shrink-0`}>
          {/* Column group tabs */}
          <div className="flex items-center gap-1">
            <span className={`text-xs mr-2 ${t.textFaint}`}>View:</span>
            {COL_GROUPS.map((g) => (
              <button key={g.id} onClick={() => { setActiveGroup(g.id); setPage(1) }}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  activeGroup === g.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : `${t.border} ${t.textMuted} hover:opacity-80`}`}>
                {g.label}
              </button>
            ))}
          </div>
          {/* Result filter */}
          <div className="flex items-center gap-1">
            <span className={`text-xs mr-2 ${t.textFaint}`}>Filter:</span>
            {filters.map((f) => (
              <button key={f} onClick={() => { setFilter(f); setPage(1) }}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  filter === f
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : `${t.border} ${t.textMuted} hover:opacity-80`}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-auto" ref={tableRef}>
          <table className="w-full text-xs min-w-max">
            <thead className={`${t.tableHead} sticky top-0 z-10`}>
              <tr>
                {visibleCols.map((col) => (
                  <th key={col.key}
                    className={`text-left px-3 py-2.5 font-medium whitespace-nowrap border-b border-r ${t.border} ${t.textMuted}`}
                    style={{ minWidth: `${col.width * 7}px` }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, ri) => (
                <tr key={ri} className={`border-b ${t.border} ${t.cardHover} transition-colors`}>
                  {visibleCols.map((col) => (
                    <td key={col.key}
                      className={`px-3 py-2.5 border-r ${t.border} font-mono ${
                        col.key === '#' ? `text-center ${t.textFaint}` : t.textSub
                      }`}>
                      <CellContent colKey={col.key} value={row[col.key]} />
                    </td>
                  ))}
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length} className={`py-12 text-center ${t.textFaint}`}>
                    No rows match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex-shrink-0">
          <Pagination page={page} total={filtered.length} onPage={setPage} />
        </div>

      </div>
    </div>
  )
}
