import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, BadgeDollarSign, CalendarDays, Car, CircleCheckBig, Mail, Phone, RefreshCw, Search, ShieldHalf, Sparkles, TrendingUp, UserRound } from 'lucide-react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import {
  buscarClientePorCpf,
  criarCotacaoAuto,
  criarCotacaoEndosso,
  getAutoCotacoesMensais,
  getAutoCotacoesResumo,
  getClienteAutoDetalhe,
  getCotacoesAuto,
  getRenovacoesDisponiveisParaCotacao,
  iniciarCotacaoRenovacao,
  iniciarCotacaoRenovacaoPorApolice,
} from '../../lib/auto'
import { COTACAO_STATUS, diasParaVencer, formatDateTimeBR, formatDiasParaVencer, toneClasses } from './autoShared'

const LISTA_TABS = [
  { value: 'lista', label: 'Lista' },
  { value: 'novo', label: 'Novo seguro' },
  { value: 'renovacao', label: 'Renovacao' },
  { value: 'endosso', label: 'Endosso' },
]

const STATUS_FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendente', label: 'Pendentes' },
  { value: 'convertida', label: 'Convertidas' },
  { value: 'perdida', label: 'Perdidas' },
]

const PERIODO_FILTROS = [
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '180d', label: '180 dias' },
  { value: 'todo', label: 'Todo periodo' },
]

const NOVO_VAZIO = {
  nome_completo: '',
  cpf: '',
  celular: '',
  email: '',
  condutor_nome: '',
  condutor_cpf: '',
  modelo_veiculo: '',
  placa: '',
  origem_lead: '',
  vigencia_inicio: '',
  vigencia_fim: '',
}

// Campos minimos para uma renovacao de cliente que ainda nao existe na base
// (mesmo minimo do "Novo seguro" — o resto e preenchido depois, ao cotar).
const RENOVACAO_NOVO_CLIENTE_VAZIO = {
  nome_completo: '',
  cpf: '',
  celular: '',
  modelo_veiculo: '',
  placa: '',
}

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

function Field({ label, value, onChange, type = 'text', placeholder, children, inputMode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-dark-muted">{label}</label>
      {children || (
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input"
        />
      )}
    </div>
  )
}

function iconLabel(Icon, text) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span>{text}</span>
    </span>
  )
}

