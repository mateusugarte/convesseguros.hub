import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, DataCard } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import ApolicesListView from '../../components/financeiro/ApolicesListView'
import { fetchApolicesAtivas, fetchApolicesFianca } from '../../lib/financeiroApolices'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { ArrowLeft } from 'lucide-react'

// Página dedicada de apólices da imobiliária (sem modal).
// tipo=ativas → todas as ativas; tipo=emitidas → emitidas no período (ini/fim).
export default function FinanceiroProducaoApolices() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const [searchParams] = useSearchParams()
  const tipo = searchParams.get('tipo') === 'emitidas' ? 'emitidas' : 'ativas'
  const ini = searchParams.get('ini') || ''
  const fim = searchParams.get('fim') || ''
  const label = searchParams.get('label') || ''

  const [apolices, setApolices] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const scrollKey = `financeiro-producao-apolices-scroll:${selecionada}:${tipo}`
  // Query para voltar à produção preservando o período selecionado.
  const voltarQuery = searchParams.toString()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const fetcher = tipo === 'emitidas'
      ? fetchApolicesFianca({ imobiliaria: selecionada, inicio: ini || undefined, fim: fim || undefined })
      : fetchApolicesAtivas({ imobiliaria: selecionada })
    Promise.all([fetcher, fetchImobiliariasCatalogMap()])
      .then(([list, cat]) => {
        if (!mounted) return
        setApolices(list)
        setCatalogo(cat)
        setLoading(false)
      })
      .catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, tipo, ini, fim])

  // Restaura o scroll ao voltar do detalhe da apólice.
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
  const sub = tipo === 'emitidas' ? (label ? `Emitidas em ${label}` : 'Emitidas no período') : 'Todas as apólices ativas da imobiliária'

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(selecionada)}${voltarQuery ? `?${voltarQuery}` : ''}`)}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a produção
      </button>

      <PageHeader
        eyebrow={`Financeiro · Produção · ${titulo}`}
        title={selecionada}
        description={sub}
        actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
      />

      <DataCard title={titulo} subtitle="Clique em uma apólice para abrir os detalhes">
        <ApolicesListView apolices={apolices} loading={loading} onRowClick={abrirApolice} />
      </DataCard>
    </div>
  )
}
