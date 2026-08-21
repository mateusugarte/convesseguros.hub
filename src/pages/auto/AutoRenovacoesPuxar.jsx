import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { ArrowLeft, Check, ClipboardPaste, Link2, Plus, RefreshCw, Search, Trash2, Upload, UserCheck, XCircle } from 'lucide-react'
import {
  criarRenovacoesEmLote,
  getAutoRenovacaoMesStatus,
  getClientesAutoParaVinculo,
  getRenovacoesAuto,
  marcarMesRenovacaoConcluido,
  puxarRenovacoesDoSistema,
} from '../../lib/auto'
import { parseAutoComissaoPlanilha } from '../../lib/autoComissaoImport'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { DataCard, EmptyState, PageHeader } from '../../components/ui'
import OperationalSpreadsheet from '../../components/auto/OperationalSpreadsheet'
import RenewalInsuredEditor from '../../components/auto/RenewalInsuredEditor'
import { subtrairDiasUteis } from './autoShared'
import { suggestRenewalClientByName } from '../../lib/autoOperational'

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' }, { value: 'em_andamento', label: 'Cotando' },
  { value: 'enviada', label: 'Enviada' }, { value: 'negociando', label: 'Aguardando retorno' },
  { value: 'renovada', label: 'Emitida / renovada' }, { value: 'outra_corretora', label: 'Outra corretora' },
  { value: 'nao_renovada', label: 'Cancelada' },
]

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(value) {
  const [year, month] = String(value).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function monthLastDay(value) {
  const [year, month] = String(value).split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}
function shiftYear(value, offset) {
  const [year, month] = String(value).split('-').map(Number)
  return `${year + offset}-${String(month).padStart(2, '0')}`
}
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase() }
function newDraft(index, month, values = {}) {
  const due = values.vigencia_fim || monthLastDay(month)
  return {
    _id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    vigencia_fim: due,
    seguradora: '', nome_cliente: '', identificacao_veiculo: '', status: 'pendente',
    data_limite_envio: values.data_limite_envio || subtrairDiasUteis(due, 7),
    pct_comissao_atual: '', pct_comissao_anterior: '', cliente_id: '', cliente_nome: '',
    link_decision: 'pending', origem: 'manual', ...values,
  }
}
function blankRows(month, count = 12) { return Array.from({ length: count }, (_, index) => newDraft(index, month)) }
function findSuggestion(row, clients) { return row.cliente_id || row.link_decision === 'custom' ? null : suggestRenewalClientByName(row.nome_cliente, clients) }
function sheetNameForMonth(names, monthRef) {
  const [year, month] = monthRef.split('-').map(Number)
  const monthName = normalize(new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }))
  return names.find(name => normalize(name).includes(monthName) && normalize(name).includes(String(year))) || names[names.length - 1]
}

