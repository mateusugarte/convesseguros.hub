import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, DataCard } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import RegisteredSeguradorasStrip from '../../components/financeiro/RegisteredSeguradorasStrip'
import ApolicesListView from '../../components/financeiro/ApolicesListView'
import { fetchApolicesAtivas, fetchApolicesFianca } from '../../lib/financeiroApolices'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { ArrowLeft } from 'lucide-react'

export default function FinanceiroProducaoApolices() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const [searchParams] = useSearchParams()
  const tipo = searchParams.get('tipo') === 'emitidas' ? 'emitidas' : 'ativas'
  const ini = searchParams.get('ini') || ''
  const fim = searchParams.get('fim') || ''
  const label = searchParams.get('label') || ''
  const mesRef = searchParams.get('mesRef') || ''

  const [apolices, setApolices] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const scrollKey = `financeiro-producao-apolices-scroll:${selecionada}:${tipo}`
  const voltarQuery = searchParams.toString()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const fetcher = tipo === 'emitidas'
      ? fetchApolicesFianca({ imobiliaria: selecionada, inicio: ini || undefined, fim: fim || undefined })
      : fetchApolicesAtivas({ imobiliaria: selecionada, mesRef: mesRef || undefined })
    Promise.all([fetcher, fetchImobiliariasCatalogMap()])
      .then(([list, cat]) => {
        if (!mounted) return
        setApolices(list)
        setCatalogo(cat)
        setLoading(false)
      })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, tipo, ini, fim, mesRef])

  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(scrollKey)
    if (saved) {
      window.scrollTo(0, Number(saved) || 0)
      sessionStorage.removeItem(scrollKey)
    }
  }, [loading, scrollKey])

  function abrirApolice(a) {
    sessionStorage.setItem(scrollKey, String(window.scrollY))
    navigate(`/apolices/${a.id}`)
  }

  const meta = resolveImobiliaria(catalogo, selecionada)
  const titulo = tipo === 'emitidas' ? 'Apólices emitidas' : 'Apólices ativas'
  const sub = tipo === 'emitidas'
    ? (label ? `Emitidas em ${label}` : 'Emitidas no período')
    : (label ? `Ativas em ${label}` : 'Apólices ativas da imobiliária')

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(selecionada)}${voltarQuery ? `?${voltarQuery}` : ''}`)}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a produção
      </button>

      <section className="overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-6 py-6 shadow-[0_26px_70px_-42px_rgba(16,185,129,0.55)]">
        <PageHeader
          eyebrow={`Financeiro · Produção · ${titulo}`}
          title={selecionada}
          description={sub}
          actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
        />
        <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} size="sm" className="mt-4" />
      </section>

      <DataCard title={titulo} subtitle="Clique em uma apólice para abrir os detalhes" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.88))]">
        <ApolicesListView apolices={apolices} loading={loading} onRowClick={abrirApolice} />
      </DataCard>
    </div>
  )
}
