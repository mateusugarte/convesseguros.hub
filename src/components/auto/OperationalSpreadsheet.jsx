import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Rows3 } from 'lucide-react'

function comparable(value) {
  return value === null || value === undefined ? '' : String(value)
}

function normalizePastedDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const brazilian = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
  if (brazilian) {
    const year = brazilian[3].length === 2 ? `20${brazilian[3]}` : brazilian[3]
    return `${year}-${brazilian[2].padStart(2, '0')}-${brazilian[1].padStart(2, '0')}`
  }
  if (/^\d{5}$/.test(raw)) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    return new Date(excelEpoch + Number(raw) * 86400000).toISOString().slice(0, 10)
  }
  return raw
}

function normalizePastedNumber(value) {
  const raw = String(value || '').trim().replace(/\s/g, '')
  if (!raw) return ''
  if (raw.includes(',')) return raw.replace(/\./g, '').replace(',', '.').replace('%', '')
  return raw.replace('%', '')
}

function parsePastedValue(column, value) {
  let normalized = value
  if (column.parsePaste) return column.parsePaste(value)
  if (column.type === 'date') normalized = normalizePastedDate(value)
  if (column.type === 'number') normalized = normalizePastedNumber(value)
  return column.parse ? column.parse(normalized) : normalized
}

function SpreadsheetCell({ row, rowIndex, column, columnIndex, onCommit, onPasteMatrix, onActivate }) {
  const rawValue = column.getValue ? column.getValue(row) : row[column.field]
  const [draft, setDraft] = useState(comparable(rawValue))

  useEffect(() => setDraft(comparable(rawValue)), [rawValue])

  const commit = () => {
    if (draft === comparable(rawValue)) return
    onCommit(row, column, column.parse ? column.parse(draft) : draft)
  }

  const focusCell = (origin, nextRow, nextColumn) => {
    const target = origin.closest('.ops-sheet-wrap')?.querySelector(`[data-ops-row="${nextRow}"][data-ops-column="${nextColumn}"]`)
    target?.focus()
    target?.select?.()
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      focusCell(event.currentTarget, rowIndex + (event.shiftKey ? -1 : 1), columnIndex)
    } else if (event.key === 'ArrowUp' && !event.shiftKey) {
      event.preventDefault()
      commit()
      focusCell(event.currentTarget, rowIndex - 1, columnIndex)
    } else if (event.key === 'ArrowDown' && !event.shiftKey) {
      event.preventDefault()
      commit()
      focusCell(event.currentTarget, rowIndex + 1, columnIndex)
    }
  }

  const handlePaste = event => {
    const text = event.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return
    event.preventDefault()
    onPasteMatrix(rowIndex, columnIndex, text)
  }

  if (column.render) return column.render(row, { rowIndex, columnIndex })
  if (!column.editable) return column.format ? column.format(rawValue, row) : (rawValue || '—')

  const common = {
    'data-ops-row': rowIndex,
    'data-ops-column': columnIndex,
    value: draft,
    'aria-label': `${column.label} da linha ${rowIndex + 1}`,
    onChange: event => setDraft(event.target.value),
    onBlur: commit,
    onFocus: () => onActivate(rowIndex, columnIndex),
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
  }

  if (column.type === 'select') {
    return (
      <select {...common} onChange={event => { setDraft(event.target.value); onCommit(row, column, column.parse ? column.parse(event.target.value) : event.target.value) }}>
        {(column.options || []).map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    )
  }
  if (column.type === 'textarea') return <textarea {...common} rows="1" placeholder={column.placeholder} />
  return <input {...common} type={column.type || 'text'} step={column.step} min={column.min} max={column.max} placeholder={column.placeholder} />
}

export default function OperationalSpreadsheet({
  rows,
  columns,
  getRowId = row => row.id,
  onCommit,
  onBulkCommit,
  sort,
  onSort,
  className = '',
  emptyMessage = 'Nenhuma linha para exibir.',
  statusLabel = 'Salvamento automático',
}) {
  const wrapRef = useRef(null)
  const [activeCell, setActiveCell] = useState(null)
  const [density, setDensity] = useState('compact')

  const pasteMatrix = (startRow, startColumn, text) => {
    const matrix = text.replace(/\r/g, '').split('\n').filter((line, index, all) => line || index < all.length - 1).map(line => line.split('\t'))
    const changes = []
    matrix.forEach((cells, rowOffset) => {
      const row = rows[startRow + rowOffset]
      if (!row) return
      let cursor = startColumn
      cells.forEach(value => {
        let column = null
        while (cursor < columns.length) {
          const candidate = columns[cursor]
          cursor += 1
          if (candidate.editable) {
            column = candidate
            break
          }
          if (candidate.consumePaste) return
        }
        if (!column) return
        changes.push({ row, column, value: parsePastedValue(column, value) })
      })
    })
    if (changes.length) onBulkCommit?.(changes)
  }

  return (
    <div ref={wrapRef} className={`ops-sheet-wrap is-${density} ${className}`}>
      <table className="ops-sheet" role="grid">
        <thead>
          <tr>
            <th className="ops-sheet-row-number" aria-label="Número da linha">#</th>
            {columns.map(column => (
              <th key={column.key || column.field} style={{ width: column.width, minWidth: column.width, ...(column.sticky ? { left: 42 } : {}) }} className={column.sticky ? 'is-sticky' : ''}>
                <button type="button" disabled={!column.sortable || !onSort} onClick={() => onSort?.(column.field)}>
                  <span>{column.label}</span>
                  {column.sortable && (sort?.field === column.field
                    ? (sort.direction === 'asc' ? <ArrowUp /> : <ArrowDown />)
                    : <ChevronsUpDown />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="ops-sheet-empty" colSpan={columns.length + 1}>{emptyMessage}</td></tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={getRowId(row)} className={activeCell?.row === rowIndex ? 'is-active-row' : ''}>
              <th className="ops-sheet-row-number" scope="row" onClick={() => setActiveCell({ row: rowIndex, column: null })}>{rowIndex + 1}</th>
              {columns.map((column, columnIndex) => (
                <td key={column.key || column.field} style={column.sticky ? { left: 42 } : undefined} className={`${column.sticky ? 'is-sticky' : ''} ${activeCell?.row === rowIndex && activeCell?.column === columnIndex ? 'is-active-cell' : ''} ${column.className || ''}`}>
                  <SpreadsheetCell
                    row={row}
                    rowIndex={rowIndex}
                    column={column}
                    columnIndex={columnIndex}
                    onCommit={onCommit}
                    onPasteMatrix={pasteMatrix}
                    onActivate={(activeRow, activeColumn) => setActiveCell({ row: activeRow, column: activeColumn })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="ops-sheet-statusbar">
        <span><Rows3 />{rows.length} linha(s) · {columns.length} coluna(s) · {rows.length * columns.length} células visíveis</span>
        {activeCell && <span>Linha {activeCell.row + 1}{activeCell.column !== null ? ` · ${columns[activeCell.column]?.label}` : ''}</span>}
        <span className="is-save-status">{statusLabel}</span>
        <div role="group" aria-label="Densidade da planilha">
          <button className={density === 'compact' ? 'is-active' : ''} onClick={() => setDensity('compact')}>Compacta</button>
          <button className={density === 'comfortable' ? 'is-active' : ''} onClick={() => setDensity('comfortable')}>Confortável</button>
        </div>
      </footer>
    </div>
  )
}
