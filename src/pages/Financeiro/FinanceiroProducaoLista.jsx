import { useNavigate } from 'react-router-dom'
import { PageHeader, DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'

export default function FinanceiroProducaoLista() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Produção"
        title="Produção por imobiliária"
        description="Selecione uma imobiliária para ver comissão, produção e rankings por seguradora."
      />
      <DataCard title="Imobiliárias" subtitle="Busque e selecione uma imobiliária">
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/producao/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
