import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  BarChart3, Car, FileText, RefreshCw, ShieldCheck, TrendingUp,
  DollarSign, Percent, AlertCircle,
} from 'lucide-react'
import {
  getDashboardAutoMetrics,
  getGraficoEmissoesMensais,
  getGraficoCotacoesStatus,
} from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}

const KPI_META = [
  { key: 'novosNoMes', label: 'Novos no mes', hint: 'apolices novas emitidas', tone: 'accent', icon: <Car className="w-5 h-5" /> },
  { key: 'renovacoesNoMes', label: 'Renovacoes no mes', hint: 'carteira renovada', tone: 'success', icon: <RefreshCw className="w-5 h-5" /> },
  { key: 'cotacoesNoMes', label: 'Cotacoes no mes', hint: 'entrada comercial', tone: 'secondary', icon: <FileText className="w-5 h-5" /> },
  { key: 'renovacoesConcluidas', label: 'Renovacoes concluidas', hint: 'status renovada', tone: 'success', icon: <ShieldCheck className="w-5 h-5" /> },
  { key: 'vencendoProximoMes', label: 'Vencendo proximo mes', hint: 'fila preventiva', tone: 'warning', icon: <TrendingUp className="w-5 h-5" /> },
]

const KPI_EXTRA = [
  { key: 'taxaConversao', label: 'Taxa de conversao', hint: '% cotacoes convertidas no mes', tone: 'accent', icon: <Percent className="w-5 h-5" />, format: v => `${v}%` },
  { key: 'renovacoesPendentes', label: 'Renovacoes pendentes', hint: 'aguardando cotacao ou envio', tone: 'danger', icon: <AlertCircle className="w-5 h-5" /> },
  { key: 'comissaoTotal', label: 'Comissao no mes', hint: 'soma das comissoes emitidas', tone: 'success', icon: <DollarSign className="w-5 h-5" />, format: formatMoney },
]

