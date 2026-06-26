import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { fetchSeguradorasPorProduto } from '../../lib/seguradoras'
import { LayoutList } from 'lucide-react'

export default function FinanceiroFaturasLista() {
  const navigate = useNavigate()
  const [seguradoras, setSeguradoras] = useState([])

  useEffect(() => {
    let mounted = true
    fetchSeguradorasPorProduto('fianca')
      .then(list => { if (mounted) setSeguradoras(list || []) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Faturas"
        title="Faturas por imobiliária"
        description="Selecione uma imobiliária para ver a fatura do mês, a estimativa do próximo mês e as apólices que contam."
        actions={(
          <button
            onClick={() => navigate('/financeiro/faturas/conferencia')}
            className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary"
          >
            <LayoutList className="h-4 w-4" /> Conferência geral
          </button>
        )}
      />

      {seguradoras.length > 0 && (
        <DataCard title="Faturas por seguradora" subtitle="Filtre as faturas por seguradora do Seguro Fiança">
          <div className="flex flex-wrap gap-2">
            {seguradoras.map(s => (
              <button
                key={s.id || s.nome_canonico}
                onClick={() => navigate(`/financeiro/faturas/seguradora/${encodeURIComponent(s.nome_canonico)}`)}
                className="rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-3 py-2 transition-colors hover:border-brand-secondary"
              >
                <SeguradoraBadge nome={s.nome_canonico} size="sm" />
              </button>
            ))}
          </div>
        </DataCard>
      )}

      <DataCard title="Imobiliárias" subtitle="Busque e selecione uma imobiliária">
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/faturas/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
