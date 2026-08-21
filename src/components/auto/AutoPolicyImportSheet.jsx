import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { CheckCircle2, ClipboardPaste, Download, FileUp, Plus, Trash2, Upload, X } from 'lucide-react'
import { calcularValorComissaoAuto, importarApolicesAutoPlanilha } from '../../lib/auto'
import { useToast } from '../../contexts/ToastContext'
import OperationalSpreadsheet from './OperationalSpreadsheet'

const TYPES = [{ value: 'novo', label: 'Seguro novo' }, { value: 'renovacao', label: 'Renovação' }, { value: 'endosso', label: 'Endosso' }]
const FIELD_ALIASES = {
  data_transmissao: ['data de transmissao', 'transmissao', 'data'],
  data_emissao: ['data de emissao', 'emissao'],
  vigencia_inicio: ['inicio da vigencia', 'vigencia inicio', 'vigencia'],
  vigencia_fim: ['fim da vigencia', 'vigencia fim', 'vencimento', 'data de vencimento'],
  nome_cliente: ['nome do segurado', 'segurado', 'cliente', 'nome'],
  cpf_cliente: ['cpf do segurado', 'cpf cliente', 'cpf'],
  celular_cliente: ['celular do segurado', 'celular', 'telefone', 'whatsapp'],
  numero_apolice: ['numero da apolice', 'n apolice', 'apolice'],
  seguradora: ['seguradora', 'cia', 'companhia'],
  parcelamento: ['parcelamento', 'parcelas'],
  forma_pagamento: ['forma de pagamento', 'pagamento'],
  premio_liquido: ['premio liquido', 'premio'],
  pct_comissao: ['comissao percentual', 'percentual de comissao', 'comissao'],
  valor_repasse: ['valor repasse', 'repasse'],
  responsavel: ['responsavel', 'corretor'],
  emissor: ['emissor', 'operador'],
  tipo: ['tipo', 'o que e', 'producao'],
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
  return {
    _id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    data_transmissao: '', data_emissao: '', vigencia_inicio: '', vigencia_fim: '', nome_cliente: '', cpf_cliente: '', celular_cliente: '', numero_apolice: '', seguradora: '', parcelamento: '', forma_pagamento: '', premio_liquido: '', pct_comissao: '', valor_repasse: '', responsavel: '', emissor: '', tipo: 'novo', modelo_veiculo: '', placa: '',
    ...values,
  }
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
        row[field] = ['data_transmissao', 'data_emissao', 'vigencia_inicio', 'vigencia_fim'].includes(field) ? dateToIso(values[column]) : String(values[column] ?? '').trim()
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
  const headers = ['Data de transmissão', 'Data de emissão', 'Início da vigência', 'Data de vencimento', 'Segurado', 'CPF', 'Celular', 'Nº apólice', 'Seguradora', 'Parcelas', 'Forma de pagamento', 'Prêmio líquido', '% comissão', 'Repasse', 'Corretor', 'Emissor', 'Tipo', 'Veículo', 'Placa']
  const blob = new Blob([`\uFEFF${headers.join(';')}\n`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'modelo-importacao-apolices-auto.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function AutoPolicyImportSheet({ onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const uploadRef = useRef(null)
  const [rows, setRows] = useState(() => blankRows())
  const [summary, setSummary] = useState(null)

  const validRows = useMemo(() => rows.filter(row => row.nome_cliente.trim() && row.vigencia_fim), [rows])
  const incompleteRows = useMemo(() => rows.filter(row => {
    const hasUserData = ['data_transmissao', 'data_emissao', 'vigencia_inicio', 'vigencia_fim', 'nome_cliente', 'cpf_cliente', 'celular_cliente', 'numero_apolice', 'seguradora', 'parcelamento', 'forma_pagamento', 'premio_liquido', 'pct_comissao', 'valor_repasse', 'responsavel', 'emissor', 'modelo_veiculo', 'placa'].some(field => String(row[field] || '').trim())
    return hasUserData && (!row.nome_cliente.trim() || !row.vigencia_fim)
  }), [rows])
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
    updateRow(row._id, fields)
  }
  const bulkCommit = changes => {
    const grouped = new Map()
    changes.forEach(({ row, column, value }) => grouped.set(row._id, { ...(grouped.get(row._id) || {}), [column.field]: value }))
    setRows(current => current.map(row => {
      const fields = grouped.get(row._id)
      if (!fields) return row
      const next = { ...row, ...fields }
      if (!next.vigencia_fim && next.vigencia_inicio) next.vigencia_fim = plusOneYear(next.vigencia_inicio)
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
    { field: 'data_transmissao', label: 'Data de transmissão', type: 'date', editable: true, width: 145 },
    { field: 'data_emissao', label: 'Data de emissão', type: 'date', editable: true, width: 130 },
    { field: 'vigencia_inicio', label: 'Início da vigência', type: 'date', editable: true, width: 140 },
    { field: 'vigencia_fim', label: 'Data de vencimento', type: 'date', editable: true, width: 145 },
    { field: 'nome_cliente', label: 'Segurado', editable: true, sticky: true, width: 225, placeholder: 'Nome completo' },
    { field: 'cpf_cliente', label: 'CPF', editable: true, width: 125 },
    { field: 'celular_cliente', label: 'Celular', editable: true, width: 125 },
    { field: 'numero_apolice', label: 'Nº apólice', editable: true, width: 135 },
    { field: 'seguradora', label: 'Seguradora', editable: true, width: 135 },
    { field: 'parcelamento', label: 'Parcelas', editable: true, width: 90 },
    { field: 'forma_pagamento', label: 'Pagamento', editable: true, width: 130 },
    { field: 'premio_liquido', label: 'Prêmio líquido', type: 'number', step: '0.01', editable: true, width: 115, parse: value => value === '' ? null : Number(value) },
    { field: 'pct_comissao', label: '% comissão', type: 'number', step: '0.01', editable: true, width: 95, parse: value => value === '' ? null : Number(value) },
    { key: 'valor_comissao', label: 'Comissão calculada', width: 130, format: value => value, getValue: row => calcularValorComissaoAuto(row.premio_liquido || 0, row.pct_comissao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
    { field: 'valor_repasse', label: 'Repasse', type: 'number', step: '0.01', editable: true, width: 105, parse: value => value === '' ? null : Number(value) },
    { field: 'responsavel', label: 'Corretor', editable: true, width: 120 },
    { field: 'emissor', label: 'Emissor', editable: true, width: 115 },
    { field: 'tipo', label: 'Tipo', type: 'select', editable: true, width: 120, options: TYPES },
    { field: 'modelo_veiculo', label: 'Veículo', editable: true, width: 175 },
    { field: 'placa', label: 'Placa', editable: true, width: 95 },
    { key: 'remove', label: '', width: 48, render: row => <button className="ops-sheet-icon-button is-danger" title="Remover linha" onClick={() => setRows(current => current.filter(item => item._id !== row._id))}><Trash2 /></button> },
  ], [])

  return <section className="policy-import-workspace">
    <header className="policy-import-header"><span><FileUp /></span><div><small>Entrada em lote</small><strong>Subir apólices para o AUTO</strong><p>Carregue um arquivo ou cole a partir de Data de transmissão. Revise a grade antes de salvar.</p></div><button onClick={onClose} title="Fechar"><X /></button></header>
    <div className="policy-import-commandbar">
      <input ref={uploadRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} hidden />
      <button className="is-primary" onClick={() => uploadRef.current?.click()}><Upload />Carregar XLSX/CSV</button>
      <button onClick={downloadTemplate}><Download />Baixar modelo</button>
      <button onClick={() => setRows(current => [...current, ...blankRows(20)])}><Plus />Adicionar 20 linhas</button>
      <span><ClipboardPaste />Clique em Data de transmissão e cole o bloco inteiro</span>
      <button className="is-save" disabled={!validRows.length || importMutation.isPending} onClick={() => importMutation.mutate()}>{importMutation.isPending ? 'Subindo…' : `Subir ${validRows.length || ''} apólice(s)`}</button>
    </div>
    <div className="policy-import-readiness"><span className="is-ready"><CheckCircle2 />{validRows.length} prontas</span><span className={incompleteRows.length ? 'is-warning' : ''}>{incompleteRows.length} incompletas</span><span>CPF cria/vincula o cliente automaticamente · sem CPF, a apólice continua válida e fica sem vínculo</span></div>
    <OperationalSpreadsheet rows={rows} columns={columns} getRowId={row => row._id} onCommit={commitCell} onBulkCommit={bulkCommit} className="is-policy-import" statusLabel={`${validRows.length} apólice(s) pronta(s) para subir`} />
    {summary && <div className="policy-import-result"><CheckCircle2 /><div><strong>Importação processada</strong><span>{summary.importadas} novas · {summary.atualizadas} atualizadas · {summary.ignoradas} ignoradas</span>{summary.erros.length > 0 && <small>{summary.erros.slice(0, 4).map(error => `Linha ${error.linha}: ${error.motivo}`).join(' · ')}</small>}</div></div>}
  </section>
}
