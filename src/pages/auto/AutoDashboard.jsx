import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChart3, Car, FileText, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react'
import { getDashboardAutoMetrics, getGraficoEmissoesMensais } from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'

const KPI_META = [
  { key: 'novosNoMes', label: 'Novos no mes', hint: 'apolices novas emitidas', tone: 'accent', icon: <Car className="w-5 h-5" /> },
  { key: 'renovacoesNoMes', label: 'Renovacoes no mes', hint: 'carteira renovada', tone: 'success', icon: <RefreshCw className="w-5 h-5" /> },
  { key: 'cotacoesNoMes', label: 'Cotacoes no mes', hint: 'entrada comercial', tone: 'secondary', icon: <FileText className="w-5 h-5" /> },
  { key: 'renovacoesConcluidas', label: 'Renovacoes concluidas', hint: 'status renovada', tone: 'warning', icon: <ShieldCheck className="w-5 h-5" /> },
  { key: 'vencendoProximoMes', label: 'Vencendo proximo mes', hint: 'fila preventiva', tone: 'accent', icon: <TrendingUp className="w-5 h-5" /> },
]

export default function AutoDashboard() {
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['auto-dashboard-metrics'],
    queryFn: getDashboardAutoMetrics,
  })

  const { data: grafico = [], isLoading: loadingGrafico } = useQuery({
    queryKey: ['auto-grafico-emissoes'],
    queryFn: () => getGraficoEmissoesMensais(6),
  })

  const loading = loadingMetrics || loadingGrafico

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Dashboard Auto"
        description="Leitura executiva de novos negocios, renovacoes e emissao do modulo Auto em uma unica superficie."
        stats={KPI_META.map(item => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={metrics?.[item.key] ?? (loading ? '...' : 0)}
            hint={item.hint}
            tone={item.tone}
            icon={item.icon}
          />
        ))}
      />

      <DataCard
        title="Emissoes mensais"
        subtitle="Comparativo entre novos negocios e renovacoes nos ultimos seis meses"
      >
        {loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-dark-muted">
            Carregando indicadores do modulo Auto...
          </div>
        ) : grafico.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="w-6 h-6" />}
            title="Sem emissao suficiente"
            description="Assim que houver emissao no modulo Auto, o comparativo mensal aparece aqui."
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
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
    </div>
  )
}
