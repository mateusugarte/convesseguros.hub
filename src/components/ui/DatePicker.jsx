import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  const [draft,       setDraft]       = useState('')
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) { try { const d = parse(value, 'yyyy-MM-dd', new Date()); if (isValid(d)) return d } catch {} }
    return new Date()
  })
  const wrapRef = useRef(null)

  const selected = useMemo(() => {
    if (!value) return null
    try {
      const d = parse(value, 'yyyy-MM-dd', new Date())
      return isValid(d) ? d : null
    } catch {
      return null
    }
  }, [value])

  useEffect(() => {
    if (selected) {
      setDraft(format(selected, 'dd/MM/yyyy'))
      return
    }
    setDraft('')
  }, [selected])

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const rect  = wrapRef.current.getBoundingClientRect()
    const dropH = 380
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const flipUp = below < dropH && above > below
    const dropW = Math.min(320, window.innerWidth - 16)
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

  function selectDay(day) {
    const next = format(day, 'yyyy-MM-dd')
    setDraft(format(day, 'dd/MM/yyyy'))
    onChange(next)
    setOpen(false)
  }

  function commitDraft() {
    const normalized = draft.trim()
    if (!normalized) {
      onChange('')
      return
    }

    const candidates = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'd/M/yyyy']
    for (const pattern of candidates) {
      try {
        const d = parse(normalized, pattern, new Date())
        if (isValid(d)) {
          const next = format(d, 'yyyy-MM-dd')
          onChange(next)
          setDraft(format(d, 'dd/MM/yyyy'))
          setCurrentDate(d)
          return
        }
      } catch {}
    }
  }

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
    <div ref={wrapRef} className={`dp-root relative ${className}`}>
      <div
        className="dp-trigger w-full"
        style={{
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          ...(open ? {
            borderColor: 'rgb(var(--brand-primary-rgb) / 0.52)',
            boxShadow: '0 0 0 3px rgb(var(--brand-primary-rgb) / 0.14)',
            background: 'var(--glass-bg-active)',
          } : {}),
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-transparent text-dark-muted transition-colors hover:border-brand-accent/20 hover:text-dark-text"
          aria-label="Abrir calendario"
          aria-expanded={open}
        >
          <Calendar
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: selected ? 'rgb(var(--brand-primary-rgb))' : 'var(--glass-text-muted)' }}
          />
        </button>

        <input
          type="text"
          disabled={disabled}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={e => {
            if (e.key === 'Enter') commitDraft()
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') setOpen(true)
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dark-muted"
          style={{ color: selected ? 'var(--glass-text-primary)' : 'var(--glass-text-muted)' }}
        />

        {clearable && (selected || draft) && !disabled && (
          <button
            type="button"
            onClick={() => { setDraft(''); onChange('') }}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-dark-muted transition-colors hover:text-dark-text"
            aria-label="Limpar data"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

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
            className="dp-popover animate-fade-in"
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
            <div className="dp-calendar-header flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setCurrentDate(d => subMonths(d, 1))}
                className="dp-nav-btn"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="dp-month-label" style={{
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
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Week headers */}
            <div className="dp-weekdays grid grid-cols-7 mb-1.5">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((d, i) => (
                <div key={i} className="dp-weekday" style={{
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
            <div className="dp-days grid grid-cols-7 gap-y-0.5">
              {days.map((day, i) => {
                const inMonth = isSameMonth(day, currentDate)
                const isSel   = selected && isSameDay(day, selected)
                const isNow   = isToday(day)

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`dp-day${isSel ? ' is-selected' : ''}${isNow ? ' is-today' : ''}${!inMonth ? ' is-outside' : ''}`}
                    aria-label={format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    aria-pressed={Boolean(isSel)}
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
            <div className="dp-calendar-footer mt-3 pt-2.5 flex items-center justify-between"
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