export default function AutoRenovacoesPuxar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [month, setMonth] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [draftRows, setDraftRows] = useState(() => blankRows(searchParams.get('mes') || currentMonthRef()))
  const [editingRow, setEditingRow] = useState(null)
  const uploadRef = useRef(null)

  const { data: clients = [] } = useQuery({ queryKey: ['auto-clientes-vinculo-renovacoes'], queryFn: getClientesAutoParaVinculo, staleTime: 60_000 })
  const { data: existing = [], isLoading, isError, error } = useQuery({ queryKey: ['auto-renovacoes', 'mes_atual', month], queryFn: () => getRenovacoesAuto({ periodo: 'mes_atual', mes: month }) })
  const { data: monthStatus } = useQuery({ queryKey: ['auto-renovacao-mes-status-unico', month], queryFn: async () => (await getAutoRenovacaoMesStatus([month]))[month] || null })

  const invalidate = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] }),
  ])
  const systemMutation = useMutation({
    mutationFn: () => puxarRenovacoesDoSistema(month),
    onSuccess: async result => { await invalidate(); toast({ type: 'success', title: 'Renovações puxadas', message: `${result.criadas} nova(s) de ${result.encontradas} encontrada(s).` }) },
    onError: err => toast({ type: 'error', title: 'Erro ao puxar do sistema', message: err?.message || 'Tente novamente.' }),
  })
  const validRows = useMemo(() => draftRows.filter(row => row.nome_cliente.trim() && row.vigencia_fim), [draftRows])
  const pendingLinks = useMemo(() => validRows.filter(row => findSuggestion(row, clients) && !row.cliente_id && row.link_decision !== 'custom'), [validRows, clients])
  const saveMutation = useMutation({
    mutationFn: () => criarRenovacoesEmLote(month, validRows),
    onSuccess: async result => { setDraftRows(blankRows(month)); await invalidate(); toast({ type: 'success', title: 'Mês atualizado', message: `${result.criadas} renovação(ões) adicionada(s); ${result.ignoradas} repetida(s) ignorada(s).` }) },
    onError: err => toast({ type: 'error', title: 'Erro ao salvar planilha', message: err?.message || 'Revise as linhas.' }),
  })
  const completeMutation = useMutation({
    mutationFn: () => marcarMesRenovacaoConcluido(month, user?.id),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['auto-renovacao-mes-status'] }), queryClient.invalidateQueries({ queryKey: ['auto-renovacao-mes-status-unico', month] })]); toast({ type: 'success', title: 'Mês marcado como concluído' }) },
  })

  const updateRow = (id, fields) => setDraftRows(rows => rows.map(row => row._id === id ? { ...row, ...fields } : row))
  const commitCell = (row, column, value) => {
    const fields = { [column.field]: value }
    if (column.field === 'nome_cliente') Object.assign(fields, { cliente_id: '', cliente_nome: '', link_decision: 'pending' })
    if (column.field === 'vigencia_fim' && value) fields.data_limite_envio = subtrairDiasUteis(value, 7)
    updateRow(row._id, fields)
  }
  const bulkCommit = changes => {
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => {
      const fields = { ...(grouped.get(row._id) || {}), [column.field]: value }
      if (column.field === 'nome_cliente') Object.assign(fields, { cliente_id: '', cliente_nome: '', link_decision: 'pending' })
      if (column.field === 'vigencia_fim' && value) fields.data_limite_envio = subtrairDiasUteis(value, 7)
      grouped.set(row._id, fields)
    })
    setDraftRows(rows => rows.map(row => grouped.has(row._id) ? { ...row, ...grouped.get(row._id) } : row))
  }
  const linkClient = (row, client) => updateRow(row._id, { cliente_id: client.id, cliente_nome: client.nome_completo, nome_cliente: client.nome_completo, link_decision: 'existing' })
  const keepCustom = row => updateRow(row._id, { cliente_id: '', cliente_nome: '', link_decision: 'custom' })

  const columns = useMemo(() => [
    { field: 'vigencia_fim', label: 'Data de vencimento', type: 'date', editable: true, width: 145 },
    { field: 'seguradora', label: 'Cia', editable: true, width: 135, placeholder: 'Seguradora' },
    { field: 'nome_cliente', label: 'Segurado', editable: true, sticky: true, width: 220, placeholder: 'Nome do segurado' },
    { field: 'identificacao_veiculo', label: 'Veículo', editable: true, width: 190, placeholder: 'Veículo / placa' },
    { field: 'status', label: 'Status', type: 'select', editable: true, width: 132, options: STATUS_OPTIONS },
    { field: 'data_limite_envio', label: 'Limite', type: 'date', editable: true, width: 118 },
    { field: 'pct_comissao_atual', label: 'Comissão %', type: 'number', step: '0.01', editable: true, width: 100, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao_anterior', label: 'Com. passada %', type: 'number', step: '0.01', editable: true, width: 115, parse: value => value === '' ? null : Number(value) },
    { key: 'link', label: 'Vínculo com cliente', width: 290, render: row => { const suggestion = findSuggestion(row, clients); if (row.cliente_id) return <div className="renewal-link-status is-linked"><UserCheck /><span><strong>Vinculado</strong><small>{row.cliente_nome || row.nome_cliente}</small></span><button onClick={() => setEditingRow(row)}>Trocar</button></div>; if (suggestion && row.link_decision !== 'custom') return <div className="renewal-link-suggestion"><span><strong>Cliente encontrado</strong><small>{suggestion.nome_completo} · {suggestion.cpf || 'sem CPF'}</small></span><button className="is-accept" onClick={() => linkClient(row, suggestion)}><Check />Vincular</button><button onClick={() => keepCustom(row)}>Não</button></div>; return <button className="renewal-link-search" onClick={() => setEditingRow(row)}><Search />{row.link_decision === 'custom' ? 'Nome personalizado · alterar' : 'Pesquisar cliente existente'}</button> } },
    { key: 'remove', label: '', width: 50, render: row => <button className="ops-sheet-icon-button is-danger" title="Remover linha" onClick={() => setDraftRows(rows => rows.filter(item => item._id !== row._id))}><Trash2 /></button> },
  ], [clients])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (uploadRef.current) uploadRef.current.value = ''
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const sourceMonth = shiftYear(month, -1)
      const sheetName = sheetNameForMonth(workbook.SheetNames, sourceMonth)
      const rows = parseAutoComissaoPlanilha(workbook, sheetName).map((row, index) => newDraft(index, month, {
        nome_cliente: row.nome_cliente || '', seguradora: row.seguradora || '', vigencia_fim: row.vigencia_fim || monthLastDay(month),
        data_limite_envio: row.vigencia_fim ? subtrairDiasUteis(row.vigencia_fim, 7) : '', pct_comissao_anterior: row.pct_comissao ?? '', origem: 'xls',
      }))
      setDraftRows(rows.length ? [...rows, ...blankRows(month, 5)] : blankRows(month))
      toast({ type: 'info', title: 'Planilha carregada para revisão', message: `${rows.length} linha(s). Confirme os vínculos sugeridos antes de salvar.` })
    } catch (err) { toast({ type: 'error', title: 'Erro ao ler planilha', message: err?.message || 'Arquivo inválido.' }) }
  }

  const changeMonth = value => {
    const next = value || currentMonthRef()
    if (validRows.length && !window.confirm('Trocar o mês descartará as linhas ainda não salvas. Continuar?')) return
    setMonth(next)
    setDraftRows(blankRows(next))
  }

  return <div className="auto-page auto-operation-page animate-fade-in">
    <PageHeader eyebrow="Operação Auto · Preparação" title="Organizar renovações" description={`Monte a planilha de ${monthLabel(month)}, cole várias células e confirme possíveis clientes existentes antes de gravar.`} actions={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes?mes=${month}`)}><ArrowLeft className="h-4 w-4" />Voltar ao resumo</button><input className="input" type="month" value={month} onChange={event => changeMonth(event.target.value)} /><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>Abrir renovações salvas</button></div>} />

    <section className="renewal-pull-command"><div><span><RefreshCw /></span><div><strong>Fontes do mês</strong><small>Puxe da carteira ou carregue uma planilha para revisar na grade abaixo.</small></div></div><button onClick={() => systemMutation.mutate()} disabled={systemMutation.isPending}>{systemMutation.isPending ? 'Puxando…' : 'Puxar do sistema'}</button><input ref={uploadRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} hidden /><button onClick={() => uploadRef.current?.click()}><Upload />Carregar .xlsx</button><button className={monthStatus?.concluido_em ? 'is-complete' : ''} onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}><Check />{monthStatus?.concluido_em ? 'Mês concluído' : 'Marcar mês concluído'}</button></section>

    <section className="ops-sheet-workspace renewal-builder-workspace"><header className="ops-sheet-toolbar"><div className="ops-sheet-title"><span><ClipboardPaste /></span><div><strong>Planilha de entrada · {monthLabel(month)}</strong><small>{validRows.length} linha(s) preenchida(s) · cole diretamente em qualquer célula</small></div></div><button onClick={() => setDraftRows(rows => [...rows, ...blankRows(month, 10)])}><Plus />Adicionar 10 linhas</button><button className="is-active" disabled={!validRows.length || pendingLinks.length > 0 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'Salvando…' : pendingLinks.length ? `Revise ${pendingLinks.length} vínculo(s)` : `Salvar ${validRows.length || ''} renovação(ões)`}</button></header><div className="ops-sheet-help"><span>Cole a partir da Data de vencimento</span><span>Datas 31/08/2026 são reconhecidas</span><span>Enter/↑/↓ navegam</span><span>Vínculos nunca são automáticos sem confirmação</span></div><OperationalSpreadsheet rows={draftRows} columns={columns} getRowId={row => row._id} getRowClassName={row => `is-renewal-status-${row.status || 'pendente'}`} onCommit={commitCell} onBulkCommit={bulkCommit} className="is-renewal-builder" emptyMessage="Adicione uma linha para começar." statusLabel={`${validRows.length} linha(s) pronta(s) para salvar`} /></section>

    <DataCard title={`Já salvas em ${monthLabel(month)}`} subtitle={`${existing.length} renovação(ões) no sistema. A edição completa fica em Abrir renovações.`} actions={<button className="btn-primary" onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>ABRIR RENOVAÇÕES</button>}>{isLoading ? <div className="py-8 text-center text-sm text-dark-muted">Carregando…</div> : isError ? <EmptyState icon={<XCircle />} title="Erro ao carregar renovações" description={error?.message || 'Tente novamente.'} /> : <div className="renewal-saved-preview">{existing.slice(0, 8).map(row => <div key={row.id}><strong>{row.clientes_auto?.nome_completo || row.nome_segurado_anterior || row.apolices_auto?.nome_cliente || 'Sem nome'}</strong><span>{row.seguradora || 'Sem seguradora'} · {row.vigencia_fim ? new Date(`${row.vigencia_fim}T12:00:00`).toLocaleDateString('pt-BR') : 'sem data'}</span></div>)}{existing.length > 8 && <button onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>Ver mais {existing.length - 8}</button>}</div>}</DataCard>

    {editingRow && <RenewalInsuredEditor initialName={editingRow.nome_cliente} initialClientId={editingRow.cliente_id} onClose={() => setEditingRow(null)} onSave={fields => { updateRow(editingRow._id, { cliente_id: fields.cliente_id || '', cliente_nome: fields.cliente?.nome_completo || '', nome_cliente: fields.nome_segurado_anterior, link_decision: fields.cliente_id ? 'existing' : 'custom' }); setEditingRow(null) }} />}
  </div>
}
