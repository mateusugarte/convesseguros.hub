import { useNavigate } from 'react-router-dom'
import { DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'
import { LayoutList, Receipt } from 'lucide-react'

export default function FinanceiroFaturasLista() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-dark-muted">Financeiro · Faturas</p>
          <h1 className="text-2xl font-bold text-dark-text">Faturas por imobiliária</h1>
          <p className="mt-1 text-sm text-dark-muted">
            Selecione uma imobiliária para ver a fatura do mês, estimativa e apólices elegíveis.
          </p>
        </div>
        <button
          onClick={() => navigate('/financeiro/faturas/conferencia')}
          className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary"
        >
          <LayoutList className="h-4 w-4" /> Conferência geral
        </button>
      </div>

      <DataCard
        title="Selecionar imobiliária"
        subtitle="Busque pelo nome e clique para abrir a fatura"
        icon={<Receipt className="h-4 w-4" />}
      >
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/faturas/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
