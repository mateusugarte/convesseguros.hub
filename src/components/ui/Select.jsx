import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

/**
 * Select premium - dropdown position:fixed com flip automatico e deteccao de borda.
 *
 * Props:
 *   value        - valor selecionado
 *   onChange     - (value) => void
 *   options      - [{ value, label }] | string[]
 *   placeholder  - texto quando nenhum valor selecionado
 *   disabled     - boolean
 *   className    - classes adicionais no wrapper
 *   name         - atributo name (para forms)
 *   searchable   - habilita campo de busca interno (auto-ativa se > 8 opcoes)
 *   label        - titulo exibido no cabecalho do dropdown
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Selecionar...',
  disabled = false,
  className = '',
  name,
  searchable,
  label,
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [search, setSearch] = useState('')
  const wrapRef = useRef(null)
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const dropRef = useRef(null)

  const normalized = options.map(o => (
    typeof o === 'string' ? { value: o, label: o } : o
  ))

  const showSearch = searchable ?? normalized.length > 8

  const filtered = search.trim()
    ? normalized.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : normalized

  const selected = normalized.find(o => String(o.value) === String(value))

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return

    const rect = wrapRef.current.getBoundingClientRect()
    const itemH = 38
    const headerH = label ? 44 : 0
    const searchH = showSearch ? 52 : 0
    const dropH = Math.min(filtered.length * itemH + headerH + searchH + 16, 320)
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const above = spaceBelow < dropH && spaceAbove > spaceBelow
    const minW = Math.max(rect.width, 180)
    const clampedLeft = Math.min(rect.left, window.innerWidth - minW - 8)
    const left = Math.max(8, clampedLeft)

    setPos({
      left,
      width: minW,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    })
  }, [filtered.length, label, showSearch])

  useEffect(() => {
    if (!open) {
      setPos(null)
      setSearch('')
      return
    }

    calcPos()
    const opts = { passive: true }
    window.addEventListener('resize', calcPos, opts)
    window.addEventListener('scroll', calcPos, { ...opts, capture: true })

    return () => {
      window.removeEventListener('resize', calcPos)
      window.removeEventListener('scroll', calcPos, true)
    }
  }, [open, calcPos])

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open, showSearch])

  useEffect(() => {
    if (open) calcPos()
  }, [search, open, calcPos])

  useEffect(() => {
    if (!open) return

    function handler(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        wrapRef.current?.querySelector('button')?.focus()
        return
      }
      if (!wrapRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [open])

  function select(val) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`system-select relative ${className}`}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`select system-select-trigger w-full flex items-center justify-between gap-2 text-left ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`system-select-value flex-1 truncate text-sm leading-none ${selected ? 'has-value' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="system-select-chevron w-4 h-4 flex-shrink-0" />
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            zIndex: 12000,
            left: pos.left,
            width: pos.width,
            ...(pos.top !== 'auto' ? { top: pos.top } : { bottom: pos.bottom }),
          }}
        >
          <div className="select-dropdown-panel">
            {label && (
              <div className="select-dropdown-heading">
                <p>{label}</p>
              </div>
            )}

            {showSearch && (
              <div className="select-dropdown-search-wrap">
                <div className="select-dropdown-search">
                  <Search />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                  />
                </div>
              </div>
            )}

            <div ref={listRef} className="select-dropdown-list" role="listbox">
              {filtered.length === 0 ? (
                <p className="select-dropdown-empty">
                  {search ? 'Nenhum resultado' : 'Sem opcoes'}
                </p>
              ) : (
                filtered.map(opt => {
                  const isSel = String(opt.value) === String(value)
                  return (
                    <SelectOption
                      key={opt.value}
                      opt={opt}
                      isSelected={isSel}
                      onSelect={select}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function SelectOption({ opt, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(opt.value)}
      className={`select-dropdown-option ${isSelected ? 'is-selected' : ''}`}
      role="option"
      aria-selected={isSelected}
    >
      <span className="select-dropdown-check">
        {isSelected && <Check />}
      </span>

      <span className="select-dropdown-option-label">
        {opt.label}
      </span>

      {isSelected && <span className="select-dropdown-indicator" />}
    </button>
  )
}
