import { useState, useEffect, useRef, useCallback } from 'react'
import {
  format, parse, isValid, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameDay, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * DatePicker — calendar-style single date picker.
 * value: string 'YYYY-MM-DD' | onChange: (string) => void
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Selecionar data',
  disabled    = false,
  className   = '',
  clearable   = true,
}) {
  const [open,        setOpen]        = useState(false)
  const [pos,         setPos]         = useState(null)
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) { try { const d = parse(value, 'yyyy-MM-dd', new Date()); if (isValid(d)) return d } catch {} }
    return new Date()
  })
  const wrapRef = useRef(null)

  const selected = value
    ? (() => { try { const d = parse(value, 'yyyy-MM-dd', new Date()); return isValid(d) ? d : null } catch { return null } })()
    : null

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect  = wrapRef.current.getBoundingClientRect()
    const dropH = 310
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const flipUp = below < dropH && above > below
    const dropW = 280
    const left  = Math.max(8, Math.min(rect.left, window.innerWidth - dropW - 8))
    setPos({
      left, width: dropW,
      ...(flipUp
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
    if (value) {
      try { const d = parse(value, 'yyyy-MM-dd', new Date()); if (isValid(d)) setCurrentDate(d) } catch {}
    }
  }, [value])

  function selectDay(day) { onChange(format(day, 'yyyy-MM-dd')); setOpen(false) }

  function buildCalendarDays() {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentDate),   { weekStartsOn: 0 })
    const days  = []
    let d = start
    while (d <= end) { days.push(d); d = addDays(d, 1) }
    return days
  }

  const days = buildCalendarDays()

  return (
    <div ref={wrapRef} className={`relative ${className}`}>

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="dp-trigger w-full"
        style={{
          opacity: disabled ? 0.45 : 1,
          cursor:  disabled ? 'not-allowed' : 'pointer',
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
        <Calendar
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: selected ? 'rgb(74,144,217)' : 'var(--glass-text-muted)' }}
        />
        <span
          className="flex-1 text-left text-sm truncate"
          style={{ color: selected ? 'var(--glass-text-primary)' : 'var(--glass-text-muted)' }}
        >
          {selected
            ? format(selected, "dd 'de' MMM, yyyy", { locale: ptBR })
            : placeholder}
        </span>
        {clearable && selected && (
          <span
            role="button"
            tabIndex={-1}
            onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="flex-shrink-0 p-0.5 rounded text-dark-muted hover:text-dark-text transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Calendar popup */}
      {open && pos && (
        <div
          style={{
            position: 'fixed',
            zIndex:   9999,
            left:     pos.left,
            width:    pos.width,
            ...(pos.top !== 'auto' ? { top: pos.top } : { bottom: pos.bottom }),
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              background:           'var(--glass-bg-heavy)',
              backdropFilter:       'var(--glass-blur-strong)',
              WebkitBackdropFilter: 'var(--glass-blur-strong)',
              border:               '1px solid var(--glass-border)',
              borderRadius:         14,
              boxShadow:            '0 24px 64px rgba(0,0,0,0.32), 0 8px 24px rgba(20,60,140,0.16)',
              padding:              '14px',
            }}
          >
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setCurrentDate(d => subMonths(d, 1))}
                className="dp-nav-btn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: 'var(--glass-text-primary)',
                textTransform: 'capitalize',
              }}>
                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentDate(d => addMonths(d, 1))}
                className="dp-nav-btn"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Week headers */}
            <div className="grid grid-cols-7 mb-1.5">
              {['D','S','T','Q','Q','S','S'].map((d, i) => (
                <div key={i} style={{
                  textAlign: 'center', fontSize: 9, fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'var(--glass-text-muted)',
                  paddingBottom: 5,
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day, i) => {
                const inMonth = isSameMonth(day, currentDate)
                const isSel   = selected && isSameDay(day, selected)
                const isNow   = isToday(day)

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    className="dp-day"
                    style={{
                      opacity:    inMonth ? 1 : 0.25,
                      background: isSel
                        ? 'rgb(74,144,217)'
                        : isNow ? 'rgba(74,144,217,0.12)' : 'transparent',
                      color: isSel ? '#fff'
                        : isNow ? 'rgb(74,144,217)'
                        : 'var(--glass-text-primary)',
                      fontWeight:  isSel ? 700 : isNow ? 600 : 400,
                      borderRadius: 7,
                      border: isNow && !isSel
                        ? '1px solid rgba(74,144,217,0.40)'
                        : '1px solid transparent',
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Footer shortcuts */}
            <div className="mt-3 pt-2.5 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--glass-border)' }}>
              <button type="button" onClick={() => selectDay(new Date())} className="dp-footer-btn dp-footer-primary">
                Hoje
              </button>
              {selected && clearable && (
                <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="dp-footer-btn">
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
