import SeguradoraBadge from '../SeguradoraBadge'
import { formatMoneyBR } from '../../lib/apolices'

// Gráfico de barras horizontais por seguradora (logo + nome + barra proporcional + valor).
// data: [{ seguradora, value, qtd? }]
export default function SeguradoraBarChart({ data = [], color = 'bg-brand-secondary', emptyLabel = 'Sem dados no período' }) {
  const lista = [...data].filter(d => Number(d.value) > 0).sort((a, b) => b.value - a.value)
  const max = lista.length ? Math.max(...lista.map(d => Number(d.value) || 0)) : 0

  if (!lista.length || max <= 0) {
    return <div className="py-8 text-center text-sm text-dark-muted">{emptyLabel}</div>
  }

  return (
    <div className="space-y-3">
      {lista.map(d => {
        const pct = max > 0 ? Math.max(4, Math.round((Number(d.value) / max) * 100)) : 0
        return (
          <div key={d.seguradora} className="flex items-center gap-3">
            <div className="w-28 shrink-0 sm:w-36">
              <SeguradoraBadge nome={d.seguradora} size="sm" />
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-dark-surface2/60">
              <div className={`h-full rounded-lg ${color} transition-all`} style={{ width: `${pct}%` }} />
              {d.qtd != null && (
                <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-white/80">
                  {d.qtd} apólice{d.qtd !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="w-24 shrink-0 text-right font-mono text-xs text-dark-text sm:w-28">
              {formatMoneyBR(d.value)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
