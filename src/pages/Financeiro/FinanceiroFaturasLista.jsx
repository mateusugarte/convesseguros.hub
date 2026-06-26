import { useNavigate } from 'react-router-dom'
import { PageHeader, DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'
import { LayoutList } from 'lucide-react'

export default function FinanceiroFaturasLista() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Faturas"
        title="Faturas por imobiliária"
        description="Selecione uma imobiliária para ver a fatura do mês, a estimativa do próximo mês, as faturas por seguradora e as apólices que contam."
        actions={(
          <button
            onClick={() => navigate('/financeiro/faturas/conferencia')}
            className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary"
          >
            <LayoutList className="h-4 w-4" /> Conferência geral
          </button>
        )}
      />

      <DataCard title="Imobiliárias" subtitle="Busque e selecione uma imobiliária">
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/faturas/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
