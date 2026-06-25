import { formatMoneyBR } from '../../lib/apolices'

export default function CalendarioAno({ cells, mesSelecionado, onSelectMes }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cells.map(c => {
        const ativo = c.mesNum === mesSelecionado
        return (
          <button
            key={c.mes}
            onClick={() => onSelectMes(c.mesNum)}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              ativo
                ? 'border-brand-secondary bg-brand-secondary/10'
                : 'border-dark-border/70 bg-dark-surface2/40 hover:border-dark-border'
            }`}
          >
            <p className={`text-xs font-semibold ${ativo ? 'text-brand-accent' : 'text-dark-muted'}`}>{c.label}</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{formatMoneyBR(c.producao)}</p>
            <p className="text-[11px] text-dark-muted">{c.qtd} apólice{c.qtd !== 1 ? 's' : ''}</p>
          </button>
        )
      })}
    </div>
  )
}
