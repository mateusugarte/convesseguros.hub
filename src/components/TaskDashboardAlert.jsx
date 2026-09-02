import { useQuery } from '@tanstack/react-query'
import { AlarmClock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchTaskAlertSummary } from '../lib/tasks'

export default function TaskDashboardAlert() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['task-alert-summary', user?.id],
    queryFn: () => fetchTaskAlertSummary(user.id),
    enabled: Boolean(user?.id),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  if (!data?.count) return null

  return (
    <section className="dashboard-task-alert" role="alert">
      <span><AlarmClock /></span>
      <div>
        <strong>{data.overdue > 0 ? `${data.overdue} tarefa${data.overdue > 1 ? 's' : ''} atrasada${data.overdue > 1 ? 's' : ''}` : 'Prazo de tarefa se aproximando'}</strong>
        <p>{data.overdue > 0 && data.soon > 0 ? `Além das atrasadas, ${data.soon} tarefa(s) chegam ao limite na próxima hora.` : data.overdue > 0 ? 'Revise sua agenda e conclua ou repasse para o próximo dia útil.' : `${data.soon} tarefa(s) chegam ao horário limite nos próximos 60 minutos.`}</p>
      </div>
      <button type="button" onClick={() => navigate('/tarefas')}>Ver minhas tarefas <ArrowRight /></button>
    </section>
  )
}
