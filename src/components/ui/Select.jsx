import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

/**
 * Select premium — dropdown position:fixed com flip automático e detecção de borda.
 *
 * Props:
 *   value        — valor selecionado
 *   onChange     — (value) => void
 *   options      — [{ value, label }] | string[]
 *   placeholder  — texto quando nenhum valor selecionado
 *   disabled     — boolean
 *   className    — classes adicionais no wrapper
 *   name         — atributo name (para forms)
 *   searchable   — habilita campo de busca interno (auto-ativa se > 8 opções)
 *   label        — título exibido no cabeçalho do dropdown
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
  const [open,   setOpen]   = useState(false)
  const [pos,    setPos]    = useState(null)
  const [search, setSearch] = useState('')
  const wrapRef   = useRef(null)
  const searchRef = useRef(null)
  const listRef   = useRef(null)

  // Normaliza options para [{value, label}]
  const normalized = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )

  // Auto-ativa busca para listas longas
  const showSearch = searchable ?? normalized.length > 8

  const filtered = search.trim()
    ? normalized.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()),
      )
    : normalized

  const selected = normalized.find(o => String(o.value) === String(value))

  // ── Cálculo de posição com flip + clamp horizontal ──────────────────────────
  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect      = wrapRef.current.getBoundingClientRect()
    const itemH     = 38
    const headerH   = label ? 44 : 0
    const searchH   = showSearch ? 52 : 0
    const dropH     = Math.min(
      filtered.length * itemH + headerH + searchH + 16,
      320,
    )
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const above      = spaceBelow < dropH && spaceAbove > spaceBelow

    const minW = Math.max(rect.width, 180)
    // Clamp left: não ultrapassar a borda direita da viewport
    const clampedLeft = Math.min(rect.left, window.innerWidth - minW - 8)
    const left        = Math.max(8, clampedLeft)

    setPos({
      left,
      width: minW,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    })
  }, [filtered.length, label, showSearch])

  useEffect(() => {
    if (!open) { setPos(null); setSearch(''); return }
    calcPos()
    const opts = { passive: true }
    window.addEventListener('resize', calcPos, opts)
    window.addEventListener('scroll', calcPos, { ...opts, capture: true })
    return () => {
      window.removeEventListener('resize', calcPos)
      window.removeEventListener('scroll', calcPos, true)
    }
  }, [open, calcPos])

  // Foca o campo de busca ao abrir
  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open, showSearch])

  // Recalcula quando a busca filtra a lista (altura pode mudar)
  useEffect(() => {
    if (open) calcPos()
  }, [search, open, calcPos])

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(val) {
    onChange(val)
    setOpen(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="select w-full flex items-center justify-between gap-2 text-left"
        style={{
          opacity:    disabled ? 0.45 : 1,
          cursor:     disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
          ...(open ? {
            borderColor: 'rgb(var(--brand-primary-rgb) / 0.52)',
            boxShadow:   '0 0 0 3px rgb(var(--brand-primary-rgb) / 0.14)',
            background:  'var(--glass-bg-active)',
          } : {}),
        }}
        onMouseEnter={e => {
          if (!open && !disabled) {
            e.currentTarget.style.borderColor = 'rgb(var(--brand-primary-rgb) / 0.32)'
            e.currentTarget.style.background  = 'var(--glass-bg-hover)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = ''
            e.currentTarget.style.background  = ''
          }
        }}
      >
        <span
          className="flex-1 truncate text-sm leading-none"
          style={{
            color: selected
              ? 'var(--glass-text-primary)'
              : 'var(--glass-text-muted)',
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0"
          style={{
            color:     'var(--glass-text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s var(--ease-smooth)',
          }}
        />
      </button>

      {/* ── Dropdown portal ── */}
      {open && pos && (
        <div
          style={{
            position: 'fixed',
            zIndex:   9999,
            left:     pos.left,
            width:    pos.width,
            ...(pos.top !== 'auto'
              ? { top: pos.top }
              : { bottom: pos.bottom }),
          }}
        >
          <div
            className="select-dropdown-panel"
            style={{
              background:           'var(--glass-bg-heavy)',
              backdropFilter:       'var(--glass-blur-strong)',
              WebkitBackdropFilter: 'var(--glass-blur-strong)',
              border:               '1px solid var(--glass-border)',
              borderRadius:         12,
              boxShadow:            'var(--shadow-float)',
              overflow:             'hidden',
            }}
          >
            {/* Cabeçalho opcional */}
            {label && (
              <div
                style={{
                  padding:      '9px 12px 7px',
                  borderBottom: '1px solid var(--glass-border)',
                  background:   'var(--glass-bg)',
                }}
              >
                <p
                  style={{
                    margin:        0,
                    fontSize:      10,
                    fontWeight:    700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color:         'var(--glass-text-muted)',
                    fontFamily:    'var(--font-heading)',
                  }}
                >
                  {label}
                </p>
              </div>
            )}

            {/* Busca */}
            {showSearch && (
              <div
                style={{
                  padding:      '8px 8px 6px',
                  borderBottom: '1px solid var(--glass-border)',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Search
                    style={{
                      position:  'absolute',
                      left:      9,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                      width:     13,
                      height:    13,
                      color:     'var(--glass-text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                    style={{
                      width:       '100%',
                      paddingLeft: 30,
                      paddingRight: 8,
                      paddingTop:   6,
                      paddingBottom: 6,
                      fontSize:     12,
                      lineHeight:   '1.4',
                      background:   'var(--glass-bg)',
                      border:       '1px solid var(--glass-border)',
                      borderRadius: 7,
                      color:        'var(--glass-text-primary)',
                      outline:      'none',
                      transition:   'border-color 0.15s ease',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(74,144,217,0.55)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--glass-border)' }}
                  />
                </div>
              </div>
            )}

            {/* Lista de opções */}
            <div
              ref={listRef}
              style={{ overflowY: 'auto', maxHeight: 256, padding: '4px' }}
            >
              {filtered.length === 0 ? (
                <p
                  style={{
                    margin:    0,
                    fontSize:  12,
                    color:     'var(--glass-text-muted)',
                    textAlign: 'center',
                    padding:   '16px 12px',
                  }}
                >
                  {search ? 'Nenhum resultado' : 'Sem opções'}
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
        </div>
      )}
    </div>
  )
}

// Item separado para evitar re-criação de handlers em cada render
function SelectOption({ opt, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onSelect(opt.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:       '100%',
        display:     'flex',
        alignItems:  'center',
        gap:         8,
        padding:     '7px 10px',
        borderRadius: 8,
        border:      'none',
        cursor:      'pointer',
        textAlign:   'left',
        transition:  'background 0.1s ease',
        background:  isSelected
          ? 'rgba(74,144,217,0.14)'
          : hovered
            ? 'var(--glass-bg-hover)'
            : 'transparent',
        position: 'relative',
      }}
    >
      {/* Indicador de seleção */}
      <span
        style={{
          width:          16,
          height:         16,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}
      >
        {isSelected && (
          <Check
            style={{
              width:       13,
              height:      13,
              color:       'rgb(74,144,217)',
              strokeWidth: 2.5,
            }}
          />
        )}
      </span>

      {/* Label */}
      <span
        style={{
          flex:         1,
          fontSize:     13,
          fontWeight:   isSelected ? 500 : 400,
          color:        isSelected ? 'rgb(74,144,217)' : 'var(--glass-text-primary)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          lineHeight:   '1.4',
        }}
      >
        {opt.label}
      </span>

      {/* Barra lateral na selecionada */}
      {isSelected && (
        <span
          style={{
            position:     'absolute',
            left:         0,
            top:          '20%',
            bottom:       '20%',
            width:        2,
            borderRadius: 2,
            background:   'rgb(74,144,217)',
          }}
        />
      )}
    </button>
  )
}
