import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Clock3, RefreshCw, Table2, XCircle } from 'lucide-react'
import { getRenovacoesAuto } from '../../lib/auto'
import { renewalStatusValue } from '../../lib/autoOperational'
import { DataCard, EmptyState, MetricCard, PageHeader } from '../../components/ui'

const STATUS_META = {
  pendente: { label: 'Pendentes', color: '#f97316' },
  em_andamento: { label: 'Cotando', color: '#f59e0b' },
  cotada: { label: 'Cotadas', color: '#3563e9' },
  enviada: { label: 'Enviadas', color: '#38bdf8' },
  negociando: { label: 'Negociando', color: '#a855f7' },
  renovada: { label: 'Renovadas', color: '#10b981' },
  outra_corretora: { label: 'Outra corretora', color: '#64748b' },
  nao_renovada: { label: 'Canceladas', color: '#ef4444' },
}

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(value) {
  const [year, month] = String(value).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function customerName(row) { return row.clientes_auto?.nome_completo || row.nome_segurado_anterior || row.apolices_auto?.nome_cliente || 'Sem nome' }
function formatDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—' }

export default function AutoRenovacoes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(() => searchParams.get('mes') || currentMonthRef())
  const today = new Date().toISOString().slice(0, 10)
  const setSelectedMonth = value => {
    const nextMonth = value || currentMonthRef()
    setMonth(nextMonth)
    const next = new URLSearchParams(searchParams)
    next.set('mes', nextMonth)
    setSearchParams(next, { replace: true })
  }

  const { data: rows = [], isLoading, isError, error } = useQuery({ queryKey: ['auto-renovacoes', 'mes_atual', month], queryFn: () => getRenovacoesAuto({ periodo: 'mes_atual', mes: month }) })
  const summary = useMemo(() => {
    const counts = Object.fromEntries(Object.keys(STATUS_META).map(key => [key, 0]))
    rows.forEach(row => { const key = renewalStatusValue(row); counts[key] = (counts[key] || 0) + 1 })
    const paraEnviar = rows.filter(row => (row.data_limite_envio || row.vigencia_fim) <= today && ['pendente', 'em_andamento'].includes(renewalStatusValue(row))).length
    const followups = rows.filter(row => row.proximo_followup_em && row.proximo_followup_em <= today).length
    const cotadas = rows.filter(row => ['cotada', 'enviada', 'negociando', 'renovada'].includes(renewalStatusValue(row))).length
    return { counts, paraEnviar, followups, cotadas, renovadas: counts.renovada || 0 }
  }, [rows, today])
  const total = rows.length
  const progress = total ? Math.round((summary.cotadas / total) * 100) : 0
  const urgent = useMemo(() => rows.filter(row => !['renovada', 'nao_renovada', 'outra_corretora'].includes(renewalStatusValue(row))).sort((a, b) => String(a.data_limite_envio || a.vigencia_fim).localeCompare(String(b.data_limite_envio || b.vigencia_fim))).slice(0, 8), [rows])

  return <div className="auto-page space-y-5 animate-fade-in">
    <PageHeader eyebrow="Operação Auto · Renovações" title="Renovações" description={`Acompanhe os números e prioridades de ${monthLabel(month)}. A edição completa fica na planilha operacional.`} actions={<div className="flex flex-wrap gap-2"><input className="input" type="month" value={month} onChange={event => setSelectedMonth(event.target.value)} /><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes/puxar?mes=${month}`)}>Organizar mês</button><button className="btn-primary" onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}><Table2 className="h-4 w-4" />ABRIR RENOVAÇÕES</button></div>} stats={<><MetricCard label="Renovações" value={total} hint={monthLabel(month)} icon={<RefreshCw className="h-5 w-5" />} /><MetricCard label="Para enviar" value={summary.paraEnviar} hint="hoje ou atrasadas" tone="warning" icon={<CalendarClock className="h-5 w-5" />} /><MetricCard label="Follow-ups" value={summary.followups} hint="previstos até hoje" tone="accent" icon={<Clock3 className="h-5 w-5" />} /><MetricCard label="Renovadas" value={summary.renovadas} hint="negócios concluídos" tone="success" icon={<CheckCircle2 className="h-5 w-5" />} /></>} />

    {isLoading ? <div className="ops-sheet-loading">Carregando dados do mês…</div> : isError ? <EmptyState icon={<XCircle />} title="Erro ao carregar renovações" description={error?.message || 'Tente novamente.'} /> : <>
      <DataCard className="overflow-hidden" bodyClassName="p-0"><div className="renewal-month-overview"><div><span><BarChart3 />Andamento de {monthLabel(month)}</span><strong>{progress}% da carteira já cotada</strong><p>{summary.cotadas} de {total} renovações passaram da etapa inicial.</p><div className="renewal-month-progress"><i style={{ width: `${progress}%` }} /></div></div><div className="renewal-status-distribution">{Object.entries(STATUS_META).map(([key, meta]) => { const count = summary.counts[key] || 0; const width = total ? Math.max(3, (count / total) * 100) : 0; return <div key={key}><span><i style={{ background: meta.color }} />{meta.label}</span><strong>{count}</strong><small><i style={{ width: `${width}%`, background: meta.color }} /></small></div> })}</div></div></DataCard>

      <DataCard title="Próximas prioridades" subtitle="Leitura rápida do mês. Para editar nomes, contatos, datas, notas ou status, abra a planilha."><div className="renewal-priority-list">{urgent.length === 0 ? <EmptyState icon={<CheckCircle2 />} title="Nenhuma prioridade pendente" description="As renovações deste mês estão concluídas ou não precisam de ação agora." /> : urgent.map(row => { const status = renewalStatusValue(row); return <button key={row.id} onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}><span className="renewal-priority-date"><small>Limite</small><strong>{formatDate(row.data_limite_envio || row.vigencia_fim)}</strong></span><span className="renewal-priority-person"><strong>{customerName(row)}</strong><small>{row.identificacao_veiculo || row.apolices_auto?.modelo_veiculo || row.seguradora || 'Sem veículo informado'}</small></span><span className="renewal-priority-status" style={{ '--status-color': STATUS_META[status]?.color }}>{STATUS_META[status]?.label || status}</span><ArrowRight /></button> })}</div></DataCard>
    </>}
  </div>
}
