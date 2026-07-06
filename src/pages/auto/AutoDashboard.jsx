import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  BarChart3, CalendarDays, Car, FileText, RefreshCw, ShieldCheck, TrendingUp,
  DollarSign, Percent, AlertCircle, ArrowRight,
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

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthRef(monthRef) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  if (!year || !month) return 'mês atual'
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export default function AutoDashboard() {
  const navigate = useNavigate()
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const monthLabel = useMemo(() => formatMonthRef(mesRef), [mesRef])

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['auto-dashboard-metrics', mesRef],
    queryFn: () => getDashboardAutoMetrics({ mes: mesRef }),
  })

  const { data: graficoEmissoes = [], isLoading: loadingEmissoes } = useQuery({
    queryKey: ['auto-grafico-emissoes', mesRef],
    queryFn: () => getGraficoEmissoesMensais(6, mesRef),
  })

  const { data: graficoCotacoes = [], isLoading: loadingCotacoes } = useQuery({
    queryKey: ['auto-grafico-cotacoes-status', mesRef],
    queryFn: () => getGraficoCotacoesStatus(6, mesRef),
  })

  const loading = loadingMetrics || loadingEmissoes || loadingCotacoes

  const kpis = [
    { key: 'novosNoMes', label: 'Novos no mês', hint: 'apólices novas emitidas', tone: 'accent', icon: <Car className="w-5 h-5" /> },
    { key: 'renovacoesNoMes', label: 'Renovações no mês', hint: 'carteira renovada', tone: 'success', icon: <RefreshCw className="w-5 h-5" /> },
    { key: 'cotacoesNoMes', label: 'Cotações no mês', hint: 'entrada comercial', tone: 'secondary', icon: <FileText className="w-5 h-5" /> },
    { key: 'renovacoesConcluidas', label: 'Renovações concluídas', hint: 'status renovada', tone: 'success', icon: <ShieldCheck className="w-5 h-5" /> },
    { key: 'vencendoNoMes', label: 'Vencendo no mês', hint: 'vigência final no período', tone: 'warning', icon: <CalendarDays className="w-5 h-5" /> },
    { key: 'vencendoProximoMes', label: 'Vencendo mês seguinte', hint: 'fila preventiva', tone: 'warning', icon: <TrendingUp className="w-5 h-5" /> },
    { key: 'taxaConversao', label: 'Taxa de conversão', hint: '% de cotações convertidas', tone: 'accent', icon: <Percent className="w-5 h-5" />, format: v => `${v}%` },
    { key: 'renovacoesPendentes', label: 'Renovações pendentes', hint: 'aguardando cotação ou envio', tone: 'danger', icon: <AlertCircle className="w-5 h-5" /> },
    { key: 'comissaoTotal', label: 'Comissão no mês', hint: 'soma das comissões emitidas', tone: 'success', icon: <DollarSign className="w-5 h-5" />, format: formatMoney },
  ]

  const resumoOperacional = [
    { label: 'Cotações do período', value: metrics?.cotacoesNoMes ?? 0, hint: monthLabel },
    { label: 'Conversão', value: `${metrics?.taxaConversao ?? 0}%`, hint: 'cotações que viraram negócio' },
    { label: 'Pendências', value: metrics?.renovacoesPendentes ?? 0, hint: 'itens ainda sem tratativa' },
  ]

  const resumoRenovacao = [
    { label: 'Comissão do mês', value: formatMoney(metrics?.renovacoesComissaoMesAtual ?? 0), hint: monthLabel },
    { label: 'Comissão ano anterior', value: formatMoney(metrics?.renovacoesComissaoAnoAnterior ?? 0), hint: 'mesmo mês do ano anterior' },
    { label: 'Diferença de comissão', value: formatMoney(metrics?.renovacoesComissaoDiferenca ?? 0), hint: 'crescimento ou retração' },
  ]

  const tendenciaConversao = graficoCotacoes.map(item => {
    const total = item.abertas + item.convertidas + item.perdidas
    return {
      ...item,
      taxa: total > 0 ? Math.round((item.convertidas / total) * 100) : 0,
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Dashboard Auto"
        description={`Leitura executiva de novos negócios, renovações, comissão e conversão do módulo Auto em ${monthLabel}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-surface/75 px-3 py-2 text-sm text-dark-text">
              <CalendarDays className="h-4 w-4 text-dark-muted" />
              <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value || currentMonthRef())} className="bg-transparent outline-none" />
            </label>
            <button onClick={() => navigate('/auto/renovacoes')} className="btn-secondary inline-flex items-center gap-2">
              Abrir renovações
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
        stats={kpis.map(item => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={item.format ? item.format(metrics?.[item.key] ?? 0) : (metrics?.[item.key] ?? (loading ? '...' : 0))}
            hint={item.hint}
            tone={item.tone}
            icon={item.icon}
          />
        ))}
      />

      <DataCard className="overflow-hidden border-brand-accent/15" bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/12 via-transparent to-brand-secondary/10 p-6 md:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-brand-secondary/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-dark-surface/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                <BarChart3 className="h-3.5 w-3.5" />
                Recorte de {monthLabel}
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Uma mesa única para cotar, renovar e emitir.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-dark-muted">
                O painel passa a respeitar o mês escolhido para que a leitura executiva do Auto acompanhe exatamente o período analisado.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-info">{metrics?.cotacoesNoMes ?? 0} cotações</span>
                <span className="badge badge-success">{metrics?.taxaConversao ?? 0}% conversão</span>
                <span className="badge badge-warning">{metrics?.renovacoesPendentes ?? 0} pendências</span>
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

      <DataCard title="Renovações Auto" subtitle={`Comparativo da carteira renovada em ${monthLabel}.`}>
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Prêmio líquido do mês</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoMesAtual ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Prêmio líquido ano anterior</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoAnoAnterior ?? 0)}</p>
          </div>
          <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Diferença de prêmio líquido</p>
            <p className="mt-2 text-xl font-semibold text-dark-text">{formatMoney(metrics?.renovacoesPremioLiquidoDiferenca ?? 0)}</p>
          </div>
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Emissões mensais" subtitle={`Novos negócios vs renovações até ${monthLabel}.`}>
          {loadingEmissoes ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-dark-muted">Carregando emissões...</div>
          ) : graficoEmissoes.length === 0 || graficoEmissoes.every(item => item.novos === 0 && item.renovacoes === 0) ? (
            <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="Sem emissão suficiente" description="O comparativo mensal aparece quando houver emissão no módulo Auto." />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoEmissoes} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="novos" name="Novos" fill="#ff2d55" radius={[10, 10, 0, 0]} />
                  <Bar dataKey="renovacoes" name="Renovações" fill="#10b981" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DataCard>

        <DataCard title="Funil de cotações" subtitle={`Pendentes, convertidas e perdidas até ${monthLabel}.`}>
          {loadingCotacoes ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-dark-muted">Carregando cotações...</div>
          ) : graficoCotacoes.length === 0 || graficoCotacoes.every(item => item.abertas === 0 && item.convertidas === 0 && item.perdidas === 0) ? (
            <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="Sem cotações suficientes" description="O funil mensal aparece quando houver cotações registradas." />
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

      <DataCard title="Tendência de conversão" subtitle={`Evolução mensal da taxa de conversão até ${monthLabel}.`}>
        {loadingCotacoes ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-dark-muted">Carregando tendência...</div>
        ) : tendenciaConversao.every(item => item.convertidas === 0 && item.abertas === 0 && item.perdidas === 0) ? (
          <EmptyState icon={<Percent className="w-5 h-5" />} title="Sem dados de conversão" description="A tendência de conversão aparece assim que houver cotações com status atualizado." />
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tendenciaConversao} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.06)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(122,97,109,0.72)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="taxa" name="Taxa de conversão" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DataCard>
    </div>
  )
}
