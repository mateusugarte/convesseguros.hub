import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, BarChart3, CalendarClock, Check, CheckCircle2, Clock3, Download, ExternalLink, Filter, MessageSquarePlus, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UserRound, UsersRound, XCircle } from 'lucide-react'
import { atualizarRenovacoesEmLote, atualizarStatusRenovacao, excluirRenovacao, getRenovacoesAuto, marcarRenovacaoCotada } from '../../lib/auto'
import { renewalStatusFields, renewalStatusValue } from '../../lib/autoOperational'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState, PageHeader } from '../../components/ui'
import OperationalSpreadsheet from '../../components/auto/OperationalSpreadsheet'
import RenewalInsuredEditor from '../../components/auto/RenewalInsuredEditor'

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' }, { value: 'em_andamento', label: 'Cotando' },
  { value: 'cotada', label: 'Cotada' }, { value: 'enviada', label: 'Enviada' },
  { value: 'negociando', label: 'Aguardando retorno' }, { value: 'outra_corretora', label: 'Outra corretora' },
  { value: 'renovada', label: 'Emitida / renovada' }, { value: 'nao_renovada', label: 'Cancelada' },
]

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function monthLabel(value) {
  const [year, month] = String(value).split('-').map(Number)
  return year && month ? new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'mês atual'
}
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
function customerName(row) { return row.clientes_auto?.nome_completo || row.nome_segurado_anterior || row.apolices_auto?.nome_cliente || '' }
function vehicleName(row) { return row.identificacao_veiculo || [row.apolices_auto?.modelo_veiculo, row.apolices_auto?.placa].filter(Boolean).join(' · ') || '' }

