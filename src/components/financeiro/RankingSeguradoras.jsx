import SeguradoraBadge from '../SeguradoraBadge'
import { formatMoneyBR } from '../../lib/apolices'

// Ranking de seguradoras (logo + nome + valor), ordenado desc por valor.
// data: [{ seguradora, value, qtd? }]
const MEDALHA = ['text-amber-400', 'text-slate-300', 'text-orange-400']

export default function RankingSeguradoras({ data = [], emptyLabel = 'Sem dados no período' }) {
  const lista = [...data].filter(d => Number(d.value) > 0).sort((a, b) => b.value - a.value)
  if (!lista.length) return <div className="py-8 text-center text-sm text-dark-muted">{emptyLabel}</div>
  const max = Math.max(...lista.map(d => Number(d.value) || 0))

  return (
    <div className="space-y-2">
      {lista.map((d, i) => {
        const pct = max > 0 ? Math.max(6, Math.round((Number(d.value) / max) * 100)) : 0
        return (
          <div key={d.seguradora} className="relative overflow-hidden rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-2.5">
            <div className="absolute inset-y-0 left-0 bg-brand-secondary/10" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`w-5 text-center text-sm font-bold ${MEDALHA[i] || 'text-dark-muted'}`}>{i + 1}</span>
                <SeguradoraBadge nome={d.seguradora} size="md" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(d.value)}</p>
                {d.qtd != null && <p className="text-[11px] text-dark-muted">{d.qtd} apólice{d.qtd !== 1 ? 's' : ''}</p>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