function sortByRecency(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime()
    const tb = new Date(b.updated_at || b.created_at || 0).getTime()
    return tb - ta
  })
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-dark-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs text-dark-muted">{label}</p>
      <div className="mt-1 space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-dark-text">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color || item.fill }} />
            <span>{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AutoCotacoes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const modoInicial = LISTA_TABS.some(item => item.value === searchParams.get('modo')) ? searchParams.get('modo') : 'lista'
  const [tab, setTab] = useState(modoInicial)
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('90d')
  const [searchLista, setSearchLista] = useState('')
  const [novo, setNovo] = useState(NOVO_VAZIO)
  const [searchRenovacao, setSearchRenovacao] = useState('')
  const [renovacaoSelecionadaId, setRenovacaoSelecionadaId] = useState(null)
  const [renovacaoClienteExiste, setRenovacaoClienteExiste] = useState(true)
  const [renovacaoBuscaCliente, setRenovacaoBuscaCliente] = useState('')
  const [renovacaoClienteRef, setRenovacaoClienteRef] = useState(null)
  const [renovacaoApoliceId, setRenovacaoApoliceId] = useState('')
  const [renovacaoNovoCliente, setRenovacaoNovoCliente] = useState(RENOVACAO_NOVO_CLIENTE_VAZIO)
  const [endossoBuscaCliente, setEndossoBuscaCliente] = useState('')
  const [endossoClienteRef, setEndossoClienteRef] = useState(null)
  const [endossoApoliceId, setEndossoApoliceId] = useState('')
  const [endossoForm, setEndossoForm] = useState({ motivo: '', campo_alterado: '', valor_anterior: '', valor_atual: '', valor_endosso: '' })
  const [erro, setErro] = useState(null)
  const qc = useQueryClient()

  useEffect(() => {
    const modo = searchParams.get('modo')
    if (LISTA_TABS.some(item => item.value === modo)) {
      setTab(modo)
      setErro(null)
    }
  }, [searchParams])

  const { data: cotacoes = [], isLoading: loadingLista } = useQuery({
    queryKey: ['auto-cotacoes-todas'],
    queryFn: () => getCotacoesAuto({}),
  })

  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['auto-cotacoes-resumo'],
    queryFn: () => getAutoCotacoesResumo({}),
  })

  const { data: serieMensal = [], isLoading: loadingSerie } = useQuery({
    queryKey: ['auto-cotacoes-serie'],
    queryFn: () => getAutoCotacoesMensais({}),
  })

  const invalidar = async () => {
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes-serie'] })
    await qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
    await qc.invalidateQueries({ queryKey: ['auto-dashboard-cotacoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    await qc.invalidateQueries({ queryKey: ['auto-emissoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-renovacoes-resumo'] })
  }

  const { mutateAsync: salvarNovo, isPending: salvandoNovo } = useMutation({
    mutationFn: async payload => criarCotacaoAuto({
      tipo: 'novo',
      status: 'pendente',
      nome_cliente: payload.nome_completo || null,
      cpf_cliente: payload.cpf || null,
      celular_cliente: payload.celular || null,
      email_cliente: payload.email || null,
      condutor_nome: payload.condutor_nome || null,
      condutor_cpf: payload.condutor_cpf || null,
      modelo_veiculo: payload.modelo_veiculo || null,
      placa: payload.placa || null,
      origem_lead: payload.origem_lead || null,
      vigencia_inicio: payload.vigencia_inicio || null,
      vigencia_fim: payload.vigencia_fim || null,
    }),
    onSuccess: async () => {
      setErro(null)
      setNovo(NOVO_VAZIO)
      await invalidar()
      setTab('lista')
    },
    onError: err => setErro(err?.message || 'Erro ao salvar cotacao.'),
  })

  const { data: renovacoesDisponiveis = [], isLoading: loadingRenovacoes } = useQuery({
    queryKey: ['auto-renovacoes-disponiveis', searchRenovacao],
    queryFn: () => getRenovacoesDisponiveisParaCotacao(searchRenovacao),
    enabled: tab === 'renovacao',
  })

  const { mutateAsync: cotarRenovacaoSelecionada, isPending: iniciandoRenovacao } = useMutation({
    mutationFn: renovacaoId => iniciarCotacaoRenovacao(renovacaoId),
    onSuccess: async ({ cotacaoId }) => {
      setErro(null)
      setRenovacaoSelecionadaId(null)
      await invalidar()
      navigate(`/auto/cotacoes/${cotacaoId}`)
    },
    onError: err => setErro(err?.message || 'Erro ao iniciar cotacao de renovacao.'),
  })

  const { data: renovacaoCliente, isFetching: buscandoRenovacaoCliente } = useQuery({
    queryKey: ['auto-renovacao-busca-cliente', renovacaoClienteRef],
    queryFn: () => getClienteAutoDetalhe(renovacaoClienteRef),
    enabled: Boolean(renovacaoClienteRef),
  })

  const { mutateAsync: iniciarRenovacaoPorApolice, isPending: iniciandoRenovacaoPorApolice } = useMutation({
    mutationFn: () => iniciarCotacaoRenovacaoPorApolice(renovacaoApoliceId),
    onSuccess: async ({ cotacaoId }) => {
      setErro(null)
      setRenovacaoBuscaCliente('')
      setRenovacaoClienteRef(null)
      setRenovacaoApoliceId('')
      await invalidar()
      navigate(`/auto/cotacoes/${cotacaoId}`)
    },
    onError: err => setErro(err?.message || 'Erro ao iniciar cotação de renovação.'),
  })

  function handleBuscarClienteRenovacao() {
    const termo = renovacaoBuscaCliente.trim()
    if (!termo) return
    setRenovacaoApoliceId('')
    setRenovacaoClienteRef(termo)
  }

  const { mutateAsync: salvarRenovacaoClienteNovo, isPending: salvandoRenovacaoClienteNovo } = useMutation({
    mutationFn: async payload => criarCotacaoAuto({
      tipo: 'renovacao',
      status: 'pendente',
      nome_cliente: payload.nome_completo || null,
      cpf_cliente: payload.cpf || null,
      celular_cliente: payload.celular || null,
      modelo_veiculo: payload.modelo_veiculo || null,
      placa: payload.placa || null,
    }),
    onSuccess: async cotacao => {
      setErro(null)
      setRenovacaoNovoCliente(RENOVACAO_NOVO_CLIENTE_VAZIO)
      await invalidar()
      navigate(`/auto/cotacoes/${cotacao.id}`)
    },
    onError: err => setErro(err?.message || 'Erro ao salvar cotação de renovação.'),
  })

  const { data: endossoCliente, isFetching: buscandoEndossoCliente } = useQuery({
    queryKey: ['auto-endosso-cliente', endossoClienteRef],
    queryFn: () => getClienteAutoDetalhe(endossoClienteRef),
    enabled: Boolean(endossoClienteRef),
  })

  const { mutateAsync: salvarEndosso, isPending: salvandoEndosso } = useMutation({
    mutationFn: () => criarCotacaoEndosso({
      cliente_id: endossoCliente?.cliente?.id,
      apolice_id: endossoApoliceId,
      motivo: endossoForm.motivo,
      campo_alterado: endossoForm.campo_alterado,
      valor_anterior: endossoForm.valor_anterior,
      valor_atual: endossoForm.valor_atual,
      valor_endosso: endossoForm.valor_endosso,
    }),
    onSuccess: async ({ cotacao }) => {
      setErro(null)
      setEndossoBuscaCliente('')
      setEndossoClienteRef(null)
      setEndossoApoliceId('')
      setEndossoForm({ motivo: '', campo_alterado: '', valor_anterior: '', valor_atual: '', valor_endosso: '' })
      await invalidar()
      navigate(`/auto/cotacoes/${cotacao.id}`)
    },
    onError: err => setErro(err?.message || 'Erro ao salvar endosso.'),
  })

  async function handleBuscarEndossoCliente() {
    const termo = endossoBuscaCliente.trim()
    if (!termo) return
    setEndossoApoliceId('')
    setEndossoClienteRef(termo)
  }

  const cotacoesOrdenadas = useMemo(() => sortByRecency(cotacoes), [cotacoes])

  const cotacoesFiltradas = useMemo(() => {
    const hoje = new Date()
    const limitePeriodo = (() => {
      if (filtroPeriodo === 'todo') return null
      const dias = filtroPeriodo === '30d' ? 30 : filtroPeriodo === '90d' ? 90 : 180
      const ref = new Date(hoje)
      ref.setDate(ref.getDate() - dias)
      return ref
    })()

    const termo = searchLista.trim().toLowerCase()

    return cotacoesOrdenadas.filter(item => {
      if (limitePeriodo) {
        const ref = new Date(item.updated_at || item.created_at)
        if (Number.isNaN(ref.getTime()) || ref < limitePeriodo) return false
      }
      if (filtroStatus !== 'todas' && item.status !== filtroStatus) return false
      if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false
      if (!termo) return true

      const text = [
        item.nome_cliente,
        item.cpf_cliente,
        item.celular_cliente,
        item.email_cliente,
        item.modelo_veiculo,
        item.placa,
        item.condutor_nome,
        item.condutor_cpf,
        item.seguradora_preferencial?.nome,
        item.seguradora_mais_barata?.nome,
        item.origem_lead,
      ].filter(Boolean).join(' ').toLowerCase()

      return text.includes(termo)
    })
  }, [cotacoesOrdenadas, filtroPeriodo, filtroStatus, filtroTipo, searchLista])

  const cotacoesMes = useMemo(() => {
    const agora = new Date()
    return cotacoesOrdenadas.filter(item => {
      const d = new Date(item.updated_at || item.created_at)
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
    })
  }, [cotacoesOrdenadas])

  const cotacoesRecentes = useMemo(() => cotacoesOrdenadas.slice(0, 6), [cotacoesOrdenadas])

  const convertidas = cotacoesMes.filter(item => item.status === 'convertida').length
  const perdidas = cotacoesMes.filter(item => item.status === 'perdida').length
  const taxa = cotacoesMes.length > 0 ? Math.round((convertidas / cotacoesMes.length) * 100) : 0

  const metrics = [
    { key: 'total', label: 'Cotacoes no periodo', value: resumo?.total ?? 0, icon: BadgeDollarSign, tone: 'accent' },
    { key: 'mes', label: 'Cotacoes no mes', value: resumo?.mesAtual ?? 0, icon: Sparkles, tone: 'warning' },
    { key: 'convertidas', label: 'Convertidas', value: resumo?.convertidas ?? 0, icon: CircleCheckBig, tone: 'success' },
    { key: 'taxa', label: 'Taxa de conversao', value: `${taxa}%`, icon: TrendingUp, tone: 'secondary' },
  ]

  const resumoLateral = useMemo(() => [
    {
      label: 'Mais recente',
      value: cotacoesOrdenadas[0]?.nome_cliente || cotacoesOrdenadas[0]?.cpf_cliente || 'Sem identificacao',
      hint: formatDateTimeBR(cotacoesOrdenadas[0]?.updated_at || cotacoesOrdenadas[0]?.created_at),
    },
    {
      label: 'Atualizacao',
      value: cotacoesOrdenadas.find(item => item.updated_at && item.updated_at !== item.created_at)
        ? 'Ha registros editados'
        : 'Somente criacoes',
      hint: 'ordenacao usa updated_at quando existir',
    },
    {
      label: 'Pendentes',
      value: `${resumo?.pendentes ?? 0} cotações`,
      hint: 'aguardando tratativa',
    },
    {
      label: 'Convertidas',
      value: `${resumo?.convertidas ?? 0}`,
      hint: 'status convertido',
    },
    {
      label: 'Perdidas',
      value: `${resumo?.perdidas ?? 0}`,
      hint: 'status perdido',
    },
  ], [cotacoesOrdenadas, resumo])

  const tabs = LISTA_TABS.map(item => ({
    ...item,
    count: item.value === 'lista' ? cotacoes.length : 0,
  }))

  const resumoAtivo = resumo?.taxaConversao ? Math.round((resumo.taxaConversao ?? 0) * 100) : taxa

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Cotacoes"
        description="Area central com a lista completa das cotacoes, atualizada do mais recente para o mais antigo, com acesso rapido aos detalhes e edicao."
        actions={(
          <>
            <Link to="/auto/dashboard" className="btn-secondary">Dashboard</Link>
            <Link to="/auto/emissoes" className="btn-primary">Ver emissões</Link>
          </>
        )}
        stats={metrics.map(({ key, label, value, icon: Icon, tone }) => (
          <MetricCard key={key} label={label} value={value} icon={<Icon className="h-4 w-4" />} tone={tone} />
        ))}
      />

      <DataCard className="overflow-hidden border-brand-accent/12" bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/10 via-transparent to-brand-secondary/8 p-6 md:p-8">
            <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="absolute -bottom-6 left-1/3 h-28 w-28 rounded-full bg-brand-secondary/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-dark-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                <Sparkles className="h-3.5 w-3.5" />
                Cotações em ordem cronológica
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Veja todo o historico do modulo em uma unica tela.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                A lista prioriza a informacao mais recente, mostra quando cada registro foi criado ou atualizado e abre o detalhe completo com um clique.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-info">{cotacoes.length} registros</span>
                <span className="badge badge-success">{resumoAtivo}% conversao</span>
                <span className="badge badge-muted">{cotacoesOrdenadas.length ? 'Mais recente no topo' : 'Sem registros ainda'}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
            {resumoLateral.map(item => (
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/75 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-dark-text">{item.value}</p>
                <p className="mt-2 text-xs text-dark-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </DataCard>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(item => (
          <button
            key={item.value}
            onClick={() => { setTab(item.value); setErro(null) }}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.value
                ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {erro && (
            <div className="flex items-start gap-3 rounded-2xl border border-status-danger/20 bg-status-danger/8 px-4 py-3 text-sm text-status-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {tab === 'lista' ? (
            <DataCard
              title="Todas as cotacoes"
              subtitle="Organizadas da mais recente para a mais antiga, com os dados principais e o ultimo momento de atualizacao."
              actions={(
                <span className="badge badge-muted">
                  {cotacoesFiltradas.length} resultado{cotacoesFiltradas.length !== 1 ? 's' : ''}
                </span>
              )}
              bodyClassName="p-0"
            >
              <div className="border-b border-dark-border/70 bg-dark-surface2/25 px-5 py-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                    <input
                      value={searchLista}
                      onChange={e => setSearchLista(e.target.value)}
                      placeholder="Buscar nome, CPF, celular, veiculo, placa ou seguradora..."
                      className="input pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {PERIODO_FILTROS.map(item => (
                      <button
                        key={item.value}
                        onClick={() => setFiltroPeriodo(item.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          filtroPeriodo === item.value
                            ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                            : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_FILTROS.map(item => (
                    <button
                      key={item.value}
                      onClick={() => setFiltroStatus(item.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        filtroStatus === item.value
                          ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                          : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mx-1 w-px bg-dark-border/70" />
                  {[
                    { value: 'todos', label: 'Todos os tipos' },
                    { value: 'novo', label: 'Seguro novo' },
                    { value: 'renovacao', label: 'Renovacao' },
                  ].map(item => (
                    <button
                      key={item.value}
                      onClick={() => setFiltroTipo(item.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        filtroTipo === item.value
                          ? 'border-brand-secondary bg-brand-secondary/10 text-status-info'
                          : 'border-dark-border text-dark-muted hover:border-brand-secondary/40 hover:text-dark-text'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingLista ? (
                <div className="px-5 py-10 text-center text-sm text-dark-muted">Carregando cotacoes...</div>
              ) : cotacoesFiltradas.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    icon={<Car className="h-5 w-5" />}
                    title="Nenhuma cotacao encontrada"
                    description="Ajuste os filtros ou volte para a lista completa para ver outros registros."
                  />
                </div>
              ) : (
                <div className="divide-y divide-dark-border/70">
                  {cotacoesFiltradas.map(item => {
                    const updated = item.updated_at && item.updated_at !== item.created_at
                    return (
                      <Link
                        key={item.id}
                        to={`/auto/cotacoes/${item.id}`}
                        className="block transition-colors hover:bg-dark-surface2/30"
                      >
                        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-dark-text">
                                {item.nome_cliente || item.cpf_cliente || 'Sem identificacao'}
                              </p>
                              <QuoteStatusBadge status={item.status} />
                              <span className={`badge ${item.tipo === 'novo' ? 'badge-info' : 'badge-muted'}`}>
                                {item.tipo === 'novo' ? 'Seguro novo' : 'Renovacao'}
                              </span>
                            </div>

                            <div className="grid gap-2 text-xs text-dark-muted md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <span className="block uppercase tracking-widest text-[10px]">Contato</span>
                                <span>{item.celular_cliente || item.email_cliente || 'Sem contato'}</span>
                              </div>
                              <div>
                                <span className="block uppercase tracking-widest text-[10px]">Veiculo</span>
                                <span>{item.modelo_veiculo || 'Nao informado'}{item.placa ? ` - ${item.placa}` : ''}</span>
                              </div>
                              <div>
                                <span className="block uppercase tracking-widest text-[10px]">Seguradora</span>
                                <span>{item.seguradora_preferencial?.nome || item.seguradora_mais_barata?.nome || 'Sem vinculacao'}</span>
                              </div>
                              <div>
                                <span className="block uppercase tracking-widest text-[10px]">{updated ? 'Atualizada em' : 'Criada em'}</span>
                                <span>{formatDateTimeBR(item.updated_at || item.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-dark-muted">
                            <span className="rounded-full border border-dark-border/70 px-3 py-1 text-dark-muted">
                              Abrir detalhe
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </DataCard>
          ) : tab === 'novo' ? (
            <DataCard title="Nova cotacao" subtitle="Cadastro simples do segurado e do veiculo.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={iconLabel(UserRound, 'Nome completo')} value={novo.nome_completo} onChange={value => setNovo(prev => ({ ...prev, nome_completo: value }))} />
                <Field label={iconLabel(UserRound, 'CPF')} value={novo.cpf} onChange={value => setNovo(prev => ({ ...prev, cpf: value }))} />
                <Field label={iconLabel(Phone, 'Celular')} value={novo.celular} onChange={value => setNovo(prev => ({ ...prev, celular: value }))} />
                <Field label={iconLabel(Mail, 'E-mail')} value={novo.email} onChange={value => setNovo(prev => ({ ...prev, email: value }))} />
                <Field label={iconLabel(UserRound, 'Nome do condutor')} value={novo.condutor_nome} onChange={value => setNovo(prev => ({ ...prev, condutor_nome: value }))} />
                <Field label={iconLabel(UserRound, 'CPF do condutor')} value={novo.condutor_cpf} onChange={value => setNovo(prev => ({ ...prev, condutor_cpf: value }))} />
                <Field label={iconLabel(Car, 'Modelo do veiculo')} value={novo.modelo_veiculo} onChange={value => setNovo(prev => ({ ...prev, modelo_veiculo: value }))} />
                <Field label={iconLabel(Car, 'Placa')} value={novo.placa} onChange={value => setNovo(prev => ({ ...prev, placa: value }))} placeholder="Opcional" />
                <Field label={iconLabel(CalendarDays, 'Vigencia inicio')} type="date" value={novo.vigencia_inicio} onChange={value => setNovo(prev => ({ ...prev, vigencia_inicio: value }))} />
                <Field label={iconLabel(CalendarDays, 'Vigencia fim')} type="date" value={novo.vigencia_fim} onChange={value => setNovo(prev => ({ ...prev, vigencia_fim: value }))} />
                <div className="md:col-span-2">
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-dark-muted">{iconLabel(UserRound, 'Origem do lead')}</label>
                  <select
                    value={novo.origem_lead}
                    onChange={e => setNovo(prev => ({ ...prev, origem_lead: e.target.value }))}
                    className="select"
                  >
                    <option value="">Selecionar</option>
                    <option value="indicacao">Indicacao</option>
                    <option value="prospeccao">Prospeccao</option>
                    <option value="carteira">Carteira</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => salvarNovo(novo)}
                  disabled={salvandoNovo || !novo.cpf}
                  className="btn-primary"
                >
                  {salvandoNovo ? 'Salvando...' : 'Salvar cotacao'}
                </button>
                <button type="button" onClick={() => setTab('lista')} className="btn-secondary">
                  Voltar para lista
                </button>
              </div>
            </DataCard>
          ) : tab === 'endosso' ? (
            <DataCard title="Nova cotação de endosso" subtitle="Busque o cliente, selecione a apólice pela vigência e descreva a alteração.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Buscar cliente (nome ou CPF)" value={endossoBuscaCliente} onChange={setEndossoBuscaCliente} placeholder="Nome ou CPF" />
                  <button onClick={handleBuscarEndossoCliente} disabled={buscandoEndossoCliente} className="btn-secondary disabled:opacity-60">
                    {buscandoEndossoCliente ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {endossoCliente?.apolices?.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-dark-muted">Apólice (mais recente primeiro)</label>
                    <select
                      value={endossoApoliceId}
                      onChange={e => setEndossoApoliceId(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Selecionar apólice</option>
                      {endossoCliente.apolices.map(apolice => (
                        <option key={apolice.id} value={apolice.id}>
                          {apolice.numero_apolice || 'Sem número'} · {apolice.seguradora} · vigência {apolice.vigencia_inicio} a {apolice.vigencia_fim}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {endossoClienteRef && !buscandoEndossoCliente && !endossoCliente?.apolices?.length && (
                  <p className="text-sm text-dark-muted">Nenhuma apólice encontrada para este cliente.</p>
                )}

                {endossoApoliceId && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Motivo do endosso" value={endossoForm.motivo} onChange={v => setEndossoForm(f => ({ ...f, motivo: v }))} placeholder="Ex.: troca de veículo" />
                    <Field label="Campo alterado" value={endossoForm.campo_alterado} onChange={v => setEndossoForm(f => ({ ...f, campo_alterado: v }))} placeholder="Ex.: Placa" />
                    <Field label="Informação anterior" value={endossoForm.valor_anterior} onChange={v => setEndossoForm(f => ({ ...f, valor_anterior: v }))} />
                    <Field label="Informação atualizada" value={endossoForm.valor_atual} onChange={v => setEndossoForm(f => ({ ...f, valor_atual: v }))} />
                    <Field label="Valor do endosso" value={endossoForm.valor_endosso} onChange={v => setEndossoForm(f => ({ ...f, valor_endosso: v }))} type="text" inputMode="decimal" placeholder="0,00" />
                  </div>
                )}

                {endossoApoliceId && (
                  <button
                    onClick={() => salvarEndosso()}
                    disabled={salvandoEndosso || !endossoForm.motivo.trim()}
                    className="btn-primary disabled:opacity-60"
                  >
                    {salvandoEndosso ? 'Salvando...' : 'Criar cotação de endosso'}
                  </button>
                )}
              </div>
            </DataCard>
          ) : (
            <>
              <DataCard title="Buscar cliente e apólice" subtitle="Renovação de um cliente/apólice específico, mesmo que ainda não esteja na lista de pendentes abaixo.">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRenovacaoClienteExiste(true)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${renovacaoClienteExiste ? 'border-brand-accent bg-brand-accent/10 text-status-info' : 'border-dark-border text-dark-muted hover:border-brand-accent/40'}`}
                  >
                    Cliente já cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenovacaoClienteExiste(false)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${!renovacaoClienteExiste ? 'border-brand-accent bg-brand-accent/10 text-status-info' : 'border-dark-border text-dark-muted hover:border-brand-accent/40'}`}
                  >
                    Cliente novo (ainda não cadastrado)
                  </button>
                </div>

                {renovacaoClienteExiste ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label="Buscar cliente (nome ou CPF)" value={renovacaoBuscaCliente} onChange={setRenovacaoBuscaCliente} placeholder="Nome ou CPF" />
                      <button onClick={handleBuscarClienteRenovacao} disabled={buscandoRenovacaoCliente} className="btn-secondary disabled:opacity-60">
                        {buscandoRenovacaoCliente ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>

                    {renovacaoCliente?.apolices?.length > 0 && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-dark-muted">Apólice (mais recente primeiro)</label>
                        <select
                          value={renovacaoApoliceId}
                          onChange={e => setRenovacaoApoliceId(e.target.value)}
                          className="input w-full"
                        >
                          <option value="">Selecionar apólice</option>
                          {renovacaoCliente.apolices.map(apolice => (
                            <option key={apolice.id} value={apolice.id}>
                              {apolice.numero_apolice || 'Sem número'} · {apolice.seguradora} · {apolice.modelo_veiculo || 'veículo não informado'}{apolice.placa ? ` (${apolice.placa})` : ''} · vigência {apolice.vigencia_inicio} a {apolice.vigencia_fim}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {renovacaoClienteRef && !buscandoRenovacaoCliente && !renovacaoCliente?.apolices?.length && (
                      <p className="text-sm text-dark-muted">Nenhuma apólice encontrada para este cliente.</p>
                    )}

                    {renovacaoApoliceId && (
                      <button
                        onClick={() => iniciarRenovacaoPorApolice()}
                        disabled={iniciandoRenovacaoPorApolice}
                        className="btn-primary disabled:opacity-60"
                      >
                        {iniciandoRenovacaoPorApolice ? 'Criando...' : 'Criar/abrir cotação de renovação'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Nome completo" value={renovacaoNovoCliente.nome_completo} onChange={v => setRenovacaoNovoCliente(f => ({ ...f, nome_completo: v }))} />
                      <Field label="CPF" value={renovacaoNovoCliente.cpf} onChange={v => setRenovacaoNovoCliente(f => ({ ...f, cpf: v }))} />
                      <Field label="Celular" value={renovacaoNovoCliente.celular} onChange={v => setRenovacaoNovoCliente(f => ({ ...f, celular: v }))} />
                      <Field label="Modelo do veículo" value={renovacaoNovoCliente.modelo_veiculo} onChange={v => setRenovacaoNovoCliente(f => ({ ...f, modelo_veiculo: v }))} />
                      <Field label="Placa" value={renovacaoNovoCliente.placa} onChange={v => setRenovacaoNovoCliente(f => ({ ...f, placa: v }))} placeholder="Opcional" />
                    </div>
                    <button
                      onClick={() => salvarRenovacaoClienteNovo(renovacaoNovoCliente)}
                      disabled={salvandoRenovacaoClienteNovo || !renovacaoNovoCliente.nome_completo || !renovacaoNovoCliente.cpf}
                      className="btn-primary disabled:opacity-60"
                    >
                      {salvandoRenovacaoClienteNovo ? 'Salvando...' : 'Criar cotação de renovação'}
                    </button>
                  </div>
                )}
              </DataCard>

              <DataCard title="Cotar renovacao" subtitle="Selecione a apolice a renovar. A cotacao criada fica automaticamente vinculada a essa renovacao.">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                <input
                  value={searchRenovacao}
                  onChange={e => setSearchRenovacao(e.target.value)}
                  placeholder="Buscar por cliente, seguradora, apolice, veiculo ou placa..."
                  className="input pl-10"
                />
              </div>

              <div className="mt-4 space-y-2">
                {loadingRenovacoes ? (
                  <div className="py-10 text-center text-sm text-dark-muted">Carregando renovacoes...</div>
                ) : renovacoesDisponiveis.length === 0 ? (
                  <EmptyState
                    icon={<RefreshCw className="h-5 w-5" />}
                    title="Nenhuma renovacao encontrada"
                    description="Ajuste a busca ou confira a area de Renovacoes para ver a carteira completa."
                  />
                ) : (
                  renovacoesDisponiveis.map(item => {
                    const apolice = item.apolices_auto || {}
                    const dias = diasParaVencer(item.vigencia_fim)
                    const selecionada = renovacaoSelecionadaId === item.id
                    const jaTemCotacao = Boolean(item.cotacao_id)
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setRenovacaoSelecionadaId(item.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          selecionada
                            ? 'border-brand-accent bg-brand-accent/10'
                            : 'border-dark-border/70 hover:border-brand-accent/40 hover:bg-dark-surface2/30'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-dark-text">{item.clientes_auto?.nome_completo || 'Cliente sem nome'}</p>
                          {jaTemCotacao && <span className="badge badge-info">Ja possui cotacao</span>}
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-dark-muted sm:grid-cols-2 lg:grid-cols-4">
                          <span>Veiculo: {apolice.modelo_veiculo || '—'}{apolice.placa ? ` · ${apolice.placa}` : ''}</span>
                          <span className="inline-flex items-center gap-1.5">
                            {item.seguradora ? <SeguradoraBadge nome={item.seguradora} size="xs" /> : 'Seguradora nao informada'}
                          </span>
                          <span>Vigencia fim: {item.vigencia_fim ? new Date(`${item.vigencia_fim}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</span>
                          <span>{formatDiasParaVencer(dias)}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => cotarRenovacaoSelecionada(renovacaoSelecionadaId)}
                  disabled={!renovacaoSelecionadaId || iniciandoRenovacao}
                  className="btn-primary"
                >
                  {iniciandoRenovacao ? 'Criando cotacao...' : 'Criar/abrir cotacao de renovacao'}
                </button>
                <button type="button" onClick={() => setTab('lista')} className="btn-secondary">
                  Voltar para lista
                </button>
              </div>
              </DataCard>
            </>
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 self-start">
          <DataCard title="Tendencia" subtitle="Volume mensal da base completa">
            {loadingSerie || loadingResumo ? (
              <div className="py-10 text-center text-sm text-dark-muted">Carregando serie...</div>
            ) : serieMensal.some(item => item.total > 0 || item.convertidas > 0 || item.perdidas > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={serieMensal} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="total" name="Total" fill="#f5582a" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="convertidas" name="Convertidas" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="Sem serie suficiente"
                description="A tendencia mensal aparece assim que houver cotacoes registradas."
              />
            )}
          </DataCard>

          <DataCard title="Ultimas cotacoes" subtitle="Registros mais recentes da base" bodyClassName="p-0">
            {loadingLista ? (
              <div className="px-5 py-10 text-center text-sm text-dark-muted">Carregando ultimas cotacoes...</div>
            ) : cotacoesRecentes.length === 0 ? (
              <div className="px-5 py-5">
                <EmptyState
                  icon={<ShieldHalf className="h-5 w-5" />}
                  title="Nenhuma cotacao recente"
                  description="As cotacoes criadas aparecerao aqui assim que forem registradas."
                />
              </div>
            ) : (
              <div className="divide-y divide-dark-border/70">
                {cotacoesRecentes.map(item => (
                  <Link
                    key={item.id}
                    to={`/auto/cotacoes/${item.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-dark-surface2/30"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Segurado</p>
                        <p className="truncate text-sm font-semibold text-dark-text">
                          {item.nome_cliente || item.cpf_cliente || 'Sem identificacao'}
                        </p>
                        <p className="truncate text-xs text-dark-muted">
                          {item.celular_cliente ? `${item.celular_cliente} · ` : ''}{formatDateTimeBR(item.updated_at || item.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <QuoteStatusBadge status={item.status} />
                        <span className={`badge ${item.tipo === 'novo' ? 'badge-info' : 'badge-muted'}`}>
                          {item.tipo === 'novo' ? 'Seguro novo' : 'Renovacao'}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DataCard>

          <DataCard title="Resumo rapido" subtitle="Leitura operacional do funil">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-dark-muted">Convertidas no mes</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{convertidas}</p>
              </div>
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-dark-muted">Perdidas no mes</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{perdidas}</p>
              </div>
            </div>
          </DataCard>
        </div>
      </div>

      <DataCard
        title="Acesso completo"
        subtitle="Abrir a lista principal a qualquer momento."
        actions={(
          <button onClick={() => setTab('lista')} className="btn-primary text-sm">
            Ir para lista
          </button>
        )}
      >
        <p className="text-sm text-dark-muted">
          A area de cotacoes agora centraliza a lista completa, organizada por recencia, com acesso aos detalhes de cada registro e aos formularios de criacao.
        </p>
      </DataCard>
    </div>
  )
}
