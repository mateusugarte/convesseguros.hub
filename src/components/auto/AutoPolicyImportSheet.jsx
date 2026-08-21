import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { Car, Check, CheckCircle2, ClipboardPaste, Download, FileUp, Plus, Trash2, Upload, UserCheck, UserPlus, X } from 'lucide-react'
import { calcularValorComissaoAuto, getClientesAutoComVeiculos, importarApolicesAutoPlanilha } from '../../lib/auto'
import { normalizePolicyImportIdentity, policyClientCandidates, policyVehicleCandidates, suggestPolicyVehicle } from '../../lib/autoPolicyImport'
import { normalizeSpreadsheetNumber } from '../../lib/spreadsheetPaste'
import { useToast } from '../../contexts/ToastContext'
import OperationalSpreadsheet from './OperationalSpreadsheet'

const TYPES = [{ value: 'novo', label: 'Seguro novo' }, { value: 'renovacao', label: 'Renovação' }, { value: 'endosso', label: 'Endosso' }]
const FIELD_ALIASES = {
  data_transmissao: ['data de transmissao', 'transmissao', 'data'],
  vigencia_inicio: ['inicio da vigencia', 'vigencia inicio', 'vigencia'],
  nome_cliente: ['nome do segurado', 'segurado', 'cliente', 'nome'],
  celular_cliente: ['celular do segurado', 'celular', 'telefone', 'whatsapp'],
  numero_apolice: ['numero da apolice', 'n apolice', 'apolice'],
  seguradora: ['seguradora', 'cia', 'companhia'],
  parcelamento: ['parcelamento', 'parcelas', 'qnt de parcelas', 'quantidade de parcelas'],
  forma_pagamento: ['forma de pagamento', 'pagamento'],
  premio_liquido: ['premio liquido', 'premio'],
  pct_comissao: ['comissao percentual', 'percentual de comissao', 'comissao'],
  valor_comissao: ['valor da comissao', 'valor comissao', 'comissao em reais'],
  valor_repasse: ['valor repasse', 'repasse', 'repasse comissao'],
  responsavel: ['responsavel', 'corretor'],
  emissor: ['emissor', 'operador'],
  tipo: ['tipo', 'o que e', 'producao'],
  status: ['status', 'situacao'],
  modelo_veiculo: ['modelo do veiculo', 'veiculo', 'modelo'],
  placa: ['placa do veiculo', 'placa'],
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase()
}

function dateToIso(value) {
  if (!value) return ''
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const raw = String(value).trim()
  const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/)
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function plusOneYear(value) {
  const iso = dateToIso(value)
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function blankRow(index = 0, values = {}) {
  return normalizePolicyImportIdentity({
    _id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    data_transmissao: '', vigencia_inicio: '', vigencia_fim: '', nome_cliente: '', celular_cliente: '', numero_apolice: '', seguradora: '', parcelamento: '', forma_pagamento: '', premio_liquido: '', pct_comissao: '', valor_comissao: '', valor_repasse: '', responsavel: '', emissor: '', tipo: 'novo', status: '', modelo_veiculo: '', placa: '',
    cliente_id: '', vinculo_cliente: '', cliente_confirmado: false, veiculo_confirmado: false, outro_veiculo: false,
    ...values,
  })
}

function blankRows(count = 20) {
  return Array.from({ length: count }, (_, index) => blankRow(index))
}

function fieldForHeader(value) {
  const header = normalize(value)
  return Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.includes(header))?.[0] || null
}

