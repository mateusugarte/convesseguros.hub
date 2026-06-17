import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export default function CrmMetricCard({
  icon: Icon,
  label,
  value,
  accent = '#2563EB',
  change = null,
  changeLabel = 'vs período anterior',
  helper,
  badge,
  className = '',
}) {
  const positive = typeof change === 'number' && change > 0
  const negative = typeof change === 'number' && change < 0
  const neutral = change === 0

  return (
    <article
      className={cx(
        'relative overflow-hidden rounded-[24px] border border-dark-border/60 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}AA)` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-muted">{label}</span>
            {badge && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: accent, background: `${accent}16` }}>
                {badge}
              </span>
            )}
          </div>
          <p className="mt-3 truncate text-2xl font-black tracking-tight text-dark-text">{value}</p>
          {helper && <p className="mt-2 text-xs text-dark-muted">{helper}</p>}
        </div>
        {Icon && (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${accent}14`, color: accent }}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {typeof change === 'number' && (
        <div
          className={cx(
            'mt-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold',
            positive && 'bg-emerald-500/12 text-emerald-600',
            negative && 'bg-rose-500/12 text-rose-600',
            neutral && 'bg-slate-500/10 text-dark-muted'
          )}
        >
          {positive && <ArrowUpRight className="h-3.5 w-3.5" />}
          {negative && <ArrowDownRight className="h-3.5 w-3.5" />}
          {neutral && <Minus className="h-3.5 w-3.5" />}
          <span>
            {positive  '+' : ''}
            {change}% {changeLabel}
          </span>
        </div>
      )}
    </article>
  )
}
