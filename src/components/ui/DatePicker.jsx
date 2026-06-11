import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react'
import {
  format, isValid, isSameDay, isToday, isSameMonth,
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  addMonths, subMonths, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function parseDate(value) {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

function MonthGrid({ monthDate, selected, onSelect }) {
  const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
  const end   = endOfWeek(endOfMonth(monthDate),     { weekStartsOn: 0 })
  const days  = eachDayOfInterval({ start, end })

  return (
    <div style={{ width: 182 }}>
      <p style={{
        textAlign: 'center', fontSize: 11, fontWeight: 700,
        color: 'var(--glass-text-primary)', marginBottom: 8,
        textTransform: 'capitalize', letterSpacing: '0.03em',
      }}>
        {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DIAS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 9, fontWeight: 700,
            color: 'var(--glass-text-muted)', padding: '3px 0',
            letterSpacing: '0.08em',
          }}>
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, monthDate)
          const isSel   = selected && isSameDay(day, selected)
          const isNow   = isToday(day)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(day)}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 7,
                fontSize: 11,
                fontWeight:  isSel ? 700 : isNow ? 600 : 400,
                border:      isSel ? 'none' : isNow ? '1.5px solid rgba(74,144,217,0.55)' : '1.5px solid transparent',
                background:  isSel ? 'rgb(74,144,217)' : 'transparent',
                color:       isSel ? '#fff'
                           : !inMonth ? 'var(--glass-text-muted)'
                           : isNow ? 'rgb(74,144,217)'
                           : 'var(--glass-text-primary)',
                opacity:     !inMonth ? 0.3 : 1,
                cursor:      'pointer',
                transition:  'background 0.1s ease, color 0.1s ease',
              }}
              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.background = 'var(--glass-bg-hover)' } }}
              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.background = 'transparent' } }}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * DatePicker — dropdown calendar com 2 meses, posicionado via fixed (escapa stacking contexts).
 *
 * Props:
 *   value        — string YYYY-MM-DD
 *   onChange     — (value: string) => void  ('' para limpar)
 *   placeholder  — texto quando vazio
 *   disabled     — boolean
 *   className    — classes no wrapper
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecionar data',
  disabled    = false,
  className   = '',
}) {
  const [open,     setOpen]     = useState(false)
  const [pos,      setPos]      = useState(null)
  const [viewDate, setViewDate] = useState(() => parseDate(value) || new Date())
  const wrapRef = useRef(null)

  const selected = parseDate(value)

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect     = wrapRef.current.getBoundingClientRect()
    const dropW    = 420
    const dropH    = 300
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const spaceAbove = rect.top - 8
    const above    = spaceBelow < dropH && spaceAbove > spaceBelow
    const rawLeft  = rect.left
    const left     = Math.max(8, Math.min(rawLeft, window.innerWidth - dropW - 8))
    setPos({
      left,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4, top: 'auto' }
        : { top: rect.bottom + 4, bottom: 'auto' }),
    })
  }, [])

  useEffect(() => {
    if (!open) { setPos(null); return }
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
    if (!open) return
    function handler(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    const d = parseDate(value)
    if (d) setViewDate(d)
  }, [value])

  function handleSelect(day) {
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const displayValue = selected ? format(selected, "d 'de' MMM yyyy", { locale: ptBR }) : null

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="select w-full flex items-center gap-2 text-left"
        style={{
          opacity:    disabled ? 0.45 : 1,
          cursor:     disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
          ...(open ? {
            borderColor: 'rgba(74,144,217,0.65)',
            boxShadow:   '0 0 0 3px rgba(74,144,217,0.18)',
            background:  'var(--glass-bg-active)',
          } : {}),
        }}
        onMouseEnter={e => {
          if (!open && !disabled) {
            e.currentTarget.style.borderColor = 'rgba(74,144,217,0.38)'
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
        <Calendar style={{ width: 13, height: 13, color: 'var(--glass-text-muted)', flexShrink: 0 }} />
        <span
          className="flex-1 truncate text-sm leading-none"
          style={{ color: displayValue ? 'var(--glass-text-primary)' : 'var(--glass-text-muted)' }}
        >
          {displayValue || placeholder}
        </span>
        <ChevronDown style={{
          width: 14, height: 14, color: 'var(--glass-text-muted)', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s var(--ease-smooth)',
        }} />
      </button>

      {open && pos && (
        <div style={{
          position: 'fixed',
          zIndex:   9999,
          left:     pos.left,
          ...(pos.top !== 'auto' ? { top: pos.top } : { bottom: pos.bottom }),
        }}>
          <div
            className="select-dropdown-panel"
            style={{
              background:           'var(--glass-bg-heavy)',
              backdropFilter:       'var(--glass-blur-strong)',
              WebkitBackdropFilter: 'var(--glass-blur-strong)',
              border:               '1px solid var(--glass-border)',
              borderRadius:         16,
              boxShadow:            'var(--shadow-float)',
              padding:              '16px',
              userSelect:           'none',
              width:                420,
            }}
          >
            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setViewDate(d => subMonths(d, 1))}
                style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: '1px solid var(--glass-border)',
                  color: 'var(--glass-text-muted)', cursor: 'pointer', transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft style={{ width: 13, height: 13 }} />
              </button>

              <button
                type="button"
                onClick={() => setViewDate(new Date())}
                style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--glass-text-muted)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '4px 8px', borderRadius: 6,
                  transition: 'color 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgb(74,144,217)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--glass-text-muted)'}
              >
                Hoje
              </button>

              <button
                type="button"
                onClick={() => setViewDate(d => addMonths(d, 1))}
                style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: '1px solid var(--glass-border)',
                  color: 'var(--glass-text-muted)', cursor: 'pointer', transition: 'background 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronRight style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Two months side by side */}
            <div style={{ display: 'flex', gap: 20 }}>
              <MonthGrid monthDate={viewDate}             selected={selected} onSelect={handleSelect} />
              <MonthGrid monthDate={addMonths(viewDate, 1)} selected={selected} onSelect={handleSelect} />
            </div>

            {/* Clear */}
            {selected && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--glass-border)', paddingTop: 10, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false) }}
                  style={{
                    fontSize: 11, color: 'var(--glass-text-muted)', background: 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'color 0.1s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--glass-text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--glass-text-muted)'}
                >
                  Limpar data
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
