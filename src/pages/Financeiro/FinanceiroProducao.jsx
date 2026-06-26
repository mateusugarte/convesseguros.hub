import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import EvolucaoChart from './EvolucaoChart'
import PeriodoFilter from '../../components/financeiro/PeriodoFilter'
import RankingSeguradoras from '../../components/financeiro/RankingSeguradoras'
import ApolicesListPanel from '../../components/financeiro/ApolicesListPanel'
import { useAuth } from '../../contexts/AuthContext'
import { fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria } from '../../lib/financeiro'
import { fetchApolicesAtivas } from '../../lib/financeiroApolices'
import {
  agruparPorSeguradora, agruparEvolucaoPorMes, gerarParcelasComissao, somarRecebimentoNoPeriodo,
} from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { ArrowLeft, Coins, TrendingUp, Wallet, Percent, FileText, Shield } from 'lucide-react'

const EVOLUCAO_MESES = 6

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const { user } = useAuth()

  const [periodo, setPeriodo] = useState(null)
  const [rows, setRows] = useState([])           // emitidas no período
  const [todasRows, setTodasRows] = useState([]) // todas emitidas (para recebimento estimado)
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [pct, setPct] = useState('')
  const [pctSalvo, setPctSalvo] = useState(null)
  const [loading, setLoading] = useState(false)

  const [panel, setPanel] = useState({ open: false, title: '', apolices: [], loading: false })

  useEffect(() => {
    let mounted = true
    fetchImobiliariasCatalogMap().then(cat => { if (mounted) setCatalogo(cat) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Apólices de todo o histórico da imobiliária (base do recebimento estimado).
  useEffect(() => {
    if (!selecionada) { setTodasRows([]); return }
    let mounted = true
    fetchProducaoLedger({ imobiliaria: selecionada })
      .then(r => { if (mounted) setTodasRows(r) })
      .catch(() => { if (mounted) setTodasRows([]) })
    return () => { mounted = false }
  }, [selecionada])

  // Dados do período selecionado.
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
      const meta = resolveImobiliaria(catalogo, selecionada)
      setPct(salvo != null ? String(salvo) : (meta?.pctComissao != null ? String(meta.pctComissao) : ''))
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, periodo, catalogo])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => (periodo ? agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(periodo.mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }) : []),
    [evolucaoRows, periodo],
  )
  const producao = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissaoGerada = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const comissaoEstimada = useMemo(() => {
    if (!periodo) return 0
    return somarRecebimentoNoPeriodo(gerarParcelasComissao(todasRows), { inicio: periodo.inicio, fim: periodo.fim })
  }, [todasRows, periodo])

  const producaoSeguradora = useMemo(() => seguradoras.map(s => ({ seguradora: s.seguradora, value: s.premio, qtd: s.qtd })), [seguradoras])
  const comissaoSeguradora = useMemo(() => seguradoras.map(s => ({ seguradora: s.seguradora, value: s.comissao })), [seguradoras])

  const valorRepassar = (() => {
    const p = parseDecimalBR(pct)
    return p != null ? (p / 100) * comissaoGerada : 0
  })()
  const meta = resolveImobiliaria(catalogo, selecionada)
  const mesLabel = periodo?.label || ''

  async function salvarPct() {
    if (!periodo) return
    const p = parseDecimalBR(pct)
    if (p === pctSalvo) return
    const err = await salvarPctImobiliaria({ imobiliaria: selecionada, mes: periodo.mesRef, pct: p, userId: user?.id })
    if (!err) setPctSalvo(p)
  }

  function abrirEmitidas() {
    setPanel({ open: true, title: `Apólices emitidas — ${mesLabel}`, apolices: rows, loading: false })
  }

  async function abrirAtivas() {
    setPanel({ open: true, title: 'Apólices ativas', apolices: [], loading: true })
    try {
      const ativas = await fetchApolicesAtivas({ imobiliaria: selecionada })
      setPanel({ open: true, title: 'Apólices ativas', apolices: ativas, loading: false })
    } catch {
      setPanel({ open: true, title: 'Apólices ativas', apolices: [], loading: false })
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/financeiro/producao')}
        className="inline-flex items-center gap-1.5 text-sm text-dark-muted transition-colors hover:text-dark-text"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para imobiliárias
      </button>

      <PageHeader
        eyebrow="Financeiro · Produção"
        title={selecionada}
        description="Produção, comissão e rankings por seguradora no período selecionado."
        actions={<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />}
      />

      <DataCard title="Período" subtitle="Escolha um mês ou um intervalo livre">
        <PeriodoFilter onChange={setPeriodo} />
      </DataCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Comissão gerada" value={formatMoneyBR(comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Comissão estimada a receber" value={formatMoneyBR(comissaoEstimada)} hint={`parcelas no período · ${mesLabel}`} tone="accent" icon={<Wallet className="h-4 w-4" />} />
        <MetricCard label="Produção" value={formatMoneyBR(producao)} hint={`${rows.length} apólice${rows.length !== 1 ? 's' : ''} · ${mesLabel}`} tone="success" icon={<Coins className="h-4 w-4" />} />
        <MetricCard label="A repassar" value={formatMoneyBR(valorRepassar)} hint="% × comissão gerada" tone="warning" icon={<Percent className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={abrirAtivas} className="inline-flex items-center gap-2 rounded-2xl bg-brand-secondary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
          <Shield className="h-4 w-4" /> Ver apólices ativas
        </button>
        <button onClick={abrirEmitidas} className="inline-flex items-center gap-2 rounded-2xl border border-dark-border px-4 py-2.5 text-sm font-medium text-dark-text transition-colors hover:border-brand-secondary">
          <FileText className="h-4 w-4" /> Apólices emitidas no período
        </button>
      </div>

      <DataCard title="Repasse da imobiliária" subtitle="Percentual sobre a comissão gerada, salvo para o mês">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <input
              value={pct}
              onChange={e => setPct(e.target.value)}
              onBlur={salvarPct}
              inputMode="decimal"
              className="w-20 rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1.5 text-right text-sm text-dark-text focus:border-brand-secondary focus:outline-none"
              placeholder="0"
            />
            <Percent className="h-4 w-4 text-dark-muted" />
          </div>
          <span className="text-sm text-dark-muted">→ a repassar</span>
          <span className="text-sm font-semibold text-emerald-400">{formatMoneyBR(valorRepassar)}</span>
        </div>
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Produção por seguradora" subtitle={`Prêmio total — ${mesLabel}`}>
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <RankingSeguradoras data={producaoSeguradora} emptyLabel="Sem produção no período" />
          )}
        </DataCard>
        <DataCard title="Comissão por seguradora" subtitle={`Comissão gerada — ${mesLabel}`}>
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <RankingSeguradoras data={comissaoSeguradora} emptyLabel="Sem comissão no período" />
          )}
        </DataCard>
      </div>

      <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`}>
        {evolucao.length === 0 ? (
          <EmptyState title="Sem dados" description="Selecione um período para ver a evolução." icon={<TrendingUp className="h-6 w-6" />} />
        ) : (
          <EvolucaoChart data={evolucao} />
        )}
      </DataCard>

      <ApolicesListPanel
        isOpen={panel.open}
        onClose={() => setPanel(p => ({ ...p, open: false }))}
        title={panel.title}
        subtitle={selecionada}
        apolices={panel.apolices}
        loading={panel.loading}
        showImobiliaria
      />
    </div>
  )
}