export default function AutoDashboard() {
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['auto-dashboard-metrics'],
    queryFn: getDashboardAutoMetrics,
  })

  const { data: graficoEmissoes = [], isLoading: loadingEmissoes } = useQuery({
    queryKey: ['auto-grafico-emissoes'],
    queryFn: () => getGraficoEmissoesMensais(6),
  })

  const { data: graficoCotacoes = [], isLoading: loadingCotacoes } = useQuery({
    queryKey: ['auto-grafico-cotacoes-status'],
    queryFn: () => getGraficoCotacoesStatus(6),
  })

  const loading = loadingMetrics || loadingEmissoes || loadingCotacoes

  const allKpis = [...KPI_META, ...KPI_EXTRA]
  const resumoOperacional = [
    {
      label: 'Cotacoes do mes',
      value: metrics?.cotacoesNoMes ?? 0,
      hint: 'entrada comercial ativa',
    },
    {
      label: 'Conversao',
      value: `${metrics?.taxaConversao ?? 0}%`,
      hint: 'cotações que viraram negocio',
    },
    {
      label: 'Pendentes',
      value: metrics?.renovacoesPendentes ?? 0,
      hint: 'itens ainda sem tratativa',
    },
  ]
  const resumoRenovacao = [
    {
      label: 'Comissao este mes',
      value: formatMoney(metrics?.renovacoesComissaoMesAtual ?? 0),
      hint: 'renovacoes emitidas neste mes',
    },
    {
      label: 'Comissao ano anterior',
      value: formatMoney(metrics?.renovacoesComissaoAnoAnterior ?? 0),
      hint: 'mes equivalente do ano passado',
    },
    {
      label: 'Diferenca da comissao',
      value: formatMoney(metrics?.renovacoesComissaoDiferenca ?? 0),
      hint: 'crescimento ou retração do mes',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Dashboard Auto"
        description="Leitura executiva de novos negocios, renovacoes, comissao e conversao do modulo Auto."
        stats={allKpis.map(item => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={item.format
              ? item.format(metrics?.[item.key] ?? 0)
              : (metrics?.[item.key] ?? (loading ? '...' : 0))}
            hint={item.hint}
            tone={item.tone}
            icon={item.icon}
          />
        ))}
      />

      <DataCard
        className="overflow-hidden border-brand-accent/15"
        bodyClassName="p-0"
      >
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/12 via-transparent to-brand-secondary/10 p-6 md:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-brand-secondary/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-dark-surface/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                <BarChart3 className="h-3.5 w-3.5" />
                Leitura executiva
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Uma mesa unica para cotar, renovar e emitir.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-dark-muted">
                O painel prioriza o que entrou no mes, o que converteu e o que ainda precisa de acao,
                sem espalhar a informacao por telas diferentes.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-info">{metrics?.cotacoesNoMes ?? 0} cotacoes</span>
                <span className="badge badge-success">{metrics?.taxaConversao ?? 0}% conversao</span>
                <span className="badge badge-warning">{metrics?.renovacoesPendentes ?? 0} pendencias</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-3 lg:grid-cols-1">
            {resumoOperacional.map(item => (
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/70 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-dark-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </DataCard>

      <DataCard
        title="Renovacoes Auto"
        subtitle="Comparativo mensal da carteira renovada com base em premio liquido e comissao"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {resumoRenovacao.map(item => (
            <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/75 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-dark-muted">{item.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Premio liquido este mes</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoMesAtual ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Premio liquido ano anterior</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoAnoAnterior ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Diferenca de premio liquido</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoDiferenca ?? 0)}</p>
          </div>
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          title="Emissoes mensais"
          subtitle="Novos negocios vs renovacoes nos ultimos 6 meses"
        >
          {loadingEmissoes ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-dark-muted">
              Carregando emissoes...
            </div>
          ) : graficoEmissoes.length === 0 || graficoEmissoes.every(item => item.novos === 0 && item.renovacoes === 0) ? (
            <EmptyState
              icon={<BarChart3 className="w-6 h-6" />}
              title="Sem emissao suficiente"
              description="O comparativo mensal aparece quando houver emissao no modulo Auto."
            />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoEmissoes} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="novos" name="Novos" fill="#ff2d55" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="renovacoes" name="Renovacoes" fill="#10b981" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DataCard>

        <DataCard
          title="Funil de cotacoes"
          subtitle="Pendentes, convertidas e perdidas nos ultimos 6 meses"
        >
          {loadingCotacoes ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-dark-muted">
              Carregando cotacoes...
            </div>
          ) : graficoCotacoes.length === 0 || graficoCotacoes.every(item => item.abertas === 0 && item.convertidas === 0 && item.perdidas === 0) ? (
            <EmptyState
              icon={<TrendingUp className="w-6 h-6" />}
              title="Sem cotacoes suficientes"
              description="O funil mensal aparece quando houver cotacoes registradas."
            />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoCotacoes} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.06)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="abertas" name="Pendentes" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="convertidas" name="Convertidas" fill="#10b981" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="perdidas" name="Perdidas" fill="#ef4444" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DataCard>
      </div>

      <DataCard
        title="Tendencia de conversao"
        subtitle="Evolucao mensal da taxa de conversao de cotacoes"
      >
        {loadingCotacoes ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-dark-muted">
            Carregando tendencia...
          </div>
          ) : graficoCotacoes.every(item => item.convertidas === 0 && item.abertas === 0 && item.perdidas === 0) ? (
          <EmptyState
            icon={<Percent className="w-5 h-5" />}
            title="Sem dados de conversao"
            description="A tendencia de conversao aparece assim que houver cotacoes com status atualizado."
          />
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={graficoCotacoes.map(item => {
                  const total = item.abertas + item.convertidas + item.perdidas
                  return {
                    ...item,
                    taxa: total > 0 ? Math.round((item.convertidas / total) * 100) : 0,
                  }
                })}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.06)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="taxa" name="Taxa de conversao" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DataCard>
    </div>
  )
}