function parseWorkbook(workbook) {
  const parsed = []
  workbook.SheetNames.forEach(sheetName => {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' })
    let headerIndex = -1
    let mapping = []
    for (let index = 0; index < Math.min(matrix.length, 20); index += 1) {
      const candidate = matrix[index].map(fieldForHeader)
      if (candidate.filter(Boolean).length >= 3 && candidate.includes('nome_cliente')) {
        headerIndex = index
        mapping = candidate
        break
      }
    }
    if (headerIndex < 0) return
    matrix.slice(headerIndex + 1).forEach((values, index) => {
      const row = { aba: sheetName, linha: headerIndex + index + 2 }
      mapping.forEach((field, column) => {
        if (!field || row[field]) return
        if (['data_transmissao', 'vigencia_inicio'].includes(field)) row[field] = dateToIso(values[column])
        else if (['premio_liquido', 'pct_comissao', 'valor_comissao', 'valor_repasse'].includes(field)) row[field] = normalizeSpreadsheetNumber(values[column])
        else row[field] = String(values[column] ?? '').trim()
      })
      if (!row.nome_cliente && !row.numero_apolice) return
      if (!row.vigencia_fim && row.vigencia_inicio) row.vigencia_fim = plusOneYear(row.vigencia_inicio)
      const type = normalize(row.tipo)
      row.tipo = type.includes('renov') ? 'renovacao' : type.includes('endos') ? 'endosso' : 'novo'
      parsed.push(blankRow(parsed.length, row))
    })
  })
  return parsed
}

