import { useNavigate } from 'react-router-dom'
import { DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'
import { LayoutList } from 'lucide-react'

export default function FinanceiroFaturasLista() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-6 py-6 shadow-[0_26px_70px_-42px_rgba(16,185,129,0.55)]">
        <div>
          <p className="mb-1 inline-flex rounded-full border border-emerald-500/15 bg-dark-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Financeiro · Faturas</p>
          <h1 className="text-3xl font-bold text-dark-text">Faturas por imobiliária</h1>
          <p className="mt-2 max-w-2xl text-sm text-dark-muted">
            Abra cada imobiliária para conferir a competência, as apólices que realmente contam e o valor mensal calculado pelas parcelas ativas.
          </p>
        </div>
        <button
          onClick={() => navigate('/financeiro/faturas/conferencia')}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-dark-surface/85 px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-emerald-500/40"
        >
          <LayoutList className="h-4 w-4" /> Conferência geral
        </button>
      </section>

      <DataCard title="Selecionar imobiliária" subtitle="Busque pelo nome e clique para abrir a fatura" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.9))]">
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/faturas/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
