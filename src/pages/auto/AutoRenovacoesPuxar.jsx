import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Check, CheckCircle2, ClipboardPaste, FileSpreadsheet, Link2, ListChecks, Plus, RefreshCw, Search, Sparkles, Trash2, Upload, UserCheck, UsersRound, XCircle } from 'lucide-react'
import {
  criarRenovacoesEmLote,
  getAutoRenovacaoMesStatus,
  getClientesAutoComVeiculos,
  getRenovacoesAuto,
  marcarMesRenovacaoConcluido,
  puxarRenovacoesDoSistema,
} from '../../lib/auto'
import { parseAutoComissaoPlanilha } from '../../lib/autoComissaoImport'
import { alignRenewalDateToMonth, isNamesOnlyRenewalPaste, normalizeRenewalIdentity, parseRenewalPlanningMatrix, renewalDraftIssue } from '../../lib/autoRenewalImport'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState, PageHeader } from '../../components/ui'
import OperationalSpreadsheet from '../../components/auto/OperationalSpreadsheet'
import RenewalInsuredEditor from '../../components/auto/RenewalInsuredEditor'
import { calcularDataLimiteRenovacao } from './autoShared'
import { parseRenovacoesPaste, renewalClientMatchesByName, suggestRenewalClientByName } from '../../lib/autoOperational'

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
    seguradora: '', outra_seguradora: '', nome_cliente: '', identificacao_veiculo: '', status: 'pendente',
    pct_comissao_anterior: '', cliente_id: '', cliente_nome: '',
    link_decision: 'pending', origem: 'manual', ...values,
    vigencia_fim: due,
    data_limite_envio: calcularDataLimiteRenovacao(due),
  }
}
function blankRows(month, count = 12) { return Array.from({ length: count }, (_, index) => newDraft(index, month)) }
function findSuggestion(row, clients) { return row.cliente_id || row.link_decision === 'custom' ? null : suggestRenewalClientByName(row.nome_cliente, clients) }
function exactClientMatches(row, clients) { return renewalClientMatchesByName(row.nome_cliente, clients) }
function sheetNameForMonth(names, monthRef) {
  const [year, month] = monthRef.split('-').map(Number)
  const monthName = normalize(new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }))
  const exactLabel = `${monthName} ${year}`
  return names.find(name => normalize(name) === exactLabel)
    || names.find(name => normalize(name).includes(monthName) && normalize(name).includes(String(year)))
    || names.find(name => normalize(name) === monthName)
    || null
}

