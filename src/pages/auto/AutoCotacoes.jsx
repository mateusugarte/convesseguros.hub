import { useMemo, useState } from 'react'
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
import { Link } from 'react-router-dom'
import { AlertCircle, BadgeDollarSign, Briefcase, CalendarDays, Car, CircleCheckBig, Heart, Mail, Phone, Search, ShieldHalf, Sparkles, TrendingUp, UserRound } from 'lucide-react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { criarCotacaoAuto, getAutoCotacoesMensais, getAutoCotacoesResumo, getCotacoesAuto } from '../../lib/auto'
import { COTACAO_STATUS, formatDateTimeBR, formatMoney, statusToneClass, toneClasses } from './autoShared'

const LISTA_TABS = [
  { value: 'lista', label: 'Lista' },
  { value: 'novo', label: 'Novo seguro' },
  { value: 'renovacao', label: 'Renovacao' },
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

const REN_VAZIO = {
  cpf: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  seguradora_preferencial: { nome: '', premio_total: '', premio_liquido: '', pct_comissao: '' },
  seguradora_mais_barata: { nome: '', premio_total: '', premio_liquido: '', pct_comissao: '' },
}

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return <span className={`badge ${toneClasses(meta.tone)}`}>{meta.label}</span>
}

function Field({ label, value, onChange, type = 'text', placeholder, children }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-dark-muted">{label}</label>
      {children || (
        <input
          type={type}
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

function calcComissao(seg) {
  const premioLiquido = parseFloat(seg.premio_liquido) || 0
  const pctComissao = parseFloat(seg.pct_comissao) || 0
  return premioLiquido * pctComissao
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
  const [tab, setTab] = useState('lista')
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('90d')
  const [searchLista, setSearchLista] = useState('')
  const [novo, setNovo] = useState(NOVO_VAZIO)
  const [renovacao, setRenovacao] = useState(REN_VAZIO)
  const [erro, setErro] = useState(null)
  const qc = useQueryClient()

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
      cliente_id: `${(payload.cpf || '').replace(/\D/g, '')}_${new Date().toISOString().split('T')[0]}`,
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

  const { mutateAsync: salvarRenovacao, isPending: salvandoRenovacao } = useMutation({
    mutationFn: async payload => criarCotacaoAuto({
      cliente_id: `${(payload.cpf || '').replace(/\D/g, '')}_${new Date().toISOString().split('T')[0]}`,
      tipo: 'renovacao',
      status: 'pendente',
      cpf_cliente: payload.cpf || null,
      vigencia_inicio: payload.vigencia_inicio || null,
      vigencia_fim: payload.vigencia_fim || null,
      seguradora_preferencial: {
        ...payload.seguradora_preferencial,
        valor_comissao: calcComissao(payload.seguradora_preferencial),
      },
      seguradora_mais_barata: {
        ...payload.seguradora_mais_barata,
        valor_comissao: calcComissao(payload.seguradora_mais_barata),
      },
    }),
    onSuccess: async () => {
      setErro(null)
      setRenovacao(REN_VAZIO)
      await invalidar()
      setTab('lista')
    },
    onError: err => setErro(err?.message || 'Erro ao salvar renovacao.'),
  })

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
    <div className="space-y-6">
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
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
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
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-white/75 p-4 shadow-sm">
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
                ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
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
                            ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
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
                          ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
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
                          ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary'
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
          ) : (
            <DataCard title="Renovacao" subtitle="Comparativo entre seguradora preferencial e mais barata.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={iconLabel(UserRound, 'CPF do cliente')} value={renovacao.cpf} onChange={value => setRenovacao(prev => ({ ...prev, cpf: value }))} />
                <Field label={iconLabel(CalendarDays, 'Vigencia inicio')} type="date" value={renovacao.vigencia_inicio} onChange={value => setRenovacao(prev => ({ ...prev, vigencia_inicio: value }))} />
                <Field label={iconLabel(CalendarDays, 'Vigencia fim')} type="date" value={renovacao.vigencia_fim} onChange={value => setRenovacao(prev => ({ ...prev, vigencia_fim: value }))} />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[
                  { key: 'seguradora_preferencial', title: 'Seguradora preferencial' },
                  { key: 'seguradora_mais_barata', title: 'Seguradora mais barata' },
                ].map(section => (
                  <div key={section.key} className="rounded-2xl border border-dark-border/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">{section.title}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label={iconLabel(Briefcase, 'Nome')}>
                        <SeguradoraSelect
                          value={renovacao[section.key].nome}
                          onChange={value => setRenovacao(prev => ({
                            ...prev,
                            [section.key]: { ...prev[section.key], nome: value },
                          }))}
                          produto="auto"
                          placeholder="Selecionar seguradora"
                        />
                      </Field>
                      <Field label={iconLabel(BadgeDollarSign, 'Premio total')} type="number" value={renovacao[section.key].premio_total} onChange={value => setRenovacao(prev => ({
                        ...prev,
                        [section.key]: { ...prev[section.key], premio_total: value },
                      }))} />
                      <Field label={iconLabel(BadgeDollarSign, 'Premio liquido')} type="number" value={renovacao[section.key].premio_liquido} onChange={value => setRenovacao(prev => ({
                        ...prev,
                        [section.key]: { ...prev[section.key], premio_liquido: value },
                      }))} />
                      <Field label={iconLabel(BadgeDollarSign, '% Comissao')} type="number" value={renovacao[section.key].pct_comissao} onChange={value => setRenovacao(prev => ({
                        ...prev,
                        [section.key]: { ...prev[section.key], pct_comissao: value },
                      }))} />
                    </div>
                    <div className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${statusToneClass('success')}`}>
                      Comissao estimada: {formatMoney(calcComissao(renovacao[section.key]))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => salvarRenovacao(renovacao)}
                  disabled={salvandoRenovacao || !renovacao.cpf}
                  className="btn-primary"
                >
                  {salvandoRenovacao ? 'Salvando...' : 'Salvar renovacao'}
                </button>
                <button type="button" onClick={() => setTab('lista')} className="btn-secondary">
                  Voltar para lista
                </button>
              </div>
            </DataCard>
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
