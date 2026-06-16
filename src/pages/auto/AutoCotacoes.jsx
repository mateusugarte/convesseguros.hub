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
import { PageHeader, MetricCard, DataCard, FilterBar, EmptyState } from '../../components/ui'
import {
  criarCotacaoAuto,
  getAutoCotacoesMensais,
  getAutoCotacoesResumo,
  getCotacoesAuto,
} from '../../lib/auto'
import {
  COTACAO_ABAS,
  COTACAO_STATUS,
  formatDateTimeBR,
  formatMoney,
  formatPercent,
  statusToneClass,
  toneClasses,
} from './autoShared'
import {
  AlertCircle,
  BadgeDollarSign,
  CircleCheckBig,
  ShieldHalf,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

const NOVO_VAZIO = {
  nome_completo: '',
  cpf: '',
  celular: '',
  email: '',
  estado_civil: '',
  profissao: '',
  condutor_nome: '',
  condutor_cpf: '',
  estado_civil_condutor: '',
  cep_pernoite: '',
  uso_veiculo: '',
  garagem_residencia: '',
  garagem_trabalho: '',
  garagem_estudo: '',
  jovens_18_26: '',
  modelo_veiculo: '',
  placa: '',
  veiculo_financiado: '',
  possui_kit_gas: '',
  possui_blindagem: '',
  isento_imposto: '',
  origem_lead: '',
}

const SEG_VAZIO = {
  nome: '',
  premio_total: '',
  premio_liquido: '',
  pct_comissao: '',
}

const REN_VAZIO = {
  cpf: '',
  seguradora_preferencial: { ...SEG_VAZIO },
  seguradora_mais_barata: { ...SEG_VAZIO },
}

function gerarClienteId(cpf) {
  const cpfLimpo = (cpf || '').replace(/\D/g, '')
  const hoje = new Date().toISOString().split('T')[0]
  return `${cpfLimpo}_${hoje}`
}

function calcComissao(seg) {
  const premioLiquido = parseFloat(seg.premio_liquido) || 0
  const pctComissao = parseFloat(seg.pct_comissao) || 0
  return premioLiquido * pctComissao
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

function Field({ label, value, onChange, type = 'text', placeholder, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-dark-muted">{label}</label>
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

function QuoteStatusBadge({ status }) {
  const meta = COTACAO_STATUS[status] || COTACAO_STATUS.aberta
  return (
    <span className={`badge ${toneClasses(meta.tone)}`}>
      {meta.label}
    </span>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-dark-muted">{label}</span>
      <span className="text-sm text-dark-text">{value}</span>
    </div>
  )
}

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
  { value: 'todo', label: 'Todo período' },
]

export default function AutoCotacoes() {
  const [aba, setAba] = useState('novo')
  const [formNovo, setFormNovo] = useState(NOVO_VAZIO)
  const [formRen, setFormRen] = useState(REN_VAZIO)
  const [erro, setErro] = useState(null)
  const qc = useQueryClient()

  const { data: cotacoes = [], isLoading: loadingLista } = useQuery({
    queryKey: ['auto-cotacoes', aba],
    queryFn: () => getCotacoesAuto({ tipo: aba }),
  })

  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['auto-cotacoes-resumo', aba],
    queryFn: () => getAutoCotacoesResumo({ tipo: aba }),
  })

  const { data: serieMensal = [], isLoading: loadingSerie } = useQuery({
    queryKey: ['auto-cotacoes-serie', aba],
    queryFn: () => getAutoCotacoesMensais({ tipo: aba }),
  })

  const invalidarQueries = async () => {
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
    await qc.invalidateQueries({ queryKey: ['auto-cotacoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    await qc.invalidateQueries({ queryKey: ['auto-emissoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-renovacoes-resumo'] })
    await qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
    await qc.invalidateQueries({ queryKey: ['auto-dashboard-cotacoes-resumo'] })
  }

  const { mutateAsync: salvarNovo, isPending: salvandoNovo } = useMutation({
    mutationFn: async dados => {
      return criarCotacaoAuto({
        cliente_id: gerarClienteId(dados.cpf),
        nome_cliente: dados.nome_completo || null,
        cpf_cliente: dados.cpf || null,
        celular_cliente: dados.celular || null,
        email_cliente: dados.email || null,
        estado_civil_cliente: dados.estado_civil || null,
        profissao_cliente: dados.profissao || null,
        tipo: 'novo',
        status: 'pendente',
        condutor_nome: dados.condutor_nome || null,
        condutor_cpf: dados.condutor_cpf || null,
        estado_civil_condutor: dados.estado_civil_condutor || null,
        cep_pernoite: dados.cep_pernoite || null,
        uso_veiculo: dados.uso_veiculo || null,
        garagem_residencia: dados.garagem_residencia || null,
        garagem_trabalho: dados.garagem_trabalho || null,
        garagem_estudo: dados.garagem_estudo || null,
        jovens_18_26: dados.jovens_18_26 || null,
        modelo_veiculo: dados.modelo_veiculo || null,
        placa: dados.placa || null,
        veiculo_financiado: dados.veiculo_financiado || null,
        possui_kit_gas: dados.possui_kit_gas || null,
        possui_blindagem: dados.possui_blindagem || null,
        isento_imposto: dados.isento_imposto || null,
        origem_lead: dados.origem_lead || null,
      })
    },
    onSuccess: async () => {
      setErro(null)
      await invalidarQueries()
      setFormNovo(NOVO_VAZIO)
    },
    onError: err => {
      setErro(err?.message || 'Erro ao salvar cotação. Verifique os dados e tente novamente.')
    },
  })

  const { mutateAsync: salvarRenovacao, isPending: salvandoRen } = useMutation({
    mutationFn: async dados => {
      return criarCotacaoAuto({
        cliente_id: gerarClienteId(dados.cpf),
        cpf_cliente: dados.cpf || null,
        tipo: 'renovacao',
        status: 'pendente',
        seguradora_preferencial: {
          ...dados.seguradora_preferencial,
          valor_comissao: calcComissao(dados.seguradora_preferencial),
        },
        seguradora_mais_barata: {
          ...dados.seguradora_mais_barata,
          valor_comissao: calcComissao(dados.seguradora_mais_barata),
        },
      })
    },
    onSuccess: async () => {
      setErro(null)
      await invalidarQueries()
      setFormRen(REN_VAZIO)
    },
    onError: err => {
      setErro(err?.message || 'Erro ao salvar renovação. Verifique os dados e tente novamente.')
    },
  })

  function setNovo(campo, valor) {
    setFormNovo(prev => ({ ...prev, [campo]: valor }))
  }

  function setSeguradora(qual, campo, valor) {
    setFormRen(prev => ({
      ...prev,
      [qual]: { ...prev[qual], [campo]: valor },
    }))
  }

  const agora = new Date()
  const cotacoesMes = cotacoes.filter(item => {
    const created = new Date(item.created_at)
    return created.getMonth() === agora.getMonth() && created.getFullYear() === agora.getFullYear()
  })

  const convertidas = cotacoesMes.filter(item => item.status === 'convertida').length
  const perdidas = cotacoesMes.filter(item => item.status === 'perdida').length
  const taxa = cotacoesMes.length > 0 ? Math.round((convertidas / cotacoesMes.length) * 100) : 0

  const cotacoesRecentes = useMemo(() => cotacoes.slice(0, 6), [cotacoes])

  const metrics = [
    { key: 'total', label: 'Cotacoes no periodo', value: resumo?.total ?? 0, icon: BadgeDollarSign, tone: 'accent' },
    { key: 'mesAtual', label: 'Cotacoes no mes', value: resumo?.mesAtual ?? 0, icon: Sparkles, tone: 'warning' },
    { key: 'convertidas', label: 'Convertidas', value: resumo?.convertidas ?? 0, icon: CircleCheckBig, tone: 'success' },
    { key: 'taxa', label: 'Taxa de conversao', value: `${taxa}%`, icon: TrendingUp, tone: 'secondary' },
  ]

  const tabs = COTACAO_ABAS.map(tab => ({
    ...tab,
    count: aba === tab.value ? cotacoes.length : 0,
  }))

  const resumoLateral = useMemo(() => {
    if (aba === 'novo') {
      return [
        {
          label: 'Segurado',
          value: formNovo.nome_completo || 'Nome pendente',
          hint: formNovo.celular || 'Celular pendente',
        },
        {
          label: 'Contato',
          value: formNovo.email || 'E-mail pendente',
          hint: formNovo.estado_civil || 'Estado civil do segurado',
        },
        {
          label: 'Condutor',
          value: formNovo.condutor_nome || 'Nome do condutor',
          hint: formNovo.estado_civil_condutor || 'Estado civil do condutor',
        },
        {
          label: 'Veiculo',
          value: formNovo.modelo_veiculo || 'Modelo do veiculo',
          hint: formNovo.placa || 'Placa opcional',
        },
      ]
    }

    return [
      {
        label: 'CPF',
        value: formRen.cpf || 'Pendente',
        hint: 'identificacao do cliente',
      },
      {
        label: 'Preferencial',
        value: formRen.seguradora_preferencial.nome || 'Sem nome',
        hint: formatMoney(calcComissao(formRen.seguradora_preferencial)),
      },
      {
        label: 'Mais barata',
        value: formRen.seguradora_mais_barata.nome || 'Sem nome',
        hint: formatMoney(calcComissao(formRen.seguradora_mais_barata)),
      },
      {
        label: 'Comissao',
        value: formatMoney(calcComissao(formRen.seguradora_preferencial)),
        hint: 'estimativa atual',
      },
    ]
  }, [aba, formNovo, formRen])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Cotações"
        description="Fluxo de seguro novo e renovacao com calculo de comissao no frontend e ultimas cotacoes em destaque."
        actions={(
          <>
            <Link to="/auto/dashboard" className="btn-secondary">
              Dashboard
            </Link>
            <Link to="/auto/emissoes" className="btn-primary">
              Ver emissões
            </Link>
          </>
        )}
        stats={metrics.map(({ key, label, value, icon: Icon, tone }) => (
          <MetricCard
            key={key}
            label={label}
            value={value}
            icon={<Icon className="h-4 w-4" />}
            tone={tone}
          />
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
                Workbench de cotacao
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Cadastro com leitura de cliente, condutor e risco em um unico fluxo.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                O cliente é identificado pelo CPF combinado com a data da cotação — sem necessidade de cadastro prévio.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-info">{aba === 'novo' ? 'Seguro novo' : 'Renovacao'}</span>
                <span className="badge badge-success">{resumo?.taxaConversao ? `${Math.round((resumo?.taxaConversao ?? 0) * 100)}% conversao` : `${taxa}% conversao`}</span>
                <span className="badge badge-muted">{resumo?.total ?? 0} registros</span>
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

      <FilterBar
        actions={(
          <div className="text-xs text-dark-muted">
            {resumo?.convertidas ?? 0} convertidas · {resumo?.perdidas ?? 0} perdidas
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setAba(tab.value); setErro(null) }}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-colors ${
                aba === tab.value
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </FilterBar>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {erro && (
            <div className="flex items-start gap-3 rounded-2xl border border-status-danger/20 bg-status-danger/8 px-4 py-3 text-sm text-status-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <DataCard
            title={aba === 'novo' ? 'Novo orçamento' : 'Cotação de renovação'}
            subtitle={aba === 'novo'
              ? 'Cadastro do segurado, do condutor e do risco do veiculo.'
              : 'Comparativo entre seguradora preferencial e mais barata.'}
          >
            {aba === 'novo' ? (
              <div className="space-y-6">
                <div className="grid gap-4 rounded-2xl border border-dark-border/70 p-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Segurado</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nome completo" value={formNovo.nome_completo} onChange={value => setNovo('nome_completo', value)} />
                      <Field label="CPF" value={formNovo.cpf} onChange={value => setNovo('cpf', value)} />
                      <Field label="Celular" value={formNovo.celular} onChange={value => setNovo('celular', value)} />
                      <Field label="E-mail" value={formNovo.email} onChange={value => setNovo('email', value)} />
                      <Field label="Estado civil" value={formNovo.estado_civil} onChange={value => setNovo('estado_civil', value)} />
                      <Field label="Profissão" value={formNovo.profissao} onChange={value => setNovo('profissao', value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Condutor e veículo</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nome do condutor" value={formNovo.condutor_nome} onChange={value => setNovo('condutor_nome', value)} />
                      <Field label="CPF do condutor" value={formNovo.condutor_cpf} onChange={value => setNovo('condutor_cpf', value)} />
                      <Field label="Estado civil do condutor" value={formNovo.estado_civil_condutor} onChange={value => setNovo('estado_civil_condutor', value)} />
                      <Field label="CEP de pernoite" value={formNovo.cep_pernoite} onChange={value => setNovo('cep_pernoite', value)} />
                      <Field label="Uso do veículo" value={formNovo.uso_veiculo} onChange={value => setNovo('uso_veiculo', value)} />
                      <Field label="Modelo do veículo" value={formNovo.modelo_veiculo} onChange={value => setNovo('modelo_veiculo', value)} />
                      <Field label="Placa" value={formNovo.placa} onChange={value => setNovo('placa', value)} placeholder="Opcional" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-dark-border/70 p-4 lg:grid-cols-2">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Risco</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Garagem na residência" value={formNovo.garagem_residencia} onChange={value => setNovo('garagem_residencia', value)} />
                      <Field label="Garagem no trabalho" value={formNovo.garagem_trabalho} onChange={value => setNovo('garagem_trabalho', value)} />
                      <Field label="Garagem no estudo" value={formNovo.garagem_estudo} onChange={value => setNovo('garagem_estudo', value)} />
                      <Field label="Jovens 18-26 usam o veículo" value={formNovo.jovens_18_26} onChange={value => setNovo('jovens_18_26', value)} />
                      <Field label="Veículo financiado" value={formNovo.veiculo_financiado} onChange={value => setNovo('veiculo_financiado', value)} />
                      <Field label="Isento de imposto" value={formNovo.isento_imposto} onChange={value => setNovo('isento_imposto', value)} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">Proteções e origem</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Possui kit gás" value={formNovo.possui_kit_gas} onChange={value => setNovo('possui_kit_gas', value)} />
                      <Field label="Possui blindagem" value={formNovo.possui_blindagem} onChange={value => setNovo('possui_blindagem', value)} />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-dark-muted">Origem do lead</label>
                      <select
                        value={formNovo.origem_lead}
                        onChange={e => setNovo('origem_lead', e.target.value)}
                        className="select"
                      >
                        <option value="">Selecionar</option>
                        <option value="indicacao">Indicação</option>
                        <option value="prospeccao">Prospecção</option>
                        <option value="carteira">Carteira</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => salvarNovo(formNovo)}
                  disabled={salvandoNovo || !formNovo.cpf}
                  className="btn-primary"
                >
                  {salvandoNovo ? 'Salvando...' : 'Salvar cotação'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <Field label="CPF do cliente" value={formRen.cpf} onChange={value => setFormRen(prev => ({ ...prev, cpf: value }))} />

                <div className="grid gap-4 lg:grid-cols-2">
                  {[
                    { key: 'seguradora_preferencial', title: 'Seguradora preferencial' },
                    { key: 'seguradora_mais_barata', title: 'Seguradora mais barata' },
                  ].map(section => (
                    <div key={section.key} className="rounded-2xl border border-dark-border/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dark-muted">{section.title}</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Nome"
                          value={formRen[section.key].nome}
                          onChange={value => setSeguradora(section.key, 'nome', value)}
                        />
                        <Field
                          label="Prêmio total"
                          type="number"
                          value={formRen[section.key].premio_total}
                          onChange={value => setSeguradora(section.key, 'premio_total', value)}
                        />
                        <Field
                          label="Prêmio líquido"
                          type="number"
                          value={formRen[section.key].premio_liquido}
                          onChange={value => setSeguradora(section.key, 'premio_liquido', value)}
                        />
                        <Field
                          label="% Comissão (0.15)"
                          type="number"
                          value={formRen[section.key].pct_comissao}
                          onChange={value => setSeguradora(section.key, 'pct_comissao', value)}
                        />
                      </div>
                      <div className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${statusToneClass('success')}`}>
                        Comissão estimada: {formatMoney(calcComissao(formRen[section.key]))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => salvarRenovacao(formRen)}
                  disabled={salvandoRen || !formRen.cpf}
                  className="btn-primary"
                >
                  {salvandoRen ? 'Salvando...' : 'Salvar cotação'}
                </button>
              </div>
            )}
          </DataCard>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 self-start">
          <DataCard
            title="Tendência"
            subtitle="Volume mensal da aba ativa"
          >
            {loadingSerie || loadingResumo ? (
              <div className="py-10 text-center text-sm text-dark-muted">Carregando série...</div>
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
                title="Sem série suficiente"
                description="A tendência mensal aparece assim que o módulo começar a registrar as primeiras cotações."
              />
            )}
          </DataCard>

          <DataCard
            title="Últimas cotações feitas"
            subtitle="Somente os registros mais recentes da aba atual"
            actions={(
              <Link to="/auto/cotacoes/consulta" className="btn-secondary text-sm">
                Abrir consulta
              </Link>
            )}
            bodyClassName="p-0"
          >
            {loadingLista ? (
              <div className="px-5 py-10 text-center text-sm text-dark-muted">Carregando últimas cotações...</div>
            ) : cotacoesRecentes.length === 0 ? (
              <div className="px-5 py-5">
                <EmptyState
                  icon={<ShieldHalf className="h-5 w-5" />}
                  title="Nenhuma cotação recente"
                  description="As últimas cotações criadas aparecerão aqui assim que forem registradas."
                />
              </div>
            ) : (
              <div className="divide-y divide-dark-border/70">
                {cotacoesRecentes.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-dark-text">
                        {item.nome_cliente || item.cpf_cliente || 'Sem identificação'}
                      </p>
                      <p className="truncate text-xs text-dark-muted">
                        {formatDateTimeBR(item.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <QuoteStatusBadge status={item.status} />
                      {aba === 'novo' ? (
                        <span className="badge badge-info">
                          {item.origem_lead || 'Sem origem'}
                        </span>
                      ) : (
                        <span className="badge badge-muted">
                          {formatPercent(item.seguradora_preferencial?.pct_comissao || 0.15)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>

          <DataCard
            title="Resumo rápido"
            subtitle="Leitura operacional do funil"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-dark-muted">Convertidas no mês</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{convertidas}</p>
              </div>
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-dark-muted">Perdidas no mês</p>
                <p className="mt-2 text-3xl font-semibold text-dark-text">{perdidas}</p>
              </div>
            </div>
          </DataCard>
        </div>
      </div>

      <DataCard
        title="Consulta detalhada"
        subtitle="Acompanhe a lista completa em uma página dedicada com filtros e busca avançada."
        actions={(
          <Link to="/auto/cotacoes/consulta" className="btn-primary text-sm">
            Abrir consulta completa
          </Link>
        )}
      >
        <p className="text-sm text-dark-muted">
          A consulta completa agora fica em uma subpágina própria para deixar a tela principal mais limpa e mais rápida de usar.
        </p>
      </DataCard>
    </div>
  )
}
