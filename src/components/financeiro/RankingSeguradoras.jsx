import SeguradoraBadge from '../SeguradoraBadge'
import { formatMoneyBR } from '../../lib/apolices'

// Ranking de seguradoras (logo + nome + valor), ordenado desc por valor.
// data: [{ seguradora, value, qtd? }]
export default function RankingSeguradoras({ data = [], emptyLabel = 'Sem dados no período' }) {
  const lista = [...data].filter(d => Number(d.value) > 0).sort((a, b) => b.value - a.value)
  if (!lista.length) return <div className="py-8 text-center text-sm text-dark-muted">{emptyLabel}</div>

  return (
    <div className="space-y-2">
      {lista.map((d, i) => (
        <div key={d.seguradora} className="flex items-center justify-between gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-5 text-center text-sm font-bold text-dark-muted">{i + 1}</span>
            <SeguradoraBadge nome={d.seguradora} size="md" />
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(d.value)}</p>
            {d.qtd != null && <p className="text-[11px] text-dark-muted">{d.qtd} apólice{d.qtd !== 1 ? 's' : ''}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
