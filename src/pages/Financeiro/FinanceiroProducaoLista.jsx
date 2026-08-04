import { useNavigate } from 'react-router-dom'
import { DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'

export default function FinanceiroProducaoLista() {
  const navigate = useNavigate()
  return (
    <div className="financeiro-page space-y-5">
      <section className="financeiro-hero px-6 py-6">
        <p className="mb-1 inline-flex rounded-full border border-emerald-500/15 bg-dark-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Financeiro · Produção</p>
        <h1 className="text-3xl font-bold text-dark-text">Produção por imobiliária</h1>
        <p className="mt-2 max-w-2xl text-sm text-dark-muted">
          Entre por uma imobiliária para ver produção, comissão, seguradoras cadastradas e as apólices que sustentam os números.
        </p>
      </section>
      <DataCard title="Imobiliárias" subtitle="Busque e selecione uma imobiliária" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.9))]">
        <ImobiliariasGrid onSelect={nome => navigate(`/financeiro/producao/${encodeURIComponent(nome)}`)} />
      </DataCard>
    </div>
  )
}
