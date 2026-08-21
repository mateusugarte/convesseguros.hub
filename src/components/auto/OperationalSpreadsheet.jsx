import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

function comparable(value) {
  return value === null || value === undefined ? '' : String(value)
}

function SpreadsheetCell({ row, rowIndex, column, columnIndex, onCommit, onPasteMatrix }) {
  const rawValue = column.getValue ? column.getValue(row) : row[column.field]
  const [draft, setDraft] = useState(comparable(rawValue))

  useEffect(() => setDraft(comparable(rawValue)), [rawValue])

  const commit = () => {
    if (draft === comparable(rawValue)) return
    onCommit(row, column, column.parse ? column.parse(draft) : draft)
  }

  const focusCell = (nextRow, nextColumn) => {
    const target = document.querySelector(`[data-ops-row="${nextRow}"][data-ops-column="${nextColumn}"]`)
    target?.focus()
    target?.select?.()
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      focusCell(rowIndex + (event.shiftKey ? -1 : 1), columnIndex)
    } else if (event.key === 'ArrowUp' && !event.shiftKey) {
      event.preventDefault()
      commit()
      focusCell(rowIndex - 1, columnIndex)
    } else if (event.key === 'ArrowDown' && !event.shiftKey) {
      event.preventDefault()
      commit()
      focusCell(rowIndex + 1, columnIndex)
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
}) {
  const wrapRef = useRef(null)

  const pasteMatrix = (startRow, startColumn, text) => {
    const matrix = text.replace(/\r/g, '').split('\n').filter((line, index, all) => line || index < all.length - 1).map(line => line.split('\t'))
    const changes = []
    matrix.forEach((cells, rowOffset) => {
      const row = rows[startRow + rowOffset]
      if (!row) return
      let cursor = startColumn
      cells.forEach(value => {
        while (cursor < columns.length && !columns[cursor].editable) cursor += 1
        const column = columns[cursor]
        if (!column) return
        changes.push({ row, column, value: column.parse ? column.parse(value) : value })
        cursor += 1
      })
    })
    if (changes.length) onBulkCommit?.(changes)
  }

  return (
    <div ref={wrapRef} className={`ops-sheet-wrap ${className}`}>
      <table className="ops-sheet" role="grid">
        <thead>
          <tr>
            <th className="ops-sheet-row-number" aria-label="Número da linha">#</th>
            {columns.map(column => (
              <th key={column.key || column.field} style={{ width: column.width, minWidth: column.width }} className={column.sticky ? 'is-sticky' : ''}>
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
            <tr key={getRowId(row)}>
              <th className="ops-sheet-row-number" scope="row">{rowIndex + 1}</th>
              {columns.map((column, columnIndex) => (
                <td key={column.key || column.field} className={`${column.sticky ? 'is-sticky' : ''} ${column.className || ''}`}>
                  <SpreadsheetCell
                    row={row}
                    rowIndex={rowIndex}
                    column={column}
                    columnIndex={columnIndex}
                    onCommit={onCommit}
                    onPasteMatrix={pasteMatrix}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
