import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getDashboardAutoMetrics, getGraficoEmissoesMensais } from '../../lib/auto'

const KPIS = [
  { key: 'novosNoMes',           label: 'Novos no mês' },
  { key: 'renovacoesNoMes',      label: 'Renovações no mês' },
  { key: 'cotacoesNoMes',        label: 'Cotações no mês' },
  { key: 'renovacoesConcluidas', label: 'Renovações concluídas' },
  { key: 'vencendoProximoMes',   label: 'Vencendo próximo mês' },
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

  if (loadingMetrics || loadingGrafico) {
    return <div className="p-6 text-gray-400">Carregando...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Seguro Auto — Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {KPIS.map(k => (
          <div key={k.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-3xl font-bold">{metrics?.[k.key] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-base font-semibold mb-4">Emissões mensais</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={grafico}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="novos" name="Novos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="renovacoes" name="Renovações" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
