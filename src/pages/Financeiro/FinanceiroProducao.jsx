import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import EvolucaoChart from './EvolucaoChart'
import PeriodoFilter from '../../components/financeiro/PeriodoFilter'
import RankingSeguradoras from '../../components/financeiro/RankingSeguradoras'
import RegisteredSeguradorasStrip from '../../components/financeiro/RegisteredSeguradorasStrip'
import ApolicesListView from '../../components/financeiro/ApolicesListView'
import { useAuth } from '../../contexts/AuthContext'
import { fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria } from '../../lib/financeiro'
import { fetchApolicesAtivas } from '../../lib/financeiroApolices'
import {
  agruparPorSeguradora, agruparEvolucaoPorMes, comissaoEstimadaProximoMes,
} from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { addMeses, formatMesAno } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { ArrowLeft, Coins, TrendingUp, Wallet, Percent, FileText, Shield } from 'lucide-react'

const EVOLUCAO_MESES = 6

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [periodo, setPeriodo] = useState(null)
  const [rows, setRows] = useState([])
  const [ativasRows, setAtivasRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [pct, setPct] = useState('')
  const [pctSalvo, setPctSalvo] = useState(null)
  const [loading, setLoading] = useState(false)

  const periodoInicial = useMemo(() => ({
    modo: searchParams.get('modo') || 'mes',
    ano: searchParams.get('ano'),
    mes: searchParams.get('mes'),
    inicio: searchParams.get('ini'),
    fim: searchParams.get('fim'),
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true
    fetchImobiliariasCatalogMap().then(cat => { if (mounted) setCatalogo(cat) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!selecionada) { setAtivasRows([]); return }
    let mounted = true
    fetchApolicesAtivas({ imobiliaria: selecionada })
      .then(r => { if (mounted) setAtivasRows(r) })
      .catch(() => { if (mounted) setAtivasRows([]) })
    return () => { mounted = false }
  }, [selecionada])

  useEffect(() => {
    if (!periodo) return
    const next = periodo.modo === 'intervalo'
      ? { modo: 'intervalo', ini: periodo.inicio, fim: periodo.fim }
      : { modo: 'mes', ano: String(periodo.ano), mes: String(periodo.mes) }
    setSearchParams(next, { replace: true })
  }, [periodo, setSearchParams])

  useEffect(() => {
    if (!selecionada || !periodo) { setRows([]); setEvolucaoRows([]); return }
    let mounted = true
    setLoading(true)
    const { inicio, fim, mesRef } = periodo
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.allSettled([
      fetchProducaoLedger({ inicio, fim, imobiliaria: selecionada }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim, imobiliaria: selecionada }),
      fetchPctImobiliarias({ mes: mesRef }),
    ]).then(([prod, evol, pctMap]) => {
      if (!mounted) return
      setRows(prod.status === 'fulfilled' ? prod.value : [])
      setEvolucaoRows(evol.status === 'fulfilled' ? evol.value : [])
      const pctMapValue = pctMap.status === 'fulfilled' ? pctMap.value : {}
      const salvo = pctMapValue[selecionada]
      setPctSalvo(salvo ?? null)
      if (salvo != null) setPct(String(salvo))
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, periodo]) // catalogo não é dependência aqui — evita double-fetch ao voltar de subpáginas

  useEffect(() => {
    if (!catalogo || !selecionada || pctSalvo != null) return
    const meta = resolveImobiliaria(catalogo, selecionada)
    if (meta?.pctComissao != null) setPct(String(meta.pctComissao))
  }, [catalogo, selecionada, pctSalvo])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => (periodo ? agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(periodo.mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }) : []),
    [evolucaoRows, periodo],
  )
  const producao = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissaoGerada = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const comissaoEstimada = useMemo(
    () => (periodo ? comissaoEstimadaProximoMes(ativasRows, periodo.mesRef) : 0),
    [ativasRows, periodo],
  )

  const producaoSeguradora = useMemo(() => seguradoras.map(s => ({ seguradora: s.seguradora, value: s.premio, qtd: s.qtd })), [seguradoras])
  const comissaoSeguradora = useMemo(() => seguradoras.map(s => ({ seguradora: s.seguradora, value: s.comissao })), [seguradoras])

  const valorRepassar = (() => {
    const p = parseDecimalBR(pct)
    return p != null ? (p / 100) * comissaoGerada : 0
  })()
  const meta = resolveImobiliaria(catalogo, selecionada)
  const mesLabel = periodo?.label || ''
  const proximoLabel = periodo ? formatMesAno(addMeses(periodo.mesRef, 1)) : ''

  async function salvarPct() {
    if (!periodo) return
    const p = parseDecimalBR(pct)
    if (p === pctSalvo) return
    const err = await salvarPctImobiliaria({ imobiliaria: selecionada, mes: periodo.mesRef, pct: p, userId: user?.id })
    if (!err) setPctSalvo(p)
  }

  function irParaApolices(tipo) {
    const qs = new URLSearchParams(searchParams)
    qs.set('tipo', tipo)
    if (periodo) {
      qs.set('mesRef', periodo.mesRef)
      qs.set('label', periodo.label)
    }
    if (tipo === 'emitidas' && periodo) {
      qs.set('ini', periodo.inicio)
      qs.set('fim', periodo.fim)
    }
    navigate(`/financeiro/producao/${encodeURIComponent(selecionada)}/apolices?${qs.toString()}`)
  }

  return (
    <div className="financeiro-page space-y-5">
      <button
        onClick={() => navigate('/financeiro/producao')}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para imobiliárias
      </button>

      <section className="financeiro-hero px-6 py-6">
        <PageHeader
          eyebrow="Financeiro · Produção"
          title={selecionada}
          description="Produção, comissão e rankings por seguradora no período selecionado."
          actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
        />
        <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} size="sm" className="mt-4" />
      </section>

      <DataCard
        title="Período"
        subtitle="Escolha um mês ou um intervalo livre"
        className="overflow-hidden border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9))]"
      >
        <PeriodoFilter onChange={setPeriodo} initial={periodoInicial} />
      </DataCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Comissão gerada" value={formatMoneyBR(comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88))]" />
        <MetricCard label="Comissão estimada (próx. mês)" value={formatMoneyBR(comissaoEstimada)} hint={proximoLabel ? `a receber em ${proximoLabel}` : 'apólices ativas'} tone="accent" icon={<Wallet className="h-4 w-4" />} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(220,252,231,0.84))]" />
        <MetricCard label="Produção" value={formatMoneyBR(producao)} hint={`${rows.length} apólice${rows.length !== 1 ? 's' : ''} · ${mesLabel}`} tone="success" icon={<Coins className="h-4 w-4" />} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))]" />
        <MetricCard label="A repassar" value={formatMoneyBR(valorRepassar)} hint="% × comissão gerada" tone="warning" icon={<Percent className="h-4 w-4" />} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(254,249,195,0.55))]" />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => irParaApolices('ativas')}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
        >
          <Shield className="h-4 w-4" /> Ver apólices ativas ({ativasRows.length})
        </button>
        <button
          onClick={() => irParaApolices('emitidas')}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-dark-surface/80 px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-emerald-500/40"
        >
          <FileText className="h-4 w-4" /> Apólices emitidas no período
        </button>
      </div>

      <DataCard title="Repasse da imobiliária" subtitle="Percentual sobre a comissão gerada, salvo para o mês" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.88))]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-emerald-500/15 bg-dark-surface/90 px-3 py-2 shadow-sm">
            <input
              value={pct}
              onChange={e => setPct(e.target.value)}
              onBlur={salvarPct}
              inputMode="decimal"
              className="w-20 bg-transparent text-right text-sm text-dark-text outline-none"
              placeholder="0"
            />
            <Percent className="h-4 w-4 text-emerald-700/60" />
          </div>
          <span className="text-sm text-dark-muted">→ a repassar</span>
          <span className="text-sm font-semibold text-emerald-600">{formatMoneyBR(valorRepassar)}</span>
        </div>
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Produção por seguradora" subtitle={`Prêmio total — ${mesLabel}`} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]">
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <RankingSeguradoras data={producaoSeguradora} emptyLabel="Sem produção no período" />
          )}
        </DataCard>
        <DataCard title="Comissão por seguradora" subtitle={`Comissão gerada — ${mesLabel}`} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]">
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <RankingSeguradoras data={comissaoSeguradora} emptyLabel="Sem comissão no período" />
          )}
        </DataCard>
      </div>

      <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9))]">
        {evolucao.length === 0 ? (
          <EmptyState title="Sem dados" description="Selecione um período para ver a evolução." icon={<TrendingUp className="h-6 w-6" />} />
        ) : (
          <EvolucaoChart data={evolucao} />
        )}
      </DataCard>

      <DataCard
        title="Apólices emitidas no período"
        subtitle={mesLabel ? `${rows.length} apólice${rows.length !== 1 ? 's' : ''} emitidas em ${mesLabel}` : 'Selecione um período'}
        className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.86))]"
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <ApolicesListView
            apolices={rows}
            onRowClick={a => navigate(`/apolices/${a.id}`, {
              state: {
                returnTo: `/financeiro/producao/${encodeURIComponent(selecionada)}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
                returnLabel: 'Voltar para a produção',
              },
            })}
            showEmissao
            showComissaoMensal
            showVigencia
          />
        )}
      </DataCard>
    </div>
  )
}
