import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, Check, Search, X } from 'lucide-react'
import { getEntityImageUrl } from '../../lib/entityMedia'

/**
 * WorkspacesSelect - dropdown premium com avatar circle + label.
 * Inspirado no sshahaider/workspaces, adaptado para o design glass do sistema.
 *
 * Props:
 *   value        - valor selecionado (string)
 *   onChange     - (string) => void
 *   options      - [{ value, label, sublabel?, color?, initials?, icon? }]
 *   placeholder  - texto quando nenhum selecionado
 *   label        - título do cabeçalho do dropdown
 *   disabled     - boolean
 *   className    - classes adicionais no wrapper
 *   clearable    - permite limpar seleção
 *   searchable   - força busca (auto-ativa se > 8 opções)
 *   emptyText    - texto quando sem opções
 */
export function WorkspacesSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Selecionar...',
  label,
  disabled = false,
  className = '',
  clearable = false,
  searchable,
  emptyText = 'Nenhuma opção',
}) {
  const [open,   setOpen]   = useState(false)
  const [pos,    setPos]    = useState(null)
  const [search, setSearch] = useState('')
  const wrapRef   = useRef(null)
  const searchRef = useRef(null)
  const dropRef   = useRef(null)

  const showSearch = searchable ?? options.length > 8

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const selected = options.find(o => String(o.value) === String(value))

  // Posicionamento com flip
  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect     = wrapRef.current.getBoundingClientRect()
    const itemH    = 44
    const headH    = label ? 38 : 0
    const srchH    = showSearch ? 48 : 0
    const dropH    = Math.min(filtered.length * itemH + headH + srchH + 12, 340)
    const below    = window.innerHeight - rect.bottom - 8
    const above    = rect.top - 8
    const flipUp   = below < dropH && above > below
    const minW     = Math.max(rect.width, 200)
    const left     = Math.max(8, Math.min(rect.left, window.innerWidth - minW - 8))
    setPos({
      left,
      width: minW,
      ...(flipUp
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

  useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open, showSearch])

  useEffect(() => { if (open) calcPos() }, [search, open, calcPos])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function select(val) { onChange(val); setOpen(false) }

  // Avatar: prioridade â†’ color prop â†’ hash da string
  function avatarColor(opt) {
    if (opt?.color) return opt.color
    const palette = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8','#EF4444']
    const str = opt?.label || ''
    let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
    return palette[Math.abs(h) % palette.length]
  }

  function avatarInitials(opt) {
    if (opt?.initials) return opt.initials
    return (opt?.label || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  }

  function avatarSource(opt) {
    if (opt?.icon) return { type: 'icon', value: opt.icon }
    const src = getEntityImageUrl(opt?.imagePath || opt?.image_path || null, opt?.imageUrl || opt?.image_url || null)
    if (src) return { type: 'image', value: src }
    return { type: 'initials', value: avatarInitials(opt) }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="ws-trigger w-full"
        style={{
          opacity:    disabled ? 0.45 : 1,
          cursor:     disabled ? 'not-allowed' : 'pointer',
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
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Avatar circle */}
          {selected ? (
            avatarSource(selected).type === 'icon' ? (
              <span className="ws-avatar-icon flex-shrink-0">{selected.icon}</span>
            ) : avatarSource(selected).type === 'image' ? (
              <span className="ws-avatar flex-shrink-0 overflow-hidden bg-dark-surface/90 border border-dark-border/40">
                <img
                  src={avatarSource(selected).value}
                  alt={selected.label}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </span>
            ) : (
              <span
                className="ws-avatar flex-shrink-0"
                style={{ background: avatarColor(selected) }}
              >
                {avatarInitials(selected)}
              </span>
            )
          ) : (
            <span className="ws-avatar-empty flex-shrink-0" />
          )}

          {/* Label */}
          <div className="flex-1 min-w-0 text-left">
            <span
              className="text-sm truncate block"
              style={{ color: selected ? 'var(--glass-text-primary)' : 'var(--glass-text-muted)' }}
            >
              {selected ? selected.label : placeholder}
            </span>
            {selected?.sublabel && (
              <span className="text-[10px] text-dark-muted block truncate leading-none mt-0.5">
                {selected.sublabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Clear button */}
          {clearable && value && (
            <span
              role="button"
              tabIndex={-1}
              onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="p-0.5 rounded text-dark-muted hover:text-dark-text transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronsUpDown
            className="w-3.5 h-3.5"
            style={{
              color:     'var(--glass-text-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </button>

      {/* Dropdown */}
      {open && pos && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            zIndex:   9999,
            left:     pos.left,
            width:    pos.width,
            ...(pos.top !== 'auto' ? { top: pos.top } : { bottom: pos.bottom }),
          }}
        >
          <div
            className="ws-dropdown animate-fade-in"
            style={{
              background:           'var(--glass-bg-heavy)',
              backdropFilter:       'var(--glass-blur-strong)',
              WebkitBackdropFilter: 'var(--glass-blur-strong)',
              border:               '1px solid var(--glass-border)',
              borderRadius:         12,
              boxShadow:            '0 24px 64px rgba(0,0,0,0.32), 0 8px 24px rgba(20,60,140,0.16)',
              overflow:             'hidden',
            }}
          >
            {/* Header */}
            {label && (
              <div
                style={{
                  padding:      '8px 12px 6px',
                  borderBottom: '1px solid var(--glass-border)',
                }}
              >
                <p style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--glass-text-muted)',
                }}>
                  {label}
                </p>
              </div>
            )}

            {/* Search */}
            {showSearch && (
              <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{
                    position: 'absolute', left: 9, top: '50%',
                    transform: 'translateY(-50%)', width: 12, height: 12,
                    color: 'var(--glass-text-muted)', pointerEvents: 'none',
                  }} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                    style={{
                      width: '100%',
                      paddingLeft: 28, paddingRight: 8,
                      paddingTop: 6, paddingBottom: 6,
                      fontSize: 12,
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 7,
                      color: 'var(--glass-text-primary)',
                      outline: 'none',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(74,144,217,0.55)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--glass-border)' }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px' }}>
              {filtered.length === 0 ? (
                <p style={{
                  margin: 0, fontSize: 12, textAlign: 'center',
                  padding: '16px 12px', color: 'var(--glass-text-muted)',
                }}>
                  {search ? 'Nenhum resultado' : emptyText}
                </p>
              ) : filtered.map(opt => {
              const isSel = String(opt.value) === String(value)
                const avatar = avatarSource(opt)
                return (
                  <WorkspaceItem
                    key={opt.value}
                    opt={opt}
                    isSelected={isSel}
                    onSelect={select}
                    color={avatarColor(opt)}
                    initials={avatarInitials(opt)}
                    avatar={avatar}
                  />
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// Item individual
function WorkspaceItem({ opt, isSelected, onSelect, color, initials, avatar }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onSelect(opt.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: isSelected
          ? 'rgba(74,144,217,0.12)'
          : hovered ? 'var(--glass-bg-hover)' : 'transparent',
        transition: 'background 0.1s ease',
      }}
      >
      {/* Avatar */}
      {avatar?.type === 'icon' ? (
        <span className="ws-avatar-icon-sm flex-shrink-0">{opt.icon}</span>
      ) : avatar?.type === 'image' ? (
        <span className="ws-avatar-sm flex-shrink-0 overflow-hidden bg-dark-surface/90 border border-dark-border/40">
          <img
            src={avatar.value}
            alt={opt.label}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : (
        <span
          className="ws-avatar-sm flex-shrink-0"
          style={{ background: color }}
        >
          {initials}
        </span>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? 'rgb(74,144,217)' : 'var(--glass-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {opt.label}
        </p>
        {opt.sublabel && (
          <p style={{
            margin: 0, fontSize: 10,
            color: 'var(--glass-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {opt.sublabel}
          </p>
        )}
      </div>

      {/* Checkmark */}
      {isSelected && (
        <Check style={{ width: 13, height: 13, color: 'rgb(74,144,217)', flexShrink: 0 }} />
      )}
    </button>
  )
}