function parseRenewalPlanningSheet(workbook, sheetName, monthRef) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return parseRenewalPlanningMatrix(matrix, monthRef)
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
  const [smartPaste, setSmartPaste] = useState('')
  const [showPastePanel, setShowPastePanel] = useState(true)
  const [showLinkReview, setShowLinkReview] = useState(false)
  const uploadRef = useRef(null)

  const { data: clients = [] } = useQuery({ queryKey: ['auto-clientes-vinculo-renovacoes'], queryFn: getClientesAutoComVeiculos, staleTime: 60_000 })
  const { data: existing = [], isLoading, isError, error } = useQuery({ queryKey: ['auto-renovacoes', 'mes_atual', month], queryFn: () => getRenovacoesAuto({ periodo: 'mes_atual', mes: month }) })
  const { data: monthStatus } = useQuery({ queryKey: ['auto-renovacao-mes-status-unico', month], queryFn: async () => (await getAutoRenovacaoMesStatus([month]))[month] || null })

  const invalidate = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-pendencias'] }),
  ])
  const systemMutation = useMutation({
    mutationFn: () => puxarRenovacoesDoSistema(month),
    onSuccess: async result => { await invalidate(); toast({ type: 'success', title: 'Renovações puxadas', message: `${result.criadas} nova(s) de ${result.encontradas} encontrada(s).` }) },
    onError: err => toast({ type: 'error', title: 'Erro ao puxar do sistema', message: err?.message || 'Tente novamente.' }),
  })
  const filledRows = useMemo(() => draftRows.filter(row => String(row.nome_cliente || '').trim()), [draftRows])
  const invalidRows = useMemo(() => filledRows.filter(row => renewalDraftIssue(row, month)), [filledRows, month])
  const validRows = useMemo(() => filledRows.filter(row => !renewalDraftIssue(row, month)), [filledRows, month])
  const pendingLinks = useMemo(() => validRows.filter(row => {
    const exact = exactClientMatches(row, clients)
    if (exact.length) return !row.cliente_id || !String(row.identificacao_veiculo || '').trim()
    return Boolean(findSuggestion(row, clients) && !row.cliente_id && row.link_decision !== 'custom')
  }), [validRows, clients])
  const readyRows = useMemo(() => validRows.filter(row => !pendingLinks.includes(row)), [validRows, pendingLinks])
  const saveMutation = useMutation({
    mutationFn: () => criarRenovacoesEmLote(month, validRows),
    onSuccess: async result => { setDraftRows(blankRows(month)); setShowLinkReview(false); await invalidate(); toast({ type: result.criadas ? 'success' : 'info', title: result.criadas ? 'Renovações adicionadas' : 'Nenhuma linha nova', message: `${result.criadas} renovação(ões) adicionada(s); ${result.ignoradas} repetida(s) ignorada(s).` }) },
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
    if (column.field === 'vigencia_fim') fields.data_limite_envio = calcularDataLimiteRenovacao(value)
    updateRow(row._id, fields)
  }
  const bulkCommit = changes => {
    if (isNamesOnlyRenewalPaste(changes)) {
      const names = new Map(changes.filter(change => String(change.value || '').trim()).map(change => [change.row._id, String(change.value).trim()]))
      setDraftRows(rows => rows.map(row => names.has(row._id) ? { ...row, nome_cliente: names.get(row._id), cliente_id: '', cliente_nome: '', link_decision: 'pending' } : row))
      toast({ type: 'info', title: 'Lista de segurados reconhecida', message: `${names.size} nome(s) foram colocados na coluna Segurado; o vencimento padrão de ${monthLabel(month)} foi mantido.` })
      return
    }
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => {
      const fields = { ...(grouped.get(row._id) || {}), [column.field]: value }
      if (column.field === 'nome_cliente') Object.assign(fields, { cliente_id: '', cliente_nome: '', link_decision: 'pending' })
      if (column.field === 'vigencia_fim') fields.data_limite_envio = calcularDataLimiteRenovacao(value)
      grouped.set(row._id, fields)
    })
    setDraftRows(rows => rows.map(row => grouped.has(row._id) ? { ...row, ...grouped.get(row._id) } : row))
  }
  const linkClient = (row, client) => updateRow(row._id, { cliente_id: client.id, cliente_nome: client.nome_completo, nome_cliente: client.nome_completo, link_decision: 'existing' })
  const keepCustom = row => {
    if (exactClientMatches(row, clients).length) {
      setShowLinkReview(true)
      toast({ type: 'warning', title: 'Cliente já cadastrado', message: 'Selecione o cadastro correspondente e informe o veículo desta renovação.' })
      return
    }
    updateRow(row._id, { cliente_id: '', cliente_nome: '', link_decision: 'custom' })
  }
  const linkAllSuggested = () => setDraftRows(rows => rows.map(row => {
    const suggestion = findSuggestion(row, clients)
    return suggestion ? { ...row, cliente_id: suggestion.id, cliente_nome: suggestion.nome_completo, nome_cliente: suggestion.nome_completo, link_decision: 'existing' } : row
  }))
  const keepAllCustom = () => setDraftRows(rows => rows.map(row => (
    findSuggestion(row, clients) && !exactClientMatches(row, clients).length
      ? { ...row, cliente_id: '', cliente_nome: '', link_decision: 'custom' }
      : row
  )))

  const handleSave = () => {
    if (invalidRows.length) {
      toast({ type: 'error', title: 'Existem datas para corrigir', message: `${invalidRows.length} linha(s) está(ão) com vencimento inválido ou fora de ${monthLabel(month)}.` })
      return
    }
    if (pendingLinks.length) {
      setShowLinkReview(true)
      toast({ type: 'info', title: 'Confirme os clientes encontrados', message: 'Escolha vincular ou manter o nome avulso antes de gravar.' })
      return
    }
    saveMutation.mutate()
  }

  const applySmartPaste = () => {
    const parsed = parseRenovacoesPaste(smartPaste, month).map(normalizeRenewalIdentity)
    if (!parsed.length) {
      toast({ type: 'error', title: 'Nada para importar', message: 'Cole pelo menos um nome ou uma grade copiada do Excel.' })
      return
    }
    const rows = parsed.map((row, index) => newDraft(index, month, { ...row, origem: 'manual' }))
    setDraftRows([...rows, ...blankRows(month, 8)])
    setSmartPaste('')
    setShowPastePanel(false)
    toast({ type: 'success', title: 'Conteúdo organizado na grade', message: `${rows.length} renovação(ões) reconhecida(s). Revise os dados e os vínculos sugeridos.` })
  }

  const columns = useMemo(() => [
    { field: 'vigencia_fim', label: 'Data de vencimento', type: 'date', editable: true, width: 145 },
    { field: 'seguradora', label: 'Seguradora atual', editable: true, width: 155, placeholder: 'Opcional' },
    { field: 'nome_cliente', label: 'Segurado', editable: true, sticky: true, width: 220, placeholder: 'Nome do segurado' },
    { field: 'identificacao_veiculo', label: 'Veículo', editable: true, width: 190, placeholder: 'Opcional · veículo / placa' },
    { field: 'outra_seguradora', label: 'Outra seguradora', editable: true, width: 165, placeholder: 'Opcional' },
    { field: 'status', label: 'Status', type: 'select', editable: true, width: 132, options: STATUS_OPTIONS },
    { field: 'data_limite_envio', label: 'Limite automático', type: 'date', width: 142, consumePaste: true },
    { field: 'pct_comissao_anterior', label: 'Comissão passada %', type: 'number', step: '0.01', editable: true, width: 145, parse: value => value === '' ? null : Number(value) },
    { key: 'link', label: 'Vínculo com cliente', width: 310, render: row => { const suggestion = findSuggestion(row, clients); const exact = exactClientMatches(row, clients); if (row.cliente_id) return <div className={`renewal-link-status is-linked ${!String(row.identificacao_veiculo || '').trim() && exact.length ? 'is-warning' : ''}`}><UserCheck /><span><strong>{!String(row.identificacao_veiculo || '').trim() && exact.length ? 'Informe o veículo' : 'Vinculado'}</strong><small>{row.cliente_nome || row.nome_cliente}</small></span><button onClick={() => setEditingRow(row)}>Trocar</button></div>; if (exact.length > 1) return <button className="renewal-link-search is-warning" onClick={() => { setShowLinkReview(true); setEditingRow(row) }}><AlertTriangle />{exact.length} cadastros com este nome · selecionar</button>; if (suggestion && row.link_decision !== 'custom') return <div className="renewal-link-suggestion"><span><strong>Cliente encontrado</strong><small>{suggestion.nome_completo} · {suggestion.cpf || 'sem CPF'}</small></span><button className="is-accept" onClick={() => linkClient(row, suggestion)}><Check />Vincular</button>{!exact.length && <button onClick={() => keepCustom(row)}>Não</button>}</div>; return <button className="renewal-link-search" onClick={() => setEditingRow(row)}><Search />{row.link_decision === 'custom' ? 'Nome personalizado · alterar' : 'Pesquisar cliente existente'}</button> } },
    { key: 'remove', label: '', width: 50, render: row => <button className="ops-sheet-icon-button is-danger" title="Remover linha" onClick={() => setDraftRows(rows => rows.filter(item => item._id !== row._id))}><Trash2 /></button> },
  ], [clients])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (uploadRef.current) uploadRef.current.value = ''
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const targetSheetName = sheetNameForMonth(workbook.SheetNames, month)
      const planningRows = targetSheetName ? parseRenewalPlanningSheet(workbook, targetSheetName, month) : []
      let rows
      if (planningRows.length) {
        rows = planningRows.map((row, index) => newDraft(index, month, { ...row, origem: 'xls' }))
      } else {
        const sourceMonth = shiftYear(month, -1)
        const sourceSheetName = sheetNameForMonth(workbook.SheetNames, sourceMonth)
        if (!sourceSheetName) throw new Error(`Não encontrei a aba de ${monthLabel(sourceMonth)} nesta planilha.`)
        rows = parseAutoComissaoPlanilha(workbook, sourceSheetName).map((row, index) => {
          const alignedDue = alignRenewalDateToMonth(row.vigencia_fim, month) || monthLastDay(month)
          return newDraft(index, month, {
            nome_cliente: row.nome_cliente || '', seguradora: row.seguradora || '', identificacao_veiculo: row.identificacao_veiculo || '', vigencia_fim: alignedDue,
            pct_comissao_anterior: row.pct_comissao ?? '', origem: 'xls',
          })
        })
      }
      if (!rows.length) throw new Error('A aba foi encontrada, mas não contém renovações reconhecíveis.')
      setDraftRows(rows.length ? [...rows, ...blankRows(month, 5)] : blankRows(month))
      toast({ type: 'info', title: 'Planilha carregada para revisão', message: `${rows.length} linha(s). Confirme os vínculos sugeridos antes de salvar.` })
    } catch (err) { toast({ type: 'error', title: 'Erro ao ler planilha', message: err?.message || 'Arquivo inválido.' }) }
  }

  const changeMonth = value => {
    const next = value || currentMonthRef()
    if (filledRows.length && !window.confirm('Trocar o mês descartará as linhas ainda não salvas. Continuar?')) return
    setMonth(next)
    setDraftRows(blankRows(next))
  }

  return <div className="auto-page auto-operation-page renewal-intake-page animate-fade-in">
    <PageHeader eyebrow="Operação Auto · Carteira" title="Entrada de renovações" description={`Organize ${monthLabel(month)} em três etapas: importe, revise e grave. Nenhuma linha será salva fora do mês escolhido.`} actions={<div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => navigate(`/auto/renovacoes?mes=${month}`)}><ArrowLeft className="h-4 w-4" />Resumo</button><label className="renewal-month-picker"><CalendarClock /><span>Mês da carteira</span><input type="month" value={month} onChange={event => changeMonth(event.target.value)} /></label><button className="btn-primary" onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>Abrir carteira salva <ArrowRight className="h-4 w-4" /></button></div>} />

    <section className="renewal-intake-deck">
      <div className="renewal-intake-source">
        <header><div><span>1 · Entrada dos dados</span><h2>Como você quer montar a carteira?</h2><p>Use qualquer uma das fontes. Tudo vai primeiro para a grade de revisão.</p></div><span className="renewal-intake-month"><CalendarClock />{monthLabel(month)}</span></header>
        <div className="renewal-source-grid">
          <button className={showPastePanel ? 'is-selected' : ''} onClick={() => setShowPastePanel(value => !value)}><span className="is-blue"><ClipboardPaste /></span><div><strong>Colar do Excel</strong><small>Aceita nomes, colunas ou uma tabela completa.</small></div><CheckCircle2 /></button>
          <button onClick={() => uploadRef.current?.click()}><span className="is-violet"><FileSpreadsheet /></span><div><strong>Carregar planilha</strong><small>Importa o mês do ano anterior e corrige o ano.</small></div><Upload /></button>
          <button onClick={() => systemMutation.mutate()} disabled={systemMutation.isPending}><span className="is-teal"><RefreshCw className={systemMutation.isPending ? 'is-spinning' : ''} /></span><div><strong>{systemMutation.isPending ? 'Buscando carteira…' : 'Puxar do sistema'}</strong><small>Encontra apólices que vencem no período.</small></div><ArrowRight /></button>
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} hidden />
        </div>
        {showPastePanel && <div className="renewal-smart-paste"><div><Sparkles /><span><strong>Colagem inteligente</strong><small>Cole somente os nomes ou inclua cabeçalhos como Vencimento, Seguradora atual, Segurado, Veículo, Outra seguradora e Comissão passada.</small></span></div><textarea value={smartPaste} onChange={event => setSmartPaste(event.target.value)} placeholder={'VENCIMENTO\tSEGURADORA ATUAL\tSEGURADO\tVEÍCULO\tOUTRA SEGURADORA\tCOMISSÃO PASSADA\n31/08/2026\tALLIANZ\tMARCELO ALMEIDA\tHR-V\tPORTO\t15%\n31/08/2026\tPORTO\tANA SILVA\tT-CROSS\t\t20%\n\nOu cole apenas uma lista de nomes.'} /><footer><span><ClipboardPaste />Ctrl/⌘ + V para colar</span><button disabled={!smartPaste.trim()} onClick={applySmartPaste}>Interpretar e colocar na grade <ArrowRight /></button></footer></div>}
      </div>
      <aside className="renewal-intake-guide">
        <header><ListChecks /><div><span>Fluxo seguro</span><strong>Antes de gravar</strong></div></header>
        <ol>
          <li className={filledRows.length ? 'is-done' : 'is-current'}><span>{filledRows.length ? <Check /> : '1'}</span><div><strong>Entrada</strong><small>{filledRows.length ? `${filledRows.length} linha(s) recebida(s)` : 'Cole, carregue ou puxe os dados'}</small></div></li>
          <li className={invalidRows.length ? 'is-warning' : pendingLinks.length ? 'is-current' : filledRows.length ? 'is-done' : ''}><span>{!invalidRows.length && filledRows.length && !pendingLinks.length ? <Check /> : '2'}</span><div><strong>Revisão</strong><small>{invalidRows.length ? `${invalidRows.length} data(s) para corrigir` : pendingLinks.length ? `${pendingLinks.length} cliente(s) para confirmar` : filledRows.length ? 'Datas e vínculos conferidos' : 'Valide datas e clientes'}</small></div></li>
          <li className={readyRows.length && !invalidRows.length && !pendingLinks.length ? 'is-current' : ''}><span>3</span><div><strong>Gravar carteira</strong><small>{readyRows.length ? `${readyRows.length} linha(s) prontas` : 'Conclua a revisão primeiro'}</small></div></li>
        </ol>
        <button className={monthStatus?.concluido_em ? 'is-complete' : ''} onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}><CheckCircle2 />{monthStatus?.concluido_em ? 'Mês já concluído' : 'Marcar organização concluída'}</button>
      </aside>
    </section>

    <section className="renewal-intake-health" aria-label="Validação da importação">
      <div className="is-total"><UsersRound /><span><strong>{filledRows.length}</strong><small>segurados na entrada</small></span></div>
      <div className={invalidRows.length ? 'is-danger' : 'is-ok'}>{invalidRows.length ? <AlertTriangle /> : <CheckCircle2 />}<span><strong>{invalidRows.length}</strong><small>datas para corrigir</small></span></div>
      <div className={pendingLinks.length ? 'is-warning' : 'is-ok'}><Link2 /><span><strong>{pendingLinks.length}</strong><small>vínculos para decidir</small></span></div>
      <div className="is-ready"><Check /><span><strong>{readyRows.length}</strong><small>prontas para gravar</small></span></div>
    </section>

    {pendingLinks.length > 0 && <section className={`renewal-link-review ${showLinkReview ? 'is-open' : ''}`}>
      <header><div><span><Link2 /></span><div><strong>Encontramos {pendingLinks.length} possível(is) cliente(s) existente(s)</strong><small>Confirme o vínculo ou mantenha o nome avulso. Nada é anexado automaticamente.</small></div></div><div><button onClick={keepAllCustom}>Manter todos avulsos</button><button className="is-primary" onClick={linkAllSuggested}><UserCheck />Vincular todos sugeridos</button><button className="is-toggle" onClick={() => setShowLinkReview(value => !value)}>{showLinkReview ? 'Recolher' : 'Revisar um a um'}</button></div></header>
      {showLinkReview && <div className="renewal-link-review-grid">{pendingLinks.map(row => { const exact = exactClientMatches(row, clients); const candidates = exact.length ? exact : [findSuggestion(row, clients)].filter(Boolean); return <article key={row._id}><span><UsersRound /></span><div><small>Nome recebido</small><strong>{row.nome_cliente}</strong>{exact.length > 0 && <p><b>Cliente já cadastrado.</b> Selecione o cadastro e informe qual veículo está renovando.</p>}<label className="mt-2 block"><small>Veículo desta renovação</small><input className="mt-1 w-full rounded-lg border border-dark-border px-3 py-2" value={row.identificacao_veiculo || ''} onChange={event => updateRow(row._id, { identificacao_veiculo: event.target.value })} placeholder="Ex.: HR-V · placa ABC1D23" /></label><div className="mt-2 flex flex-wrap gap-2">{candidates.map(client => <button key={client.id} className={row.cliente_id === client.id ? 'is-accept' : ''} onClick={() => linkClient(row, client)}><UserCheck />{client.nome_completo}<small>{client.veiculos?.length ? ` · ${client.veiculos.map(v => v.modelo_veiculo || v.placa).filter(Boolean).slice(0, 2).join(', ')}` : ' · sem veículo anterior'}</small></button>)}</div></div>{!exact.length && <button onClick={() => keepCustom(row)}>Não vincular</button>}<button className="is-accept" disabled={!row.cliente_id || !String(row.identificacao_veiculo || '').trim()} onClick={() => updateRow(row._id, { link_decision: 'existing' })}><Check />Confirmar vínculo</button></article> })}</div>}
    </section>}

    <section className="ops-sheet-workspace renewal-builder-workspace">
      <header className="ops-sheet-toolbar renewal-builder-toolbar"><div className="ops-sheet-title"><span><FileSpreadsheet /></span><div><strong>2 · Grade de revisão · {monthLabel(month)}</strong><small>Edite como no Excel. A primeira coluna também aceita uma lista simples de nomes.</small></div></div><button onClick={() => setDraftRows(rows => [...rows, ...blankRows(month, 10)])}><Plus />10 linhas</button><button className="renewal-save-button is-active" disabled={!filledRows.length || saveMutation.isPending} onClick={handleSave}>{saveMutation.isPending ? 'Gravando carteira…' : invalidRows.length ? `Corrigir ${invalidRows.length} data(s)` : pendingLinks.length ? `Revisar ${pendingLinks.length} vínculo(s)` : `Gravar ${validRows.length} renovação(ões)`}<ArrowRight /></button></header>
      <div className="renewal-sheet-instructions"><span><b>A</b>Cole datas ou uma lista de nomes</span><span><b>C</b>Segurado fica sempre visível</span><span><b>10</b>Limite em dias corridos, ajustado no fim de semana</span><span><b>✓</b>Comissão passada é opcional</span></div>
      <OperationalSpreadsheet rows={draftRows} columns={columns} getRowId={row => row._id} getRowClassName={row => { const issue = row.nome_cliente ? renewalDraftIssue(row, month) : null; return issue ? 'is-renewal-import-error' : `is-renewal-status-${row.status || 'pendente'}` }} onCommit={commitCell} onBulkCommit={bulkCommit} className="is-renewal-builder" emptyMessage="Adicione uma linha para começar." statusLabel={`${readyRows.length} pronta(s) · ${pendingLinks.length} aguardando vínculo · ${invalidRows.length} com erro`} />
    </section>

    <section className="renewal-saved-section">
      <header><div><span>Carteira já gravada</span><h2>{existing.length} renovações em {monthLabel(month)}</h2><p>Abra a planilha operacional para contatos, follow-ups, descontos, notas e mudança de status.</p></div><button onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>Abrir planilha operacional <ArrowRight /></button></header>
      {isLoading ? <div className="renewal-saved-state">Carregando carteira…</div> : isError ? <EmptyState icon={<XCircle />} title="Erro ao carregar renovações" description={error?.message || 'Tente novamente.'} /> : existing.length === 0 ? <div className="renewal-saved-empty"><FileSpreadsheet /><div><strong>Este mês ainda está vazio</strong><small>As renovações gravadas aparecerão aqui.</small></div></div> : <div className="renewal-saved-preview">{existing.slice(0, 8).map(row => <div key={row.id}><span>{row.vigencia_fim ? new Date(`${row.vigencia_fim}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span><div><strong>{row.clientes_auto?.nome_completo || row.nome_segurado_anterior || row.apolices_auto?.nome_cliente || 'Sem nome'}</strong><small>{row.seguradora || 'Sem seguradora'} · {row.identificacao_veiculo || 'Veículo não informado'}</small></div></div>)}{existing.length > 8 && <button onClick={() => navigate(`/auto/renovacoes/planilha?mes=${month}`)}>+ {existing.length - 8} renovações <ArrowRight /></button>}</div>}
    </section>

    {editingRow && <RenewalInsuredEditor initialName={editingRow.nome_cliente} initialClientId={editingRow.cliente_id} onClose={() => setEditingRow(null)} onSave={fields => { updateRow(editingRow._id, { cliente_id: fields.cliente_id || '', cliente_nome: fields.cliente?.nome_completo || '', nome_cliente: fields.nome_segurado_anterior, link_decision: fields.cliente_id ? 'existing' : 'custom' }); setEditingRow(null) }} />}
  </div>
}