function downloadTemplate() {
  const headers = ['TRANSMISSÃO', 'VIGÊNCIA', 'SEGURADO', 'QNT. DE PARCELAS', 'SEGURADORA', 'PRÊMIO LÍQUIDO', '% COMISSÃO', 'VALOR DA COMISSÃO', 'REPASSE COMISSÃO', 'CORRETOR', 'O QUE É', 'EMISSOR', 'STATUS', 'Nº APÓLICE', 'FORMA DE PAGAMENTO', 'VEÍCULO', 'PLACA', 'WHATSAPP']
  const blob = new Blob([`\uFEFF${headers.join(';')}\n`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'modelo-importacao-apolices-auto.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

function hasPolicyRowData(row) {
  return ['data_transmissao', 'vigencia_inicio', 'nome_cliente', 'celular_cliente', 'numero_apolice', 'seguradora', 'parcelamento', 'forma_pagamento', 'premio_liquido', 'pct_comissao', 'valor_comissao', 'valor_repasse', 'responsavel', 'emissor', 'status', 'modelo_veiculo', 'placa']
    .some(field => String(row[field] || '').trim())
}

function vehicleLabel(vehicle = {}) {
  return [vehicle.modelo_veiculo, vehicle.placa].filter(Boolean).join(' · ') || 'Veículo não identificado'
}

function PolicyRelationshipCell({ row, clients, loading, onPatch }) {
  if (!String(row.nome_cliente || '').trim()) return <span className="policy-link-empty">Preencha o segurado</span>

  const candidates = policyClientCandidates(row.nome_cliente, clients)
  const selectedClient = clients.find(client => client.id === row.cliente_id) || null
  const knownVehicles = selectedClient ? policyVehicleCandidates(selectedClient) : []
  const suggestedVehicle = selectedClient ? suggestPolicyVehicle(row, selectedClient) : null

  if (!row.cliente_confirmado) {
    if (loading) return <span className="policy-link-empty">Buscando cliente…</span>
    if (candidates.length) {
      return <div className="policy-link-cell is-question"><span><UserCheck /><b>Este cliente já existe?</b></span>{candidates.map(client => <button key={client.id} onClick={() => onPatch({ cliente_id: client.id, vinculo_cliente: 'existente', cliente_confirmado: true, veiculo_confirmado: false, outro_veiculo: false })}><strong>{client.nome_completo}</strong><small>{client.celular || client.cpf || 'Cadastro existente'}</small><i>É o mesmo</i></button>)}<button className="is-new" onClick={() => onPatch({ cliente_id: '', vinculo_cliente: 'novo', cliente_confirmado: true, veiculo_confirmado: false, outro_veiculo: true })}><UserPlus />Não é nenhum deles</button></div>
    }
    return <div className="policy-link-cell is-question"><span><UserPlus /><b>Nenhum cliente igual encontrado</b></span><button className="is-new" onClick={() => onPatch({ cliente_id: '', vinculo_cliente: 'novo', cliente_confirmado: true, veiculo_confirmado: false, outro_veiculo: true })}>Confirmar novo cliente</button></div>
  }

  if (row.veiculo_confirmado) {
    return <div className="policy-link-cell is-confirmed"><span><CheckCircle2 /><b>{row.vinculo_cliente === 'existente' ? selectedClient?.nome_completo || 'Cliente existente' : 'Novo cliente'}</b></span><small><Car />{vehicleLabel(row)}</small><button onClick={() => onPatch({ veiculo_confirmado: false })}>Revisar</button></div>
  }

  if (suggestedVehicle && !row.outro_veiculo) {
    return <div className="policy-link-cell is-question"><span><Car /><b>É o mesmo veículo?</b></span><small>{vehicleLabel(suggestedVehicle)}</small><div><button className="is-yes" onClick={() => onPatch({ modelo_veiculo: suggestedVehicle.modelo_veiculo || row.modelo_veiculo, placa: suggestedVehicle.placa || row.placa, veiculo_confirmado: true, outro_veiculo: false })}><Check />Sim, mesmo carro</button><button onClick={() => onPatch({ veiculo_confirmado: false, outro_veiculo: true })}>Não, outro carro</button></div></div>
  }

  return <div className="policy-link-cell is-question"><span><Car /><b>{knownVehicles.length ? 'Informe o outro veículo' : 'Informe o veículo'}</b></span>{knownVehicles.length > 0 && <small>Já cadastrados: {knownVehicles.slice(0, 2).map(vehicleLabel).join(' · ')}</small>}<button className="is-yes" disabled={!String(row.modelo_veiculo || '').trim()} onClick={() => onPatch({ veiculo_confirmado: true, outro_veiculo: true })}><Check />Confirmar {row.modelo_veiculo || 'veículo'}</button></div>
}

export default function AutoPolicyImportSheet({ onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const uploadRef = useRef(null)
  const [rows, setRows] = useState(() => blankRows())
  const [summary, setSummary] = useState(null)

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['auto-clientes', 'policy-import-links'],
    queryFn: getClientesAutoComVeiculos,
    staleTime: 30_000,
  })

  const populatedRows = useMemo(() => rows.filter(hasPolicyRowData), [rows])
  const validRows = useMemo(() => populatedRows
    .map(normalizePolicyImportIdentity)
    .filter(row => row.nome_cliente.trim() && row.modelo_veiculo.trim() && row.vigencia_inicio && row.cliente_confirmado && row.veiculo_confirmado)
    .map(row => ({ ...row, vigencia_fim: row.vigencia_fim || plusOneYear(row.vigencia_inicio) })), [populatedRows])
  const incompleteRows = useMemo(() => rows.filter(row => {
    return hasPolicyRowData(row) && (!row.nome_cliente.trim() || !row.modelo_veiculo.trim() || !row.vigencia_inicio)
  }), [rows])
  const pendingReviewRows = useMemo(() => populatedRows.filter(row => !row.cliente_confirmado || !row.veiculo_confirmado), [populatedRows])
  const importMutation = useMutation({
    mutationFn: () => importarApolicesAutoPlanilha(validRows),
    onSuccess: async result => {
      setSummary(result)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auto-emissoes'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-apolices'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-clientes'] }),
        queryClient.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] }),
      ])
      toast({ type: result.erros.length ? 'info' : 'success', title: 'Subida de apólices concluída', message: `${result.importadas} nova(s), ${result.atualizadas} atualizada(s) e ${result.ignoradas} ignorada(s).` })
    },
    onError: error => toast({ type: 'error', title: 'Erro ao subir apólices', message: error?.message || 'Revise as linhas.' }),
  })

  const updateRow = (id, fields) => setRows(current => current.map(row => row._id === id ? { ...row, ...fields } : row))
  const commitCell = (row, column, value) => {
    const fields = { [column.field]: value }
    if (column.field === 'vigencia_inicio' && value && !row.vigencia_fim) fields.vigencia_fim = plusOneYear(value)
    const next = normalizePolicyImportIdentity({ ...row, ...fields })
    if (column.field === 'nome_cliente') Object.assign(next, { cliente_id: '', vinculo_cliente: '', cliente_confirmado: false, veiculo_confirmado: false, outro_veiculo: false })
    if (['modelo_veiculo', 'placa'].includes(column.field)) next.veiculo_confirmado = false
    updateRow(row._id, next)
  }
  const bulkCommit = changes => {
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => grouped.set(row._id, { ...(grouped.get(row._id) || {}), [column.field]: value }))
    setRows(current => current.map(row => {
      const fields = grouped.get(row._id)
      if (!fields) return row
      const next = normalizePolicyImportIdentity({ ...row, ...fields })
      if (!next.vigencia_fim && next.vigencia_inicio) next.vigencia_fim = plusOneYear(next.vigencia_inicio)
      if (fields.nome_cliente !== undefined) Object.assign(next, { cliente_id: '', vinculo_cliente: '', cliente_confirmado: false, veiculo_confirmado: false, outro_veiculo: false })
      if (fields.modelo_veiculo !== undefined || fields.placa !== undefined) next.veiculo_confirmado = false
      return next
    }))
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    if (uploadRef.current) uploadRef.current.value = ''
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const imported = parseWorkbook(workbook)
      if (!imported.length) throw new Error('Não encontrei um cabeçalho com Segurado e as colunas da apólice.')
      setRows([...imported, ...blankRows(10)])
      setSummary(null)
      toast({ type: 'info', title: 'Arquivo carregado para revisão', message: `${imported.length} linha(s) reconhecida(s). Nada foi salvo ainda.` })
    } catch (error) {
      toast({ type: 'error', title: 'Não foi possível ler o arquivo', message: error?.message || 'Use XLSX, XLS ou CSV.' })
    }
  }

  const columns = useMemo(() => [
    { field: 'data_transmissao', label: 'TRANSMISSÃO', type: 'date', editable: true, width: 130 },
    { field: 'vigencia_inicio', label: 'VIGÊNCIA', type: 'date', editable: true, width: 125 },
    { field: 'nome_cliente', label: 'SEGURADO', editable: true, sticky: true, width: 225, placeholder: 'Nome completo' },
    { field: 'parcelamento', label: 'QNT. DE PARCELAS', editable: true, width: 125 },
    { field: 'seguradora', label: 'SEGURADORA', editable: true, width: 135 },
    { field: 'premio_liquido', label: 'PRÊMIO LÍQUIDO', type: 'number', step: '0.01', editable: true, width: 125, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao', label: '% COMISSÃO', type: 'number', step: '0.01', editable: true, width: 105, parse: value => value === '' ? null : Number(value) },
    { field: 'valor_comissao', label: 'VALOR DA COMISSÃO', type: 'number', step: '0.01', editable: true, width: 145, placeholder: calcularValorComissaoAuto(0, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), parse: value => value === '' ? null : Number(value) },
    { field: 'valor_repasse', label: 'REPASSE COMISSÃO', type: 'number', step: '0.01', editable: true, width: 135, parse: value => value === '' ? null : Number(value) },
    { field: 'responsavel', label: 'CORRETOR', editable: true, width: 120 },
    { field: 'tipo', label: 'O QUE É', type: 'select', editable: true, width: 120, options: TYPES, parse: value => { const type = normalize(value); return type.includes('renov') ? 'renovacao' : type.includes('endos') ? 'endosso' : 'novo' } },
    { field: 'emissor', label: 'EMISSOR', editable: true, width: 115 },
    { field: 'status', label: 'STATUS', editable: true, width: 125 },
    { field: 'numero_apolice', label: 'Nº APÓLICE', editable: true, width: 135 },
    { field: 'forma_pagamento', label: 'FORMA DE PAGAMENTO', editable: true, width: 145 },
    { key: 'vinculo', label: 'CONFIRMAR CLIENTE E VEÍCULO', width: 300, render: row => <PolicyRelationshipCell row={row} clients={clients} loading={clientsLoading} onPatch={fields => updateRow(row._id, fields)} /> },
    { key: 'remove', label: '', width: 48, render: row => <button className="ops-sheet-icon-button is-danger" title="Remover linha" onClick={() => setRows(current => current.filter(item => item._id !== row._id))}><Trash2 /></button> },
    { field: 'modelo_veiculo', label: 'VEÍCULO', editable: true, width: 175 },
    { field: 'placa', label: 'PLACA', editable: true, width: 95 },
    { field: 'celular_cliente', label: 'WHATSAPP', editable: true, width: 130 },
  ], [clients, clientsLoading])

  return <section className="policy-import-workspace">
    <header className="policy-import-header"><span><FileUp /></span><div><small>Entrada em lote</small><strong>Subir apólices para o AUTO</strong><p>Carregue um arquivo ou cole a partir de Data de transmissão. Revise a grade antes de salvar.</p></div><button onClick={onClose} title="Fechar"><X /></button></header>
    <div className="policy-import-commandbar">
      <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} hidden />
      <button className="is-primary" onClick={() => uploadRef.current?.click()}><Upload />Carregar XLSX/CSV</button>
      <button onClick={downloadTemplate}><Download />Baixar modelo</button>
      <button onClick={() => setRows(current => [...current, ...blankRows(20)])}><Plus />Adicionar 20 linhas</button>
      <span><ClipboardPaste />Clique em Data de transmissão e cole o bloco inteiro</span>
      <button className="is-save" disabled={!validRows.length || incompleteRows.length > 0 || pendingReviewRows.length > 0 || importMutation.isPending} onClick={() => importMutation.mutate()}>{importMutation.isPending ? 'Subindo…' : pendingReviewRows.length ? `Revisar ${pendingReviewRows.length} vínculo(s)` : `Subir ${validRows.length || ''} apólice(s)`}</button>
    </div>
    <div className="policy-import-readiness"><span className="is-ready"><CheckCircle2 />{validRows.length} prontas</span><span className={incompleteRows.length ? 'is-warning' : ''}>{incompleteRows.length} incompletas</span><span className={pendingReviewRows.length ? 'is-warning' : ''}>{pendingReviewRows.length} aguardando confirmação</span><span>`SEGURADO --- VEÍCULO` é separado automaticamente · o vencimento é calculado um ano após a Vigência</span></div>
    <OperationalSpreadsheet rows={rows} columns={columns} getRowId={row => row._id} getRowClassName={row => {
      if (!hasPolicyRowData(row)) return 'is-sheet-row-empty'
      if (!row.nome_cliente?.trim() || !row.modelo_veiculo?.trim() || !row.vigencia_inicio) return 'is-sheet-row-error'
      if (!row.cliente_confirmado || !row.veiculo_confirmado) return 'is-sheet-row-review'
      return 'is-sheet-row-ready'
    }} onCommit={commitCell} onBulkCommit={bulkCommit} className="is-policy-import" statusLabel={`${validRows.length} apólice(s) pronta(s) para subir`} />
    {summary && <div className="policy-import-result"><CheckCircle2 /><div><strong>Importação processada</strong><span>{summary.importadas} novas · {summary.atualizadas} atualizadas · {summary.ignoradas} ignoradas</span>{summary.erros.length > 0 && <small>{summary.erros.slice(0, 4).map(error => `Linha ${error.linha}: ${error.motivo}`).join(' · ')}</small>}</div></div>}
  </section>
}
