/**
 * exportXlsx.js
 * Exports DR Drill report rows to a styled Excel workbook using SheetJS (xlsx).
 * Matches the green-header style of the reference DR Drill Summary template.
 */
import * as XLSX from 'xlsx'
import { REPORT_COLUMNS } from './reportBuilder'

// ── Brand colours (matching the reference Excel) ─────────────────────────────
const HEADER_FILL   = { fgColor: { rgb: '2D5F2D' } }   // dark green header
const HEADER_FONT   = { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 }
const PASS_FILL     = { fgColor: { rgb: 'C6EFCE' } }
const FAIL_FILL     = { fgColor: { rgb: 'FFC7CE' } }
const RISK_FILL     = { fgColor: { rgb: 'FFEB9C' } }
const PROG_FILL     = { fgColor: { rgb: 'DDEBF7' } }
const ALT_ROW_FILL  = { fgColor: { rgb: 'F2F8F2' } }
const BORDER_THIN   = { style: 'thin', color: { rgb: 'AAAAAA' } }
const CELL_BORDER   = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
const CENTER_ALIGN  = { horizontal: 'center', vertical: 'center', wrapText: true }
const LEFT_ALIGN    = { horizontal: 'left',   vertical: 'center', wrapText: true }

function resultFill(result) {
  switch (result) {
    case 'PASS':        return PASS_FILL
    case 'FAIL':        return FAIL_FILL
    case 'IN PROGRESS': return PROG_FILL
    default:            return null
  }
}

function slaFill(status) {
  switch (status) {
    case 'Met':       return PASS_FILL
    case 'On Track':  return PASS_FILL
    case 'At Risk':   return RISK_FILL
    case 'Missed':
    case 'Breached':  return FAIL_FILL
    default:          return null
  }
}

// Build a styled cell
function cell(v, opts = {}) {
  return {
    v: v ?? '',
    t: typeof v === 'number' ? 'n' : 's',
    s: {
      font:      opts.font      ?? { sz: 9 },
      fill:      opts.fill      ?? { fgColor: { rgb: 'FFFFFF' } },
      alignment: opts.alignment ?? LEFT_ALIGN,
      border:    CELL_BORDER,
    },
  }
}

export function exportDrillReportXlsx(rows, filename) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: DR Drill Summary ──────────────────────────────────────────────
  const ws = {}
  const keys = REPORT_COLUMNS.map((c) => c.key)

  // Row 1: Title merge
  const titleText = `DR Drill Summary Report — Generated ${new Date().toLocaleString('en-GB')}`
  ws['A1'] = {
    v: titleText, t: 's',
    s: {
      font:      { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill:      HEADER_FILL,
      alignment: CENTER_ALIGN,
      border:    CELL_BORDER,
    },
  }
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: keys.length - 1 } }]

  // Row 2: Column headers
  keys.forEach((key, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 1, c: ci })
    const col  = REPORT_COLUMNS.find((c) => c.key === key)
    ws[addr] = {
      v: col?.label ?? key, t: 's',
      s: {
        font:      HEADER_FONT,
        fill:      HEADER_FILL,
        alignment: CENTER_ALIGN,
        border:    CELL_BORDER,
      },
    }
  })

  // Data rows (start at row index 2 = Excel row 3)
  rows.forEach((row, ri) => {
    const isAlt = ri % 2 === 1
    keys.forEach((key, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci })
      const v    = row[key] ?? ''

      // Pick cell fill based on column + value
      let fill = isAlt ? ALT_ROW_FILL : { fgColor: { rgb: 'FFFFFF' } }
      if (key === 'Overall Result') fill = resultFill(v) ?? fill
      if (key === 'SLA Status')     fill = slaFill(v)    ?? fill
      if (key === 'Failover / Failback') {
        if (v === 'Switchover') fill = { fgColor: { rgb: 'DDEEFF' } }
        if (v === 'Switchback') fill = { fgColor: { rgb: 'EEE0FF' } }
        if (v === 'Readiness')  fill = { fgColor: { rgb: 'E0F5E9' } }
      }

      ws[addr] = cell(v, { fill, alignment: key === '#' ? CENTER_ALIGN : LEFT_ALIGN })
    })
  })

  // Column widths
  ws['!cols'] = REPORT_COLUMNS.map((c) => ({ wch: c.width }))

  // Freeze top 2 rows + first column
  ws['!freeze'] = { xSplit: 1, ySplit: 2 }

  // Sheet range
  const lastCell = XLSX.utils.encode_cell({ r: rows.length + 1, c: keys.length - 1 })
  ws['!ref'] = `A1:${lastCell}`

  XLSX.utils.book_append_sheet(wb, ws, 'DR Drill Summary')

  // ── Sheet 2: RTO Analysis ──────────────────────────────────────────────────
  const rtoWs = {}
  const rtoCols = [
    { key: 'Application Name',  label: 'Application',    width: 22 },
    { key: 'Failover / Failback', label: 'Phase',        width: 14 },
    { key: 'RTO Agreed (Hours)', label: 'RTO Target (Hrs)', width: 14 },
    { key: 'RTO Agreed (Min)',   label: 'RTO Target (Min)', width: 14 },
    { key: 'Test Duration',      label: 'Actual Duration', width: 14 },
    { key: 'Overall Downtime',   label: 'Downtime',        width: 14 },
    { key: 'SLA Status',         label: 'SLA Status',      width: 14 },
    { key: 'Overall Result',     label: 'Result',          width: 14 },
  ]
  rtoWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: rtoCols.length - 1 } }]
  rtoWs['A1'] = {
    v: 'RTO Analysis — Agreed vs Actual', t: 's',
    s: { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } }, fill: HEADER_FILL, alignment: CENTER_ALIGN, border: CELL_BORDER },
  }
  rtoCols.forEach(({ label }, ci) => {
    const addr = XLSX.utils.encode_cell({ r: 1, c: ci })
    rtoWs[addr] = { v: label, t: 's', s: { font: HEADER_FONT, fill: HEADER_FILL, alignment: CENTER_ALIGN, border: CELL_BORDER } }
  })
  rows.forEach((row, ri) => {
    const isAlt = ri % 2 === 1
    rtoCols.forEach(({ key }, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci })
      const v    = row[key] ?? ''
      let fill = isAlt ? ALT_ROW_FILL : { fgColor: { rgb: 'FFFFFF' } }
      if (key === 'SLA Status')    fill = slaFill(v)    ?? fill
      if (key === 'Overall Result') fill = resultFill(v) ?? fill
      rtoWs[addr] = cell(v, { fill })
    })
  })
  rtoWs['!cols'] = rtoCols.map((c) => ({ wch: c.width }))
  rtoWs['!ref']  = `A1:${XLSX.utils.encode_cell({ r: rows.length + 1, c: rtoCols.length - 1 })}`
  XLSX.utils.book_append_sheet(wb, rtoWs, 'RTO Analysis')

  // ── Write file ────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, filename || `DR_Drill_Report_${ts}.xlsx`)
}

// ── CSV export (lightweight fallback) ────────────────────────────────────────

export function exportDrillReportCsv(rows, filename) {
  const headers = REPORT_COLUMNS.map((c) => `"${c.label}"`)
  const dataRows = rows.map((row) =>
    REPORT_COLUMNS.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const csv = [headers.join(','), ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename || `DR_Drill_Report_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
