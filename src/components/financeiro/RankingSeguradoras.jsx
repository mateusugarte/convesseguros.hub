import SeguradoraBadge from '../SeguradoraBadge'
import { formatMoneyBR } from '../../lib/apolices'

const MEDALHA = ['text-amber-500', 'text-slate-400', 'text-orange-500']

export default function RankingSeguradoras({ data = [], emptyLabel = 'Sem dados no período' }) {
  const lista = [...data].filter(d => Number(d.value) > 0).sort((a, b) => b.value - a.value)
  if (!lista.length) return <div className="py-8 text-center text-sm text-dark-muted">{emptyLabel}</div>
  const max = Math.max(...lista.map(d => Number(d.value) || 0))

  return (
    <div className="space-y-2">
      {lista.map((d, i) => {
        const pct = max > 0 ? Math.max(8, Math.round((Number(d.value) / max) * 100)) : 0
        return (
          <div
            key={d.seguradora}
            className="relative overflow-hidden rounded-[22px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88))] px-4 py-3 shadow-[0_18px_44px_-34px_rgba(16,185,129,0.45)]"
          >
            <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.16),rgba(52,211,153,0.05))]" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`w-5 text-center text-sm font-bold ${MEDALHA[i] || 'text-emerald-900/45'}`}>{i + 1}</span>
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