function exportCsv(rows) {
  const headers = ['Data de vencimento', 'Seguradora atual', 'Segurado', 'Veículo', 'Outra seguradora', 'Status', 'Limite automático', 'Contatos', 'Follow-ups', 'Último contato', 'Próximo follow-up', 'Descontos', 'Desconto %', 'Comissão', 'Comissão passada', 'Notas']
  const values = rows.map(row => [row.vigencia_fim, row.seguradora, customerName(row), vehicleName(row), row.outra_seguradora, renewalStatusValue(row), row.data_limite_envio, row.contatos_realizados, row.followups_realizados, row.ultimo_contato_em, row.proximo_followup_em, row.descontos_realizados, row.desconto_percentual, row.pct_comissao_atual, row.pct_comissao_anterior, row.notas_negociacao])
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const blob = new Blob([[headers, ...values].map(line => line.map(escape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `renovacoes-auto-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function AutoRenovacoesPlanilha() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mesRef, setMesRef] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [busca, setBusca] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [followupFilter, setFollowupFilter] = useState(false)
  const [sendTodayFilter, setSendTodayFilter] = useState(false)
  const [sort, setSort] = useState({ field: 'vigencia_fim', direction: 'asc' })
  const [editingInsured, setEditingInsured] = useState(null)

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('mes', mesRef)
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [mesRef, searchParams, setSearchParams])

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ['auto-renovacoes', 'mes_atual', mesRef], queryFn: () => getRenovacoesAuto({ periodo: 'mes_atual', mes: mesRef }),
  })

  const invalidateOperation = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-emissoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-cotacoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-pendencias'] }),
  ])

  const saveMutation = useMutation({
    mutationFn: ({ id, campos }) => atualizarStatusRenovacao(id, campos),
    onMutate: async ({ id, campos }) => {
      await queryClient.cancelQueries({ queryKey: ['auto-renovacoes'] })
      queryClient.setQueriesData({ queryKey: ['auto-renovacoes'] }, current => Array.isArray(current) ? current.map(row => row.id === id ? { ...row, ...campos } : row) : current)
    },
    onError: err => { invalidateOperation(); toast({ type: 'error', title: 'Célula não salva', message: err?.message || 'Tente novamente.' }) },
    onSettled: invalidateOperation,
  })
  const bulkMutation = useMutation({
    mutationFn: atualizarRenovacoesEmLote,
    onSuccess: () => toast({ type: 'success', title: 'Colagem concluída', message: 'As células foram atualizadas em bloco.' }),
    onError: err => toast({ type: 'error', title: 'Erro na colagem', message: err?.message || 'Revise os valores colados.' }),
    onSettled: invalidateOperation,
  })
  const quotedMutation = useMutation({
    mutationFn: marcarRenovacaoCotada,
    onSuccess: async () => { await invalidateOperation(); toast({ type: 'success', title: 'Cotação concluída', message: 'A renovação já aparece em Cotações feitas na Pipeline.' }) },
    onError: err => toast({ type: 'error', title: 'Não foi possível concluir a cotação', message: err?.message || 'Tente novamente.' }),
  })
  const deleteMutation = useMutation({ mutationFn: excluirRenovacao, onSuccess: invalidateOperation, onError: err => toast({ type: 'error', title: 'Erro ao excluir', message: err?.message || 'Tente novamente.' }) })

  const today = localToday()
  const filteredRows = useMemo(() => {
    const term = normalize(busca)
    return rows.filter(row => {
      if (statusFilter !== 'todos' && renewalStatusValue(row) !== statusFilter) return false
      if (followupFilter && (!row.proximo_followup_em || row.proximo_followup_em > today)) return false
      if (sendTodayFilter && ((row.data_limite_envio || row.vigencia_fim) > today || ['cotada', 'enviada', 'negociando', 'renovada', 'nao_renovada', 'outra_corretora'].includes(renewalStatusValue(row)))) return false
      if (!term) return true
      return normalize([customerName(row), vehicleName(row), row.seguradora, row.outra_seguradora, row.apolices_auto?.numero_apolice, row.notas_negociacao].filter(Boolean).join(' ')).includes(term)
    }).sort((a, b) => {
      const get = row => sort.field === 'nome' ? customerName(row) : (row[sort.field] ?? '')
      const comparison = String(get(a)).localeCompare(String(get(b)), 'pt-BR', { numeric: true })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, busca, statusFilter, followupFilter, sendTodayFilter, sort, today])

  const metrics = useMemo(() => ({
    total: rows.length,
    paraEnviar: rows.filter(row => (row.data_limite_envio || row.vigencia_fim) <= today && !['cotada', 'enviada', 'negociando', 'renovada', 'nao_renovada', 'outra_corretora'].includes(renewalStatusValue(row))).length,
    cotadas: rows.filter(row => ['cotada', 'enviada', 'negociando', 'renovada'].includes(renewalStatusValue(row))).length,
    followups: rows.filter(row => row.proximo_followup_em && row.proximo_followup_em <= today && !['renovada', 'nao_renovada', 'outra_corretora'].includes(renewalStatusValue(row))).length,
    renovadas: rows.filter(row => renewalStatusValue(row) === 'renovada').length,
  }), [rows, today])

  const saveCell = (row, column, value) => {
    if (column.field === 'status') {
      if (value === 'cotada') quotedMutation.mutate(row.id)
      else saveMutation.mutate({ id: row.id, campos: renewalStatusFields(value) })
      return
    }
    saveMutation.mutate({ id: row.id, campos: { [column.field]: value === '' ? null : value } })
  }
  const bulkSave = changes => {
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => {
      if (column.field === 'status') return
      grouped.set(row.id, { ...(grouped.get(row.id) || {}), [column.field]: value === '' ? null : value })
    })
    if (grouped.size) bulkMutation.mutate(Array.from(grouped, ([id, campos]) => ({ id, campos })))
  }
  const quickContact = (row, followup = false) => saveMutation.mutate({ id: row.id, campos: followup ? { followups_realizados: Number(row.followups_realizados || 0) + 1, ultimo_contato_em: today } : { contatos_realizados: Number(row.contatos_realizados || 0) + 1, ultimo_contato_em: today } })

  const columns = useMemo(() => [
    { field: 'vigencia_fim', label: 'Data de vencimento', type: 'date', editable: true, sortable: true, width: 145 },
    { field: 'seguradora', label: 'Seguradora atual', editable: true, sortable: true, width: 155 },
    { field: 'nome', label: 'Segurado', sortable: true, sticky: true, width: 230, render: row => <button className="ops-sheet-primary-link ops-sheet-insured-link" onClick={() => setEditingInsured(row)} title="Editar nome ou vincular cliente"><UserRound /> <span>{customerName(row) || 'Sem nome'}</span></button> },
    { field: 'identificacao_veiculo', label: 'Veículo', editable: true, width: 190, getValue: vehicleName },
    { field: 'outra_seguradora', label: 'Outra seguradora', editable: true, width: 165, placeholder: 'Opcional' },
    { field: 'status', label: 'Status', type: 'select', editable: true, width: 145, options: STATUS_OPTIONS, getValue: renewalStatusValue },
    { field: 'data_limite_envio', label: 'Limite automático', type: 'date', sortable: true, width: 142, consumePaste: true },
    { field: 'contatos_realizados', label: 'Contatos', type: 'number', min: 0, editable: true, width: 86, parse: value => Math.max(0, Number(value) || 0) },
    { field: 'followups_realizados', label: 'Follow-ups', type: 'number', min: 0, editable: true, width: 92, parse: value => Math.max(0, Number(value) || 0) },
    { field: 'ultimo_contato_em', label: 'Último contato', type: 'date', editable: true, width: 126 },
    { field: 'proximo_followup_em', label: 'Próximo follow-up', type: 'date', editable: true, sortable: true, width: 138 },
    { field: 'descontos_realizados', label: 'Descontos', type: 'number', min: 0, editable: true, width: 90, parse: value => Math.max(0, Number(value) || 0) },
    { field: 'desconto_percentual', label: 'Desconto %', type: 'number', step: '0.01', min: 0, max: 100, editable: true, width: 100, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao_atual', label: 'Comissão %', type: 'number', step: '0.01', editable: true, width: 96, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao_anterior', label: 'Com. passada %', type: 'number', step: '0.01', editable: true, width: 112, parse: value => value === '' ? null : Number(value) },
    { field: 'notas_negociacao', label: 'Notas da negociação', type: 'textarea', editable: true, width: 280, placeholder: 'Objeções, retorno e próximos passos' },
    { key: 'actions', label: 'Ações', width: 250, render: row => <div className="ops-sheet-actions"><button title="Registrar contato agora" onClick={() => quickContact(row)}><MessageSquarePlus />Contato</button><button title="Registrar follow-up agora" onClick={() => quickContact(row, true)}><Plus />Follow-up</button>{renewalStatusValue(row) === 'cotada' ? <span className="ops-sheet-done"><Check />Cotada</span> : <button className="is-primary" onClick={() => quotedMutation.mutate(row.id)}><Check />Cotada</button>}{row.cotacao_id && <button title="Abrir cotação" onClick={() => navigate(`/auto/cotacoes/${row.cotacao_id}`)}><ExternalLink /></button>}<button className="is-danger" title="Excluir" onClick={() => window.confirm('Excluir esta renovação definitivamente?') && deleteMutation.mutate(row.id)}><Trash2 /></button></div> },
  ], [navigate, quotedMutation, deleteMutation, saveMutation, today])

  const handleSort = field => setSort(current => current.field === field ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' })
  const progress = metrics.total ? Math.round((metrics.cotadas / metrics.total) * 100) : 0

  return <div className="auto-page auto-operation-page renewal-ledger-page animate-fade-in">
    <PageHeader eyebrow="Operação Auto · Renovações" title="Carteira de renovações" description={`Mesa operacional de ${monthLabel(mesRef)}. Edite qualquer célula, registre contatos e acompanhe o próximo passo de cada cliente.`} actions={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes?mes=${mesRef}`)}><ArrowLeft className="h-4 w-4" />Resumo</button><label className="renewal-month-picker"><CalendarClock /><span>Carteira</span><input type="month" value={mesRef} onChange={event => setMesRef(event.target.value || currentMonthRef())} /></label><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes/puxar?mes=${mesRef}`)}><Plus className="h-4 w-4" />Adicionar</button><button className="btn-primary" onClick={() => navigate('/auto/gestao')}>Abrir Pipeline</button></div>} />

    <section className="renewal-ledger-overview" aria-label="Resumo da carteira">
      <div className="renewal-ledger-progress"><div><span><BarChart3 />Progresso da carteira</span><strong>{progress}%</strong></div><p>{metrics.cotadas} de {metrics.total} renovações já avançaram para cotação.</p><div className="renewal-ledger-progressbar"><i style={{ width: `${progress}%` }} /></div></div>
      <button className={!sendTodayFilter && !followupFilter && statusFilter === 'todos' ? 'is-active' : ''} onClick={() => { setStatusFilter('todos'); setFollowupFilter(false); setSendTodayFilter(false) }}><span className="is-blue"><UsersRound /></span><div><small>Carteira completa</small><strong>{metrics.total}</strong><p>todas as renovações</p></div></button>
      <button className={sendTodayFilter ? 'is-active is-warning' : ''} onClick={() => { setSendTodayFilter(value => !value); setFollowupFilter(false); setStatusFilter('todos') }}><span className="is-amber"><AlertTriangle /></span><div><small>Prioridade agora</small><strong>{metrics.paraEnviar}</strong><p>para enviar hoje</p></div></button>
      <button className={followupFilter ? 'is-active is-coral' : ''} onClick={() => { setFollowupFilter(value => !value); setSendTodayFilter(false); setStatusFilter('todos') }}><span className="is-coral"><Clock3 /></span><div><small>Relacionamento</small><strong>{metrics.followups}</strong><p>follow-ups vencidos</p></div></button>
      <button className={statusFilter === 'renovada' ? 'is-active is-success' : ''} onClick={() => { setStatusFilter(statusFilter === 'renovada' ? 'todos' : 'renovada'); setFollowupFilter(false); setSendTodayFilter(false) }}><span className="is-green"><CheckCircle2 /></span><div><small>Conversão</small><strong>{metrics.renovadas}</strong><p>renovadas / emitidas</p></div></button>
    </section>

    <section className="ops-sheet-workspace renewal-ledger-workspace" aria-label="Planilha operacional de renovações">
      <header className="renewal-ledger-commandbar"><div className="renewal-ledger-title"><span><RefreshCw /></span><div><small>Planilha operacional</small><strong>Renovações de {monthLabel(mesRef)}</strong><p>{filteredRows.length} de {rows.length} linhas visíveis · alterações salvas automaticamente</p></div></div><label className="renewal-ledger-search"><Search /><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Pesquisar cliente, veículo, placa, seguradora ou nota…" />{busca && <button onClick={() => setBusca('')}><XCircle /></button>}</label><div className="renewal-ledger-tools"><label><SlidersHorizontal /><select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setSendTodayFilter(false) }}><option value="todos">Todos os status</option>{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className={sendTodayFilter ? 'is-active' : ''} onClick={() => setSendTodayFilter(value => !value)}><AlertTriangle />Enviar hoje</button><button className={followupFilter ? 'is-active' : ''} onClick={() => setFollowupFilter(value => !value)}><Filter />Follow-ups</button><button onClick={() => exportCsv(filteredRows)}><Download />Exportar</button></div></header>
      <div className="renewal-ledger-ribbon"><div><span className="is-emitted">Emitida / renovada</span><span className="is-cancelled">Cancelada</span><span className="is-sent">Enviada</span><span className="is-waiting">Aguardando retorno</span></div><p><b>Duplo clique não é necessário:</b> clique uma vez no campo e edite · Enter salva e avança · cole blocos do Excel diretamente.</p></div>
      {isLoading ? <div className="ops-sheet-loading">Carregando renovações…</div> : isError ? <EmptyState icon={<XCircle />} title="Erro ao carregar renovações" description={error?.message || 'Tente recarregar a página.'} /> : <OperationalSpreadsheet rows={filteredRows} columns={columns} getRowClassName={row => `is-renewal-status-${renewalStatusValue(row)}`} onCommit={saveCell} onBulkCommit={bulkSave} sort={sort} onSort={handleSort} emptyMessage="Nenhuma renovação corresponde aos filtros." statusLabel={`${filteredRows.length} visível(is) · salvamento automático ativo`} />}
    </section>
    {editingInsured && <RenewalInsuredEditor initialName={customerName(editingInsured)} initialClientId={editingInsured.cliente_id || ''} onClose={() => setEditingInsured(null)} onSave={fields => { saveMutation.mutate({ id: editingInsured.id, campos: { cliente_id: fields.cliente_id, nome_segurado_anterior: fields.nome_segurado_anterior } }); setEditingInsured(null) }} />}
  </div>
}
