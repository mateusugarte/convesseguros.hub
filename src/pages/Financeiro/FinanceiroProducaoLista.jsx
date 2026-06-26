import { useNavigate } from 'react-router-dom'
import { DataCard } from '../../components/ui'
import ImobiliariasGrid from '../../components/financeiro/ImobiliariasGrid'

export default function FinanceiroProducaoLista() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-6 py-6 shadow-[0_26px_70px_-42px_rgba(16,185,129,0.55)]">
        <p className="mb-1 inline-flex rounded-full border border-emerald-500/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800/70">Financeiro · Produção</p>
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
