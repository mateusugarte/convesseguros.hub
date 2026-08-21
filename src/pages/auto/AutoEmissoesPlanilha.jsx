import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, FilePlus2, FileSpreadsheet, FileUp, Plus, Search, ShieldCheck, X } from 'lucide-react'
import {
  atualizarEmissaoPlanilhaAuto,
  calcularValorComissaoAuto,
  getEmissaoColuna,
  getEmissoesAuto,
  salvarPropostaPlanilhaAuto,
} from '../../lib/auto'
import { AUTO_PIPELINE_STAGES, AUTO_TIPO_META, scoreCotacaoSuggestion } from '../../lib/autoOperational'
import { useToast } from '../../contexts/ToastContext'
import { EmptyState, PageHeader } from '../../components/ui'
import OperationalSpreadsheet from '../../components/auto/OperationalSpreadsheet'
import AutoPolicyImportSheet from '../../components/auto/AutoPolicyImportSheet'

const STAGES = AUTO_PIPELINE_STAGES.slice(2)
const TYPES = [{ value: 'novo', label: 'Seguro novo' }, { value: 'renovacao', label: 'Renovação' }, { value: 'endosso', label: 'Endosso' }]

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function monthRange(value) {
  const [year, month] = String(value).split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return { inicio: `${year}-${String(month).padStart(2, '0')}-01`, fim: `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}` }
}
function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
function policyFor(row) { return Array.isArray(row.apolices_auto) ? row.apolices_auto[0] : row.apolices_auto }
function nameFor(row) { return row.nome_cliente || row.cotacoes_auto?.nome_cliente || policyFor(row)?.nome_cliente || '' }
function vehicleFor(row) { return [row.modelo_veiculo || row.cotacoes_auto?.modelo_veiculo || policyFor(row)?.modelo_veiculo, row.placa || row.cotacoes_auto?.placa || policyFor(row)?.placa].filter(Boolean).join(' · ') }
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function exportCsv(rows) {
  const headers = ['Data de transmissão', 'Vigência', 'Segurado', 'Parcelas', 'Seguradora', 'Prêmio líquido', '% comissão', 'Valor comissão', 'Repasse', 'Corretor', 'Tipo', 'Emissor', 'Status', 'Veículo', 'Placa']
  const values = rows.map(row => [row.data_transmissao, row.vigencia_inicio, nameFor(row), row.parcelamento, row.seguradora, row.premio_liquido, row.pct_comissao, row.valor_comissao, row.valor_repasse, row.responsavel, row.cotacoes_auto?.tipo || row.tipo, row.emissor, getEmissaoColuna(row), row.modelo_veiculo, row.placa])
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const blob = new Blob([[headers, ...values].map(line => line.map(escape).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `emissoes-auto-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

const EMPTY_ROW = { data_transmissao: new Date().toISOString().slice(0, 10), vigencia_inicio: '', nome_cliente: '', modelo_veiculo: '', placa: '', parcelamento: '', seguradora: '', premio_liquido: '', pct_comissao: '', valor_repasse: '', responsavel: '', tipo: 'novo', emissor: '', coluna: 'proposta_transmitida', emissao_id: '', cotacao_id: '' }

export default function AutoEmissoesPlanilha() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonthRef)
  const [search, setSearch] = useState('')
  const [insurer, setInsurer] = useState('todas')
  const [type, setType] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [sort, setSort] = useState({ field: 'data_transmissao', direction: 'desc' })
  const [showComposer, setShowComposer] = useState(false)
  const [showPolicyImport, setShowPolicyImport] = useState(false)
  const [draft, setDraft] = useState(EMPTY_ROW)
  const range = useMemo(() => monthRange(month), [month])

  const { data: rows = [], isLoading, isError, error } = useQuery({ queryKey: ['auto-emissoes', 'planilha', range.inicio, range.fim], queryFn: () => getEmissoesAuto(range) })
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auto-emissoes'] }),
    queryClient.invalidateQueries({ queryKey: ['auto-pendencias'] }),
  ])
  const saveCellMutation = useMutation({
    mutationFn: ({ row, fields }) => atualizarEmissaoPlanilhaAuto(row.id, fields, row),
    onMutate: async ({ row, fields }) => {
      await queryClient.cancelQueries({ queryKey: ['auto-emissoes'] })
      queryClient.setQueriesData({ queryKey: ['auto-emissoes'] }, current => Array.isArray(current) ? current.map(item => item.id === row.id ? { ...item, ...fields } : item) : current)
    },
    onError: err => { invalidate(); toast({ type: 'error', title: 'Célula não salva', message: err?.message || 'Tente novamente.' }) },
    onSettled: invalidate,
  })
  const createMutation = useMutation({
    mutationFn: salvarPropostaPlanilhaAuto,
    onSuccess: async () => { await invalidate(); setDraft(EMPTY_ROW); setShowComposer(false); toast({ type: 'success', title: 'Proposta transmitida', message: 'A linha foi criada e sincronizada com a Pipeline.' }) },
    onError: err => toast({ type: 'error', title: 'Linha não criada', message: err?.message || 'Confira os dados.' }),
  })

  const suggestions = useMemo(() => {
    if (draft.emissao_id || draft.nome_cliente.trim().length < 2) return []
    return rows.map(row => ({ row, score: scoreCotacaoSuggestion(row, draft.nome_cliente, draft.data_transmissao) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score).slice(0, 5).map(item => item.row)
  }, [draft.data_transmissao, draft.emissao_id, draft.nome_cliente, rows])
  const chooseSuggestion = row => setDraft(current => ({ ...current, emissao_id: row.id, cotacao_id: row.cotacao_id || row.cotacoes_auto?.id || '', nome_cliente: nameFor(row), modelo_veiculo: row.modelo_veiculo || row.cotacoes_auto?.modelo_veiculo || '', placa: row.placa || row.cotacoes_auto?.placa || '', vigencia_inicio: row.vigencia_inicio || row.cotacoes_auto?.vigencia_inicio || '', parcelamento: row.parcelamento || '', seguradora: row.seguradora || '', premio_liquido: row.premio_liquido ?? '', pct_comissao: row.pct_comissao ?? '', valor_repasse: row.valor_repasse ?? '', responsavel: row.responsavel || '', tipo: row.cotacoes_auto?.tipo || row.tipo || 'novo', emissor: row.emissor || '' }))

  const insurers = useMemo(() => [...new Set(rows.map(row => row.seguradora).filter(Boolean))].sort(), [rows])
  const filtered = useMemo(() => {
    const term = normalize(search)
    return rows.filter(row => {
      if (insurer !== 'todas' && row.seguradora !== insurer) return false
      if (type !== 'todos' && (row.cotacoes_auto?.tipo || row.tipo || 'novo') !== type) return false
      if (status !== 'todos' && getEmissaoColuna(row) !== status) return false
      if (term && !normalize([nameFor(row), vehicleFor(row), row.seguradora, row.numero_apolice, policyFor(row)?.numero_apolice, row.responsavel].join(' ')).includes(term)) return false
      return true
    }).sort((a, b) => {
      const get = row => sort.field === 'nome_cliente' ? nameFor(row) : (row[sort.field] ?? '')
      const comparison = String(get(a)).localeCompare(String(get(b)), 'pt-BR', { numeric: true })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [rows, search, insurer, type, status, sort])

  const updateStatus = (row, next) => {
    if (['cotacao_feita', 'proposta_transmitida', 'apolice_emitida'].includes(next)) {
      navigate(`/auto/emissoes/${row.id}`)
      toast({ type: 'info', title: 'Complete a movimentação', message: 'Esta etapa exige os mesmos dados e validações da Pipeline.' })
      return
    }
    saveCellMutation.mutate({ row, fields: { coluna: next } })
  }
  const columns = useMemo(() => [
    { field: 'data_transmissao', label: 'Transmissão', type: 'date', editable: true, sortable: true, width: 124 },
    { field: 'vigencia_inicio', label: 'Vigência', type: 'date', editable: true, sortable: true, width: 118 },
    { field: 'nome_cliente', label: 'Segurado', editable: true, sortable: true, sticky: true, width: 220, getValue: nameFor },
    { field: 'parcelamento', label: 'Parcelas', editable: true, width: 90 },
    { field: 'seguradora', label: 'Seguradora', editable: true, sortable: true, width: 140 },
    { field: 'premio_liquido', label: 'Prêmio líquido', type: 'number', step: '0.01', editable: true, width: 118, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao', label: '% comissão', type: 'number', step: '0.01', editable: true, width: 98, parse: value => value === '' ? null : Number(value) },
    { field: 'valor_comissao', label: 'Valor comissão', width: 118, format: money },
    { field: 'valor_repasse', label: 'Repasse', type: 'number', step: '0.01', editable: true, width: 105, parse: value => value === '' ? null : Number(value) },
    { field: 'responsavel', label: 'Corretor', editable: true, sortable: true, width: 130 },
    { field: 'tipo', label: 'O que é', type: 'select', editable: true, width: 120, options: TYPES, getValue: row => row.cotacoes_auto?.tipo || row.tipo || 'novo' },
    { field: 'emissor', label: 'Emissor', editable: true, width: 120 },
    { field: 'status', label: 'Status', width: 175, render: row => <select value={getEmissaoColuna(row)} onChange={event => updateStatus(row, event.target.value)}>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select> },
    { field: 'modelo_veiculo', label: 'Veículo', editable: true, width: 175, getValue: row => row.modelo_veiculo || row.cotacoes_auto?.modelo_veiculo || policyFor(row)?.modelo_veiculo || '' },
    { field: 'placa', label: 'Placa', editable: true, width: 92, getValue: row => row.placa || row.cotacoes_auto?.placa || policyFor(row)?.placa || '' },
    { key: 'policy', label: 'Apólice', width: 125, render: row => { const policy = policyFor(row); return policy?.id ? <button className="ops-sheet-policy" onClick={() => navigate(`/auto/apolices/${policy.id}`)}><ShieldCheck />Ver apólice</button> : <span className="ops-sheet-no-policy">Sem apólice</span> } },
    { key: 'open', label: 'Ficha', width: 75, render: row => <button className="ops-sheet-icon-button" title="Abrir ficha completa" onClick={() => navigate(`/auto/emissoes/${row.id}`)}><ExternalLink /></button> },
  ], [navigate, saveCellMutation, toast])

  const saveCell = (row, column, value) => saveCellMutation.mutate({ row, fields: { [column.field]: value === '' ? null : value } })
  const bulkSave = changes => {
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => grouped.set(row.id, { row, fields: { ...(grouped.get(row.id)?.fields || {}), [column.field]: value === '' ? null : value } }))
    Array.from(grouped.values()).forEach(change => saveCellMutation.mutate(change))
  }
  const handleSort = field => setSort(current => current.field === field ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' })
  const commission = calcularValorComissaoAuto(draft.premio_liquido || 0, draft.pct_comissao || 0)

  return <div className="auto-page auto-operation-page animate-fade-in">
    <PageHeader eyebrow="Operação Auto · Apólices" title="Planilha de emissões" description="Edite a produção diretamente, cole blocos completos e suba apólices com revisão antes de gravar." actions={<div className="flex flex-wrap gap-2"><input className="input" type="month" value={month} onChange={event => setMonth(event.target.value || currentMonthRef())} /><button className="btn-secondary" onClick={() => navigate('/auto/emissoes')}>Voltar para apólices</button><button className="btn-secondary" onClick={() => setShowComposer(value => !value)}><Plus className="h-4 w-4" />Nova linha</button><button className="btn-primary" onClick={() => setShowPolicyImport(value => !value)}><FileUp className="h-4 w-4" />Subir apólices</button></div>} />
    {showPolicyImport && <AutoPolicyImportSheet onClose={() => setShowPolicyImport(false)} />}
    {showComposer && <section className="ops-sheet-composer"><header><span><FilePlus2 /></span><div><strong>Nova proposta transmitida</strong><small>Digite livremente ou selecione uma cotação sugerida.</small></div><button onClick={() => setShowComposer(false)}><X /></button></header><div className="ops-composer-grid"><label className="is-suggestion"><span>Segurado</span><input value={draft.nome_cliente} onChange={event => setDraft(current => ({ ...current, nome_cliente: event.target.value, emissao_id: '', cotacao_id: '' }))} placeholder="Nome do cliente" />{suggestions.length > 0 && <div>{suggestions.map(row => <button key={row.id} onClick={() => chooseSuggestion(row)}><strong>{nameFor(row)}</strong><small>{AUTO_TIPO_META[row.cotacoes_auto?.tipo || row.tipo || 'novo']?.label} · {vehicleFor(row) || 'Veículo não informado'}</small></button>)}</div>}</label>{[['data_transmissao', 'Transmissão', 'date'], ['vigencia_inicio', 'Vigência', 'date'], ['seguradora', 'Seguradora', 'text'], ['parcelamento', 'Parcelas', 'text'], ['premio_liquido', 'Prêmio líquido', 'number'], ['pct_comissao', '% comissão', 'number'], ['valor_repasse', 'Repasse', 'number'], ['responsavel', 'Corretor', 'text'], ['emissor', 'Emissor', 'text'], ['modelo_veiculo', 'Veículo', 'text'], ['placa', 'Placa', 'text']].map(([field, label, inputType]) => <label key={field}><span>{label}</span><input type={inputType} step={inputType === 'number' ? '0.01' : undefined} value={draft[field]} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}<label><span>Tipo</span><select value={draft.tipo} onChange={event => setDraft(current => ({ ...current, tipo: event.target.value }))}>{TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="ops-composer-total"><span>Comissão calculada</span><strong>{money(commission)}</strong></div><button className="btn-primary" disabled={!draft.nome_cliente.trim() || createMutation.isPending} onClick={() => createMutation.mutate(draft)}>{createMutation.isPending ? 'Salvando…' : draft.emissao_id ? 'Vincular e transmitir' : 'Adicionar linha'}</button></div></section>}
    <section className="ops-sheet-workspace"><header className="ops-sheet-toolbar"><div className="ops-sheet-title"><span><FileSpreadsheet /></span><div><strong>Emissões do período</strong><small>{filtered.length} de {rows.length} linhas · clique em qualquer célula para editar</small></div></div><label className="ops-sheet-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, veículo, placa, apólice ou corretor" /></label><select value={insurer} onChange={event => setInsurer(event.target.value)}><option value="todas">Todas as seguradoras</option>{insurers.map(value => <option key={value}>{value}</option>)}</select><select value={type} onChange={event => setType(event.target.value)}><option value="todos">Todos os tipos</option>{TYPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)}><option value="todos">Todos os status</option>{STAGES.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><button onClick={() => exportCsv(filtered)}><Download />Exportar Excel/CSV</button></header><div className="ops-sheet-help"><span>Segurado fica congelado ao rolar</span><span>Enter/↑/↓ navegam</span><span>Cole a partir de Data de transmissão</span><span>Veículo e placa ficam nas últimas colunas</span><span>Use “Ver apólice” quando emitida</span></div>{isLoading ? <div className="ops-sheet-loading">Carregando emissões…</div> : isError ? <EmptyState icon={<FileSpreadsheet />} title="Erro ao carregar emissões" description={error?.message || 'Tente recarregar.'} /> : <OperationalSpreadsheet rows={filtered} columns={columns} getRowClassName={row => `is-emission-stage-${getEmissaoColuna(row)}`} onCommit={saveCell} onBulkCommit={bulkSave} sort={sort} onSort={handleSort} className="is-emissions" emptyMessage="Nenhuma emissão corresponde aos filtros." statusLabel={saveCellMutation.isPending ? 'Salvando alterações…' : 'Tudo salvo'} />}</section>
  </div>
}
