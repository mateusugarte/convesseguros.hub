import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { ArrowLeft, ArrowRight, Car, CheckCircle2, FileText, Loader2, PencilLine, RefreshCw, Search, ShieldCheck, Trash2, Upload, X, Plus, History } from 'lucide-react'
import { endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import {
  atualizarEmissaoAutoCompleta, atualizarTagsEmissao, calcularValorComissaoAuto, criarEmissaoManualAuto, deletarCotacaoAuto, deletarEmissaoAuto,
  emitirApoliceAuto, getApolicesAuto, getAutoTags, getEmissaoAuto, getEmissaoColuna, getEmissoesAuto, importarApolicesAutoPlanilha, importarApolicesAutoHistorico, moverEmissaoColuna,
  salvarResultadoCotacao,
} from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, FilterBar, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateBR, formatMoney } from './autoShared'
import { uploadDocumento } from '../../lib/documentos'
import { toNumber } from '../../lib/apolices'
import { limparNomeSegurado, parseAutoHistoricoPlanilha } from '../../lib/autoHistoricoImport.js'

const COLUNAS = [
  { id: 'pendentes', label: 'Cotacoes pendentes', hint: 'entradas novas do n8n e itens sem andamento', tone: 'warning' },
  { id: 'cotacao_feita', label: 'Cotacao feita', hint: 'resultado registrado da cotacao', tone: 'secondary' },
  { id: 'negociando', label: 'Negociando', hint: 'em tratativa com cliente', tone: 'accent' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria', hint: 'dependem de validacao', tone: 'warning' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', hint: 'proposta enviada para a seguradora', tone: 'success' },
  { id: 'apolice_emitida', label: 'Apólice Emitida', hint: 'apólice finalizada com documento', tone: 'accent' },
]

const PERIOD_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'custom', label: 'Personalizado' },
]

const FORM_EMISSAO_VAZIO = {
  nome_cliente: '',
  cpf_cliente: '',
  celular_cliente: '',
  condutor_nome: '',
  condutor_cpf: '',
  condutor_igual_segurado: false,
  modelo_veiculo: '',
  placa: '',
  seguradora: '',
  numero_apolice: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  coluna: 'proposta_transmitida',
  premio_liquido: '',
  pct_comissao: '',
  forma_pagamento: '',
  parcelamento: '',
  tipo_producao: 'individual',
  responsavel: '',
  eh_renovacao: false,
  tem_repasse: false,
  pct_repasse: '',
  nome_repasse: '',
  renovacao_premio_liquido_ano_anterior: '',
  renovacao_comissao_ano_anterior: '',
  renovacao_premio_liquido_ano_atual: '',
  renovacao_comissao_ano_atual: '',
}

const FORM_MANUAL_VAZIO = {
  nome_cliente: '',
  cpf_cliente: '',
  celular_cliente: '',
  condutor_nome: '',
  condutor_cpf: '',
  condutor_igual_segurado: false,
  modelo_veiculo: '',
  placa: '',
  seguradora: '',
  numero_apolice: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  coluna: 'proposta_transmitida',
  premio_liquido: '',
  pct_comissao: '',
  tem_repasse: false,
  pct_repasse: '',
  nome_repasse: '',
  forma_pagamento: '',
  parcelamento: '',
  responsavel: '',
  eh_renovacao: false,
  renovacao_premio_liquido_ano_anterior: '',
  renovacao_comissao_ano_anterior: '',
  renovacao_premio_liquido_ano_atual: '',
  renovacao_comissao_ano_atual: '',
}

const NOVA_SEGURADORA = {
  nome: '',
  valor_total: '',
  premio_liquido: '',
  pct_comissao: '',
  parcelamentos: '',
  forma_pagamento: '',
}

const FORM_EDICAO_VAZIO = {
  id: '',
  cotacao_id: '',
  apolice_id: '',
  tipo: 'novo',
  resultado: '',
  nome_cliente: '',
  cpf_cliente: '',
  celular_cliente: '',
  email_cliente: '',
  estado_civil_cliente: '',
  profissao_cliente: '',
  origem_lead: '',
  condutor_nome: '',
  condutor_cpf: '',
  condutor_igual_segurado: false,
  estado_civil_condutor: '',
  modelo_veiculo: '',
  placa: '',
  uso_veiculo: '',
  cep_pernoite: '',
  jovens_18_26: false,
  veiculo_financiado: false,
  possui_kit_gas: false,
  possui_blindagem: false,
  isento_imposto: false,
  garagem_residencia: false,
  garagem_trabalho: false,
  garagem_estudo: false,
  seguradora: '',
  numero_apolice: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  coluna: 'proposta_transmitida',
  premio_liquido: '',
  pct_comissao: '',
  forma_pagamento: '',
  parcelamento: '',
  tipo_producao: 'individual',
  responsavel: '',
  eh_renovacao: false,
  tem_repasse: false,
  pct_repasse: '',
  nome_repasse: '',
  renovacao_premio_liquido_ano_anterior: '',
  renovacao_comissao_ano_anterior: '',
  renovacao_premio_liquido_ano_atual: '',
  renovacao_comissao_ano_atual: '',
  seguradoras_cotadas: [{ ...NOVA_SEGURADORA }],
}

function toDateInput(value) {
  return format(value, 'yyyy-MM-dd')
}

function getPeriodoRange(tipo) {
  const now = new Date()
  if (tipo === 'todos') {
    return { inicio: '', fim: '' }
  }
  if (tipo === 'dia') {
    const today = toDateInput(now)
    return { inicio: today, fim: today }
  }
  if (tipo === 'semana') {
    return { inicio: toDateInput(startOfWeek(now, { weekStartsOn: 1 })), fim: toDateInput(now) }
  }
  if (tipo === 'mes') {
    return { inicio: toDateInput(startOfMonth(now)), fim: toDateInput(now) }
  }
  return { inicio: '', fim: '' }
}

function nomeEmissao(emissao) {
  const c = emissao.cotacoes_auto || {}
  return emissao.nome_cliente || c.nome_cliente || c.nome_interessado || c.condutor_nome || emissao.condutor_nome || '-'
}

function cpfEmissao(emissao) {
  const c = emissao.cotacoes_auto || {}
  return emissao.cpf_cliente || c.cpf_cliente || '-'
}

function celularEmissao(emissao) {
  const c = emissao.cotacoes_auto || {}
  return emissao.celular_cliente || c.celular_cliente || '-'
}

function condutorEmissao(emissao) {
  const c = emissao.cotacoes_auto || {}
  return emissao.condutor_nome || c.condutor_nome || '-'
}

function seguradoraEmissao(emissao) {
  return emissao.seguradora || emissao.cotacoes_auto?.seguradora_preferencial?.nome || emissao.cotacoes_auto?.seguradora_mais_barata?.nome || '-'
}

function aprovadaNome(seg) {
  return seg?.nome?.trim() || ''
}

function getSeguradorasAprovadas(emissao) {
  const lista = Array.isArray(emissao?.seguradoras_cotadas) ? emissao.seguradoras_cotadas : []
  return lista
    .map(seg => ({
      ...seg,
      nome: aprovadaNome(seg),
    }))
    .filter(seg => seg.nome)
}

function isSeguradoCondutorData(nomeCliente, cpfCliente, condutorNome, condutorCpf) {
  const norm = value => String(value || '').trim().toLowerCase()
  const cpf = value => String(value || '').replace(/\D/g, '')
  return norm(nomeCliente) && norm(nomeCliente) === norm(condutorNome)
    && cpf(cpfCliente) && cpf(cpfCliente) === cpf(condutorCpf)
}

function toNumberOrEmpty(value) {
  const parsed = toNumber(value)
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : (String(value || '').trim() === '' ? '' : parsed)
}

function normalizePlanilhaHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cleanPlanilhaText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function excelDateToISO(value) {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return format(value, 'yyyy-MM-dd')
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const raw = cleanPlanilhaText(value)
  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3]
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  }
  const iso = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  return ''
}

function percentFromPlanilha(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value : value / 100
  const raw = cleanPlanilhaText(value).replace('%', '').replace(',', '.')
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed : parsed / 100
}

function findHeaderColumn(headerRow, start, end, labels) {
  for (let col = start; col < end; col += 1) {
    const header = normalizePlanilhaHeader(headerRow[col])
    if (labels.some(label => header === label || header.includes(label))) return col
  }
  return -1
}

function rowsFromAutoSheet(sheetName, rows) {
  const result = []
  rows.forEach((headerRow, headerIndex) => {
    const dataColumns = headerRow
      .map((cell, index) => (normalizePlanilhaHeader(cell) === 'data' ? index : -1))
      .filter(index => index >= 0)

    dataColumns.forEach((dataCol, blockIndex) => {
      const end = dataColumns[blockIndex + 1] ?? headerRow.length
      const ciaCol = findHeaderColumn(headerRow, dataCol, end, ['cia', 'seguradora'])
      const seguradoCol = findHeaderColumn(headerRow, dataCol, end, ['segurado', 'cliente'])
      const statusCol = findHeaderColumn(headerRow, dataCol, end, ['status'])
      const limiteCol = findHeaderColumn(headerRow, dataCol, end, ['limite', 'prazo'])
      const comissaoCol = findHeaderColumn(headerRow, dataCol, end, ['comissao'])
      const comissaoPassadaCol = findHeaderColumn(headerRow, dataCol, end, ['com passada', 'comissao passada'])
      const cpfCol = findHeaderColumn(headerRow, dataCol, end, ['cpf'])
      const celularCol = findHeaderColumn(headerRow, dataCol, end, ['celular', 'telefone'])
      const placaCol = findHeaderColumn(headerRow, dataCol, end, ['placa'])
      const modeloCol = findHeaderColumn(headerRow, dataCol, end, ['modelo', 'veiculo'])
      const apoliceCol = findHeaderColumn(headerRow, dataCol, end, ['apolice'])

      if (seguradoCol < 0) return

      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (normalizePlanilhaHeader(row[dataCol]) === 'data') break

        const nome = limparNomeSegurado(row[seguradoCol])
        const vigenciaFim = excelDateToISO(row[dataCol])
        if (!nome && !vigenciaFim) continue
        if (!nome || !vigenciaFim) continue

        result.push({
          aba: sheetName,
          linha: rowIndex + 1,
          nome_cliente: nome,
          seguradora: cleanPlanilhaText(ciaCol >= 0 ? row[ciaCol] : ''),
          status: cleanPlanilhaText(statusCol >= 0 ? row[statusCol] : ''),
          vigencia_fim: vigenciaFim,
          limite: excelDateToISO(limiteCol >= 0 ? row[limiteCol] : ''),
          pct_comissao: percentFromPlanilha(comissaoCol >= 0 ? row[comissaoCol] : null),
          comissao_passada: percentFromPlanilha(comissaoPassadaCol >= 0 ? row[comissaoPassadaCol] : null),
          cpf_cliente: cleanPlanilhaText(cpfCol >= 0 ? row[cpfCol] : ''),
          celular_cliente: cleanPlanilhaText(celularCol >= 0 ? row[celularCol] : ''),
          placa: cleanPlanilhaText(placaCol >= 0 ? row[placaCol] : ''),
          modelo_veiculo: cleanPlanilhaText(modeloCol >= 0 ? row[modeloCol] : ''),
          numero_apolice: cleanPlanilhaText(apoliceCol >= 0 ? row[apoliceCol] : ''),
          tipo_producao: 'individual',
        })
      }
    })
  })
  return result
}

async function parseAutoPlanilhaFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  return workbook.SheetNames.flatMap(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    return rowsFromAutoSheet(sheetName, rows)
  })
}
async function parseAutoHistoricoPlanilhaFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellStyles: true })
  return parseAutoHistoricoPlanilha(workbook)
}
function buildRenovacaoComparativo(form, premioLiquidoAtual, valorComissaoAtual) {
  const premioAnterior = toNumber(form.renovacao_premio_liquido_ano_anterior) || 0
  const comissaoAnterior = toNumber(form.renovacao_comissao_ano_anterior) || 0
  const premioAtual = toNumber(form.renovacao_premio_liquido_ano_atual) || premioLiquidoAtual || 0
  const comissaoAtual = toNumber(form.renovacao_comissao_ano_atual) || valorComissaoAtual || 0

  return {
    renovacao_premio_liquido_ano_anterior: premioAnterior || null,
    renovacao_comissao_ano_anterior: comissaoAnterior || null,
    renovacao_premio_liquido_ano_atual: premioAtual || null,
    renovacao_comissao_ano_atual: comissaoAtual || null,
    renovacao_diferenca_premio_liquido: (premioAtual || 0) - (premioAnterior || 0),
    renovacao_diferenca_comissao: (comissaoAtual || 0) - (comissaoAnterior || 0),
  }
}

function getFormEmissaoInicial(emissao) {
  const c = emissao?.cotacoes_auto || {}
  const aprovadas = getSeguradorasAprovadas(emissao)
  const preferida = c.seguradora_preferencial?.nome || c.seguradora_mais_barata?.nome || ''
  const primeiraAprovada = aprovadas[0]?.nome || preferida
  const seguradoraBase = aprovadas.find(seg => seg.nome === preferida) || aprovadas[0] || null

  return {
    ...FORM_EMISSAO_VAZIO,
    nome_cliente: emissao?.nome_cliente || c.nome_cliente || c.nome_interessado || '',
    cpf_cliente: emissao?.cpf_cliente || c.cpf_cliente || '',
    celular_cliente: emissao?.celular_cliente || c.celular_cliente || '',
    condutor_nome: emissao?.condutor_nome || c.condutor_nome || emissao?.nome_cliente || c.nome_cliente || '',
    condutor_cpf: emissao?.condutor_cpf || c.condutor_cpf || emissao?.cpf_cliente || c.cpf_cliente || '',
    condutor_igual_segurado: isSeguradoCondutorData(
      emissao?.nome_cliente || c.nome_cliente || '',
      emissao?.cpf_cliente || c.cpf_cliente || '',
      emissao?.condutor_nome || c.condutor_nome || emissao?.nome_cliente || c.nome_cliente || '',
      emissao?.condutor_cpf || c.condutor_cpf || emissao?.cpf_cliente || c.cpf_cliente || ''
    ),
    modelo_veiculo: emissao?.modelo_veiculo || c.modelo_veiculo || '',
    placa: emissao?.placa || c.placa || '',
    seguradora: primeiraAprovada,
    numero_apolice: emissao?.numero_apolice || c.numero_orcamento || '',
    vigencia_inicio: emissao?.vigencia_inicio || c.vigencia_inicio || '',
    vigencia_fim: emissao?.vigencia_fim || c.vigencia_fim || '',
    premio_liquido: emissao?.premio_liquido
      ?? seguradoraBase?.premio_liquido
      ?? c.seguradora_preferencial?.premio_liquido
      ?? c.seguradora_mais_barata?.premio_liquido
      ?? '',
    pct_comissao: emissao?.pct_comissao
      ?? seguradoraBase?.pct_comissao
      ?? c.seguradora_preferencial?.pct_comissao
      ?? c.seguradora_mais_barata?.pct_comissao
      ?? '',
    forma_pagamento: emissao?.forma_pagamento
      || seguradoraBase?.forma_pagamento
      || c.seguradora_preferencial?.forma_pagamento
      || c.seguradora_mais_barata?.forma_pagamento
      || '',
    parcelamento: emissao?.parcelamento
      || seguradoraBase?.parcelamentos
      || c.seguradora_preferencial?.parcelamentos
      || c.seguradora_mais_barata?.parcelamentos
      || '',
    tipo_producao: emissao?.tipo_producao || 'individual',
    responsavel: emissao?.responsavel || '',
    eh_renovacao: Boolean(emissao?.eh_renovacao || c.tipo === 'renovacao'),
    tem_repasse: Boolean(emissao?.tem_repasse || seguradoraBase?.nome_repasse),
    pct_repasse: emissao?.pct_repasse || seguradoraBase?.pct_repasse || '',
    nome_repasse: emissao?.nome_repasse || seguradoraBase?.nome_repasse || '',
  }
}

function getApoliceVinculada(emissao) {
  return Array.isArray(emissao?.apolices_auto) ? (emissao.apolices_auto[0] || null) : (emissao?.apolices_auto || null)
}

function getColunaMeta(colunaId) {
  return COLUNAS.find(item => item.id === colunaId) || COLUNAS[0]
}

function normalizeSeguradorasCotadas(seguradoras) {
  const lista = Array.isArray(seguradoras) ? seguradoras : []
  const normalizadas = lista
    .map(seg => ({
      ...NOVA_SEGURADORA,
      ...seg,
      nome: seg?.nome || '',
      valor_total: seg?.valor_total ?? '',
      premio_liquido: seg?.premio_liquido ?? '',
      pct_comissao: seg?.pct_comissao ?? '',
      parcelamentos: seg?.parcelamentos || '',
      forma_pagamento: seg?.forma_pagamento || '',
    }))
    .filter(seg => String(seg.nome || '').trim() !== '')
  return normalizadas.length > 0 ? normalizadas : [{ ...NOVA_SEGURADORA }]
}

function getEditFormInicial(emissao) {
  const c = emissao?.cotacoes_auto || {}
  const apolice = getApoliceVinculada(emissao)
  const aprovadas = getSeguradorasAprovadas(emissao)
  const seguradoraBase = aprovadas[0] || c.seguradora_preferencial || c.seguradora_mais_barata || null
  const nomeCliente = emissao?.nome_cliente || apolice?.nome_cliente || c.nome_cliente || c.nome_interessado || ''
  const cpfCliente = emissao?.cpf_cliente || apolice?.cpf_cliente || c.cpf_cliente || ''
  const condutorNome = emissao?.condutor_nome || apolice?.condutor_nome || c.condutor_nome || nomeCliente
  const condutorCpf = emissao?.condutor_cpf || apolice?.condutor_cpf || c.condutor_cpf || cpfCliente
  const premioLiquido = emissao?.premio_liquido ?? apolice?.premio_liquido ?? seguradoraBase?.premio_liquido ?? ''
  const pctComissao = emissao?.pct_comissao ?? apolice?.pct_comissao ?? seguradoraBase?.pct_comissao ?? ''

  return {
    ...FORM_EDICAO_VAZIO,
    id: emissao?.id || '',
    cotacao_id: emissao?.cotacao_id || c.id || '',
    apolice_id: apolice?.id || '',
    tipo: (c.tipo || emissao?.tipo) === 'renovacao' ? 'renovacao' : 'novo',
    coluna: getEmissaoColuna(emissao),
    resultado: emissao?.resultado || '',
    nome_cliente: nomeCliente,
    cpf_cliente: cpfCliente,
    celular_cliente: emissao?.celular_cliente || apolice?.celular_cliente || c.celular_cliente || '',
    email_cliente: c.email_cliente || '',
    estado_civil_cliente: c.estado_civil_cliente || '',
    profissao_cliente: c.profissao_cliente || '',
    origem_lead: c.origem_lead || '',
    condutor_nome: condutorNome,
    condutor_cpf: condutorCpf,
    condutor_igual_segurado: isSeguradoCondutorData(nomeCliente, cpfCliente, condutorNome, condutorCpf),
    estado_civil_condutor: c.estado_civil_condutor || '',
    modelo_veiculo: emissao?.modelo_veiculo || apolice?.modelo_veiculo || c.modelo_veiculo || '',
    placa: emissao?.placa || apolice?.placa || c.placa || '',
    uso_veiculo: c.uso_veiculo || '',
    cep_pernoite: c.cep_pernoite || '',
    jovens_18_26: Boolean(c.jovens_18_26),
    veiculo_financiado: Boolean(c.veiculo_financiado),
    possui_kit_gas: Boolean(c.possui_kit_gas),
    possui_blindagem: Boolean(c.possui_blindagem),
    isento_imposto: Boolean(c.isento_imposto),
    garagem_residencia: Boolean(c.garagem_residencia),
    garagem_trabalho: Boolean(c.garagem_trabalho),
    garagem_estudo: Boolean(c.garagem_estudo),
    seguradora: emissao?.seguradora || apolice?.seguradora || seguradoraBase?.nome || '',
    numero_apolice: emissao?.numero_apolice || apolice?.numero_apolice || c.numero_orcamento || '',
    vigencia_inicio: emissao?.vigencia_inicio || apolice?.vigencia_inicio || c.vigencia_inicio || '',
    vigencia_fim: emissao?.vigencia_fim || apolice?.vigencia_fim || c.vigencia_fim || '',
    premio_liquido: toNumberOrEmpty(premioLiquido),
    pct_comissao: toNumberOrEmpty(pctComissao),
    forma_pagamento: emissao?.forma_pagamento || apolice?.forma_pagamento || seguradoraBase?.forma_pagamento || '',
    parcelamento: emissao?.parcelamento || apolice?.parcelamento || seguradoraBase?.parcelamentos || '',
    tipo_producao: apolice?.tipo_producao || 'individual',
    responsavel: apolice?.responsavel || '',
    eh_renovacao: Boolean(apolice?.eh_renovacao || emissao?.eh_renovacao || c.tipo === 'renovacao' || emissao?.tipo === 'renovacao'),
    tem_repasse: Boolean(apolice?.tem_repasse || emissao?.tem_repasse || seguradoraBase?.nome_repasse || emissao?.nome_repasse),
    pct_repasse: toNumberOrEmpty(apolice?.pct_repasse ?? emissao?.pct_repasse ?? seguradoraBase?.pct_repasse ?? ''),
    nome_repasse: apolice?.nome_repasse || emissao?.nome_repasse || seguradoraBase?.nome_repasse || '',
    renovacao_premio_liquido_ano_anterior: toNumberOrEmpty(apolice?.renovacao_premio_liquido_ano_anterior ?? emissao?.renovacao_premio_liquido_ano_anterior ?? ''),
    renovacao_comissao_ano_anterior: toNumberOrEmpty(apolice?.renovacao_comissao_ano_anterior ?? emissao?.renovacao_comissao_ano_anterior ?? ''),
    renovacao_premio_liquido_ano_atual: toNumberOrEmpty(apolice?.renovacao_premio_liquido_ano_atual ?? emissao?.renovacao_premio_liquido_ano_atual ?? premioLiquido),
    renovacao_comissao_ano_atual: toNumberOrEmpty(apolice?.renovacao_comissao_ano_atual ?? emissao?.renovacao_comissao_ano_atual ?? ((toNumber(premioLiquido) || 0) * (toNumber(pctComissao) || 0))),
    seguradoras_cotadas: normalizeSeguradorasCotadas(aprovadas),
  }
}

function CardEmissao({ emissao, onDragStart, onClick, tagsPorId }) {
  const cardTags = (emissao.tags ?? []).map(id => tagsPorId?.get(id)).filter(Boolean)
  const coluna = getEmissaoColuna(emissao)
  const colunaMeta = getColunaMeta(coluna)
  const tipo = emissao.cotacoes_auto?.tipo || emissao.tipo
  const isRenovacao = tipo === 'renovacao'
  const isRecusada = emissao.resultado === 'recusada'
  const isAprovada = emissao.resultado === 'aprovada'
  const nome = nomeEmissao(emissao)
  const apolice = getApoliceVinculada(emissao)
  const veiculo = emissao.modelo_veiculo || apolice?.modelo_veiculo || emissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado'
  const placa = emissao.placa || apolice?.placa || emissao.cotacoes_auto?.placa || 'Sem placa'
  const seguradora = apolice?.seguradora || seguradoraEmissao(emissao)
  const vigenciaFim = apolice?.vigencia_fim || emissao.vigencia_fim || emissao.cotacoes_auto?.vigencia_fim || ''
  const premio = apolice?.premio_liquido ?? emissao.premio_liquido ?? 0
  const comissao = apolice?.valor_comissao ?? emissao.valor_comissao ?? 0
  const prazo = vigenciaFim ? Math.ceil((new Date(`${vigenciaFim}T12:00:00`) - new Date()) / (1000 * 60 * 60 * 24)) : null

  let shellClass = 'border-brand-secondary/20 bg-white/90 shadow-[0_18px_40px_rgba(15,23,42,0.06)]'
  let accentClass = 'from-brand-secondary to-brand-accent'
  if (isRecusada) {
    shellClass = 'border-red-200 bg-red-50/90 shadow-[0_18px_40px_rgba(239,68,68,0.08)]'
    accentClass = 'from-red-400 to-red-500'
  } else if (isRenovacao) {
    shellClass = 'border-status-success/20 bg-status-success/5 shadow-[0_18px_40px_rgba(34,197,94,0.08)]'
    accentClass = 'from-status-success to-brand-secondary'
  } else if (coluna === 'pendentes') {
    shellClass = 'border-status-warning/20 bg-status-warning/5 shadow-[0_18px_40px_rgba(245,158,11,0.08)]'
    accentClass = 'from-brand-accent to-brand-secondary'
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(emissao)}
      onClick={() => onClick(emissao)}
      title="Abrir detalhes da emissao"
      className={['group relative flex min-h-[290px] w-full flex-col overflow-hidden rounded-[30px] border p-4 text-left transition-all hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,23,42,0.12)]', shellClass].join(' ')}
    >
      <div className={['absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', accentClass].join(' ')} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-dark-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{colunaMeta.label}</span>
            <span className={isRenovacao ? 'rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success' : 'rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-status-info'}>{isRenovacao ? 'Renovacao' : 'Novo'}</span>
            {typeof prazo === 'number' && <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${prazo < 0 ? 'bg-red-100 text-red-600' : prazo <= 15 ? 'bg-status-warning/10 text-status-warning' : 'bg-dark-surface text-dark-muted'}`}>{prazo < 0 ? `${Math.abs(prazo)} dia(s) vencida` : `${prazo} dia(s) para vencer`}</span>}
          </div>
          <div>
            <p className="truncate text-base font-semibold text-dark-text">{nome}</p>
            <p className="mt-1 truncate text-sm text-dark-muted">{veiculo}</p>
          </div>
          {cardTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cardTags.map(tag => (
                <span
                  key={tag.id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${tag.cor}18`, color: tag.cor }}
                >
                  {tag.nome}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {isRecusada && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-600">Recusada</span>}
          {isAprovada && <span className="rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success">Aprovada</span>}
          {!emissao.resultado && <span className="rounded-full bg-dark-surface px-2.5 py-1 text-[10px] font-semibold text-dark-muted">Em andamento</span>}
        </div>
      </div>

      <div className="mt-4 rounded-[26px] border border-white/70 bg-dark-surface/70 p-3">
        <div className="flex items-center gap-3">
          <SeguradoraBadge nome={seguradora} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-dark-text">{seguradora}</p>
            <p className="truncate text-xs text-dark-muted">Placa {placa} · CPF {cpfEmissao(emissao)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-[26px] border border-white/70 bg-white/70 p-3 text-xs text-dark-muted sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Vigência</p>
          <p className="mt-1 text-sm font-medium text-dark-text">{emissao.vigencia_inicio ? formatDateBR(emissao.vigencia_inicio) : '—'} até {vigenciaFim ? formatDateBR(vigenciaFim) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Condutor</p>
          <p className="mt-1 text-sm font-medium text-dark-text">{condutorEmissao(emissao)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Prêmio líquido</p>
          <p className="mt-1 text-sm font-medium text-dark-text">{formatMoney(premio)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Comissão</p>
          <p className="mt-1 text-sm font-medium text-dark-text">{formatMoney(comissao)}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-dark-muted">
        <span>{colunaMeta.hint}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-status-info">Abrir <ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
    </button>
  )
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">{label}</p>
      <p className="mt-1 text-sm text-dark-text">{value}</p>
    </div>
  )
}

function BoolRow({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex items-center justify-between py-1">
      <p className="text-sm text-dark-muted">{label}</p>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        value ? 'bg-status-success/10 text-status-success' : 'bg-dark-border/60 text-dark-muted'
      }`}>
        {value ? 'Sim' : 'Nao'}
      </span>
    </div>
  )
}

// ─── Modal Detalhe ─────────────────────────────────────────────────────

function ModalDetalhe({ emissao, onClose, onAbrirCotacao, onRegistrarResultado, onEmitirApolice, onEditar, onExcluir, isDeleting, page = false, tagsAtivas = [], onSalvarTags }) {
  const c = emissao.cotacoes_auto || {}
  const apolice = getApoliceVinculada(emissao)
  const temCotacao = Boolean(emissao.cotacoes_auto?.id || emissao.cotacao_id)
  const nome = nomeEmissao(emissao)
  const tipo = (c.tipo || emissao.tipo) === 'renovacao' ? 'Renovacao' : 'Novo'
  const seguradoras = Array.isArray(emissao.seguradoras_cotadas) ? emissao.seguradoras_cotadas : []
  const seguradoraAtual = emissao.seguradora || apolice?.seguradora || c.seguradora_preferencial?.nome || c.seguradora_mais_barata?.nome || ''
  const etapaAtual = emissao.resultado ? (emissao.resultado === 'aprovada' ? 'Cotacao aprovada' : 'Cotacao recusada') : 'Aguardando resultado'
  const colunaAtual = getColunaMeta(getEmissaoColuna(emissao)).label

  return (
    <div className={page ? 'w-full animate-fade-in py-2' : 'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8'}>
      {!page && <div className="modal-backdrop" onClick={onClose} />}
      <div className={'relative z-10 w-full overflow-hidden rounded-[34px] border border-white/60 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.16)] ' + (page ? '' : 'max-w-6xl')}>
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-gradient-to-br from-brand-secondary/12 via-white to-brand-accent/10 p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-dark-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{colunaAtual}</span>
                  <span className={tipo === 'Renovacao' ? 'rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success' : 'rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-status-info'}>{tipo}</span>
                  {emissao.resultado && <span className={emissao.resultado === 'aprovada' ? 'rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success' : 'rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-600'}>{emissao.resultado === 'aprovada' ? 'Aprovada' : 'Recusada'}</span>}
                </div>
                <h2 className="mt-4 truncate text-2xl font-semibold text-dark-text">{nome}</h2>
                <p className="mt-2 text-sm text-dark-muted">{emissao.modelo_veiculo || c.modelo_veiculo || 'Veiculo nao informado'}{(emissao.placa || c.placa) ? ` · Placa ${emissao.placa || c.placa}` : ''}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-dark-muted transition-colors hover:bg-dark-border/40">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Nome" value={emissao.nome_cliente || c.nome_cliente} />
                  <InfoRow label="CPF" value={emissao.cpf_cliente || c.cpf_cliente} />
                  <InfoRow label="Celular" value={emissao.celular_cliente || c.celular_cliente} />
                  <InfoRow label="Email" value={c.email_cliente} />
                </div>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Veiculo</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Modelo" value={emissao.modelo_veiculo || c.modelo_veiculo} />
                  <InfoRow label="Placa" value={emissao.placa || c.placa} />
                  <InfoRow label="Uso" value={c.uso_veiculo} />
                  <InfoRow label="CEP pernoite" value={c.cep_pernoite} />
                </div>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Condutor</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Nome" value={emissao.condutor_nome || c.condutor_nome} />
                  <InfoRow label="CPF" value={emissao.condutor_cpf || c.condutor_cpf} />
                  <InfoRow label="Estado civil" value={c.estado_civil_condutor} />
                </div>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Apolice e financeiro</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <InfoRow label="Seguradora" value={emissao.seguradora || apolice?.seguradora || c.seguradora_preferencial?.nome || c.seguradora_mais_barata?.nome} />
                  <InfoRow label="Numero da apolice" value={emissao.numero_apolice || apolice?.numero_apolice} />
                  <InfoRow label="Vigencia inicio" value={emissao.vigencia_inicio || apolice?.vigencia_inicio || c.vigencia_inicio} />
                  <InfoRow label="Vigencia fim" value={emissao.vigencia_fim || apolice?.vigencia_fim || c.vigencia_fim} />
                  <InfoRow label="Premio liquido" value={emissao.premio_liquido || apolice?.premio_liquido ? formatMoney(emissao.premio_liquido || apolice?.premio_liquido) : null} />
                  <InfoRow label="Comissao %" value={emissao.pct_comissao ?? apolice?.pct_comissao ?? null} />
                </div>
              </div>
            </div>

            {onSalvarTags && (
              <div className="mt-4 rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Etiquetas</p>
                {tagsAtivas.length === 0 ? (
                  <p className="mt-2 text-xs text-dark-muted">Nenhuma etiqueta predefinida ativa. Crie em Auto &gt; Etiquetas.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tagsAtivas.map(tag => {
                      const selecionada = (emissao.tags ?? []).includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            const atual = emissao.tags ?? []
                            const proximo = selecionada ? atual.filter(id => id !== tag.id) : [...atual, tag.id]
                            onSalvarTags(emissao.id, proximo)
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${selecionada ? '' : 'border-dark-border/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'}`}
                          style={selecionada ? { borderColor: `${tag.cor}80`, background: `${tag.cor}22`, color: tag.cor } : undefined}
                        >
                          {tag.nome}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {seguradoras.length > 0 && (
              <div className="mt-4 rounded-[28px] border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradoras cotadas</p>
                <div className="mt-3 space-y-3">
                  {seguradoras.map((seg, idx) => (
                    <div key={idx} className="rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-3">
                      <p className="text-sm font-semibold text-dark-text">{seg.nome || `Seguradora ${idx + 1}`}</p>
                      <div className="mt-2 grid gap-2 text-xs text-dark-muted sm:grid-cols-2">
                        {seg.valor_total > 0 && <span>Valor total: {formatMoney(seg.valor_total)}</span>}
                        {seg.premio_liquido > 0 && <span>Premio liquido: {formatMoney(seg.premio_liquido)}</span>}
                        {seg.parcelamentos && <span>Parcelas: {seg.parcelamentos}</span>}
                        {seg.forma_pagamento && <span>Pagamento: {seg.forma_pagamento}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="bg-dark-surface/75 p-6 md:p-7">
            <div className="rounded-[30px] border border-dark-border/70 bg-white/90 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Resumo operacional</p>
              <p className="mt-2 text-lg font-semibold text-dark-text">{etapaAtual}</p>
              <div className="mt-4 space-y-3 text-sm text-dark-muted">
                <div className="rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-3">Coluna atual: <span className="font-semibold text-dark-text">{colunaAtual}</span></div>
                <div className="rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-3">Tipo: <span className="font-semibold text-dark-text">{tipo}</span></div>
                <div className="rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-3">Responsavel: <span className="font-semibold text-dark-text">{apolice?.responsavel || 'Nao informado'}</span></div>
              </div>
            </div>

            <div className="mt-4 rounded-[30px] border border-dark-border/70 bg-white/90 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Acoes</p>
              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => onEditar?.(emissao)} className="flex w-full items-center justify-between rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-4 py-3 text-left text-sm font-semibold text-dark-text transition-colors hover:border-brand-secondary/40 hover:bg-brand-secondary/12">
                  Editar qualquer informacao <PencilLine className="h-4 w-4 text-status-info" />
                </button>
                <button type="button" onClick={() => onExcluir?.(emissao)} disabled={isDeleting} className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50">
                  {isDeleting ? 'Excluindo...' : 'Excluir emissao'} <Trash2 className="h-4 w-4" />
                </button>
                {temCotacao && onAbrirCotacao && <button type="button" onClick={onAbrirCotacao} className="btn-secondary w-full text-xs">Ver cotacao completa</button>}
                <button type="button" onClick={() => onRegistrarResultado?.(emissao)} className="w-full rounded-2xl border border-brand-secondary/20 bg-dark-surface/75 px-4 py-3 text-left transition-colors hover:border-brand-secondary/40 hover:bg-white">
                  <p className="text-sm font-semibold text-dark-text">Registrar resultado da cotacao</p>
                  <p className="mt-1 text-xs text-dark-muted">Aprovacao, recusa e seguradoras cotadas.</p>
                </button>
                <button type="button" onClick={() => onEmitirApolice?.(emissao)} className="w-full rounded-2xl border border-status-success/20 bg-status-success/5 px-4 py-3 text-left transition-colors hover:border-status-success/40 hover:bg-status-success/10">
                  <p className="text-sm font-semibold text-dark-text">Seguir para emissao</p>
                  <p className="mt-1 text-xs text-dark-muted">Abre o formulario de emissao da apolice.</p>
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[30px] border border-status-success/20 bg-status-success/8 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-status-success" />
                <div>
                  <p className="text-sm font-semibold text-dark-text">Edicao completa habilitada</p>
                  <p className="mt-1 text-xs leading-5 text-dark-muted">O editor avancado permite alterar emissao, cotacao vinculada e apolice em um unico fluxo.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function ModalEditarJson({ emissao, value, onChange, onClose, onSave, isSaving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/60 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.16)]">
        <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="bg-gradient-to-br from-brand-secondary/12 via-white to-brand-accent/10 p-6 md:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
              <PencilLine className="h-3.5 w-3.5" />
              Editor avancado
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-dark-text">Editar emissao</h2>
            <p className="mt-2 text-sm leading-6 text-dark-muted">{nomeEmissao(emissao)}</p>
            <div className="mt-6 space-y-3">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">O que voce pode editar</p>
                <ul className="mt-3 space-y-2 text-sm text-dark-muted">
                  <li>Dados da emissao</li>
                  <li>Dados da cotacao vinculada</li>
                  <li>Dados da apolice emitida</li>
                  <li>Seguradoras cotadas e financeiro</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-status-success/20 bg-status-success/8 p-4 text-sm text-dark-muted">
                Edite o JSON mantendo a estrutura. O salvamento atualiza os registros relacionados automaticamente.
              </div>
            </div>
          </aside>
          <div className="bg-dark-surface/75 p-6 md:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">JSON da emissao</p>
                <h3 className="mt-2 text-xl font-semibold text-dark-text">Alterar e salvar</h3>
              </div>
              <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-dark-border/40">
                <X className="h-5 w-5 text-dark-muted" />
              </button>
            </div>
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              spellCheck={false}
              className="min-h-[62vh] w-full rounded-[28px] border border-dark-border bg-white px-4 py-4 font-mono text-sm text-dark-text outline-none"
            />
            <div className="mt-5 flex gap-3 border-t border-dark-border/60 pt-5">
              <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={onSave} disabled={isSaving} className="btn-primary flex-1 disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormSeguradora({ seg, idx, onChange, onRemove, showRemove }) {
  const valorComissao = (toNumber(seg.premio_liquido) || 0) * (toNumber(seg.pct_comissao) || 0) / 100

  return (
    <div className="rounded-3xl border border-brand-secondary/20 bg-brand-secondary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-status-info">Seguradora {idx + 1}</p>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-dark-muted hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Nome da seguradora</label>
          <SeguradoraSelect
            value={seg.nome}
            onChange={value => onChange('nome', value)}
            produto="auto"
            placeholder="Selecionar seguradora"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Valor total</label>
          <input
            type="text"
            inputMode="decimal"
            value={seg.valor_total}
            onChange={e => onChange('valor_total', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Premio liquido</label>
          <input
            type="text"
            inputMode="decimal"
            value={seg.premio_liquido}
            onChange={e => onChange('premio_liquido', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">% Comissao</label>
          <input
            type="text"
            inputMode="decimal"
            value={seg.pct_comissao}
            onChange={e => onChange('pct_comissao', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Comissao (calculada)</label>
          <div className={`w-full rounded-2xl border px-3 py-2 text-sm font-medium ${
            valorComissao > 0
              ? 'border-status-success/30 bg-status-success/10 text-status-success'
              : 'border-dark-border/40 bg-dark-surface2/40 text-dark-muted'
          }`}>
            {valorComissao > 0 ? formatMoney(valorComissao) : '—'}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Parcelamentos</label>
          <input
            value={seg.parcelamentos}
            onChange={e => onChange('parcelamentos', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="3x, 6x, 10x sem juros"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Forma de pagamento</label>
          <input
            value={seg.forma_pagamento}
            onChange={e => onChange('forma_pagamento', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="Cartao, boleto, pix..."
          />
        </div>
      </div>
    </div>
  )
}

// ─── Modal Resultado da Cotacao ────────────────────────────────────────

function ModalResultado({ emissao, onClose, onSave, isSaving }) {
  const [resultado, setResultado] = useState('aprovada')
  const [seguradoras, setSeguradoras] = useState([{ ...NOVA_SEGURADORA }])

  const c = emissao.cotacoes_auto || {}
  const nome = nomeEmissao(emissao)

  const canSave = resultado === 'recusada' || (
    resultado === 'aprovada' &&
    seguradoras.length > 0 &&
    seguradoras.every(s => s.nome.trim() !== '')
  )

  function updateSeg(idx, campo, valor) {
    setSeguradoras(prev => prev.map((s, i) => i === idx ? { ...s, [campo]: valor } : s))
  }

  function addSeg() {
    setSeguradoras(prev => [...prev, { ...NOVA_SEGURADORA }])
  }

  function removeSeg(idx) {
    setSeguradoras(prev => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    const seguradasFinal = resultado === 'aprovada'
      ? seguradoras.map(s => ({
          nome: s.nome,
          valor_total: toNumber(s.valor_total) || 0,
          premio_liquido: toNumber(s.premio_liquido) || 0,
          pct_comissao: toNumber(s.pct_comissao) || 0,
          valor_comissao: (toNumber(s.premio_liquido) || 0) * (toNumber(s.pct_comissao) || 0) / 100,
          parcelamentos: s.parcelamentos,
          forma_pagamento: s.forma_pagamento,
        }))
      : []
    onSave(emissao.id, { resultado, seguradoras_cotadas: seguradasFinal })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative z-10 glass-modal w-full max-w-2xl rounded-[32px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Resultado da cotacao</p>
            <h2 className="mt-2 text-xl font-semibold text-dark-text">{nome}</h2>
            <p className="mt-1 text-sm text-dark-muted">
              {c.modelo_veiculo || 'Veiculo nao informado'}
              {c.placa ? ` · ${c.placa}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-dark-border/40 transition-colors shrink-0">
            <X className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        {/* Toggle aprovada/recusada */}
        <div className="mb-5 flex gap-3">
          <button
            type="button"
            onClick={() => setResultado('aprovada')}
            className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition-all ${
              resultado === 'aprovada'
                ? 'border-status-success bg-status-success/10 text-status-success shadow-sm'
                : 'border-dark-border bg-dark-surface/60 text-dark-muted hover:border-status-success/40'
            }`}
          >
            Aprovada
          </button>
          <button
            type="button"
            onClick={() => setResultado('recusada')}
            className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition-all ${
              resultado === 'recusada'
                ? 'border-red-300 bg-red-50 text-red-600 shadow-sm'
                : 'border-dark-border bg-dark-surface/60 text-dark-muted hover:border-red-200'
            }`}
          >
            Recusada
          </button>
        </div>

        {resultado === 'aprovada' && (
          <div className="space-y-3">
            <p className="text-xs text-dark-muted">
              Adicione ao menos uma seguradora com o resultado da cotacao.
            </p>
            {seguradoras.map((seg, idx) => (
              <FormSeguradora
                key={idx}
                seg={seg}
                idx={idx}
                onChange={(campo, valor) => updateSeg(idx, campo, valor)}
                onRemove={() => removeSeg(idx)}
                showRemove={seguradoras.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addSeg}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-secondary/30 py-2.5 text-sm text-status-info hover:border-brand-secondary/60 hover:bg-brand-secondary/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outra seguradora
            </button>
          </div>
        )}

        {resultado === 'recusada' && (
          <div className="rounded-3xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-500">
            O card ficara vermelho e marcado como recusado. Esta acao pode ser revertida arrastando de volta para outra coluna.
          </div>
        )}

        <div className="mt-5 flex gap-3 border-t border-dark-border/60 pt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Apolices Emitidas ───────────────────────────────────────────

function ModalApolices({ onClose, onOpenApolice }) {
  const [search, setSearch] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const { data: apolices = [], isLoading } = useQuery({
    queryKey: ['auto-apolices', search, inicio, fim],
    queryFn: () => getApolicesAuto({ search, inicio: inicio || undefined, fim: fim || undefined }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="relative z-10 glass-modal w-full max-w-5xl rounded-[28px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="title-section text-dark-text">Apolices emitidas</h2>
            <p className="mt-1 text-sm text-dark-muted">Consulte todas as apolices de auto emitidas com filtro por periodo e busca.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-dark-border/40 transition-colors">
            <X className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, apolice ou seguradora"
              className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 py-2 pl-10 pr-3 text-sm text-dark-text outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={inicio}
              onChange={e => setInicio(e.target.value)}
              className="rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            />
            <span className="text-xs text-dark-muted">ate</span>
            <input
              type="date"
              value={fim}
              onChange={e => setFim(e.target.value)}
              className="rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
            />
            {(inicio || fim) && (
              <button
                onClick={() => { setInicio(''); setFim('') }}
                className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando apolices...</div>
        ) : apolices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="Nenhuma apolice encontrada"
            description="Ajuste os filtros ou emita a primeira apolice pelo kanban de emissoes."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border/60 text-left">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Apolice</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vigencia</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Premio liq.</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Comissao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {apolices.map(item => (
                  <tr key={item.id} onClick={() => onOpenApolice(item.id)} className="cursor-pointer transition-colors hover:bg-brand-accent/5">
                    <td className="py-3 pr-4 font-medium text-dark-text">{item.nome_cliente || item.cpf_cliente || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.numero_apolice || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.seguradora || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">
                      {item.vigencia_inicio ? formatDateBR(item.vigencia_inicio) : '—'} — {item.vigencia_fim ? formatDateBR(item.vigencia_fim) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-dark-muted">{formatMoney(item.premio_liquido)}</td>
                    <td className="py-3 font-medium text-status-success">{formatMoney(item.valor_comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CampoTexto (formulario de emissao) ────────────────────────────────

function CampoTexto({ label, campo, value, onChange, type = 'text', placeholder = '', disabled = false, inputMode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(campo, e.target.value)}
        className={`w-full rounded-2xl border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none ${disabled ? 'border-dark-border/50 opacity-70 cursor-not-allowed' : 'border-dark-border'}`}
      />
    </div>
  )
}

// ─── Pagina principal ───────────────────────────────────────────────────

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { id: emissaoId } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const isGestaoRoute = location.pathname.startsWith('/auto/gestao')
  const periodoInicial = isGestaoRoute ? 'todos' : 'mes'
  const initialRange = useMemo(() => getPeriodoRange(periodoInicial), [periodoInicial])

  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [modalResultado, setModalResultado] = useState(null)
  const [modalEmissao, setModalEmissao] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [editando, setEditando] = useState(null)
  const [edicaoTexto, setEdicaoTexto] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMode, setManualMode] = useState('novo')
  const [manualStage, setManualStage] = useState('proposta_transmitida')
  const [manualForm, setManualForm] = useState(FORM_MANUAL_VAZIO)
  const [manualDocumento, setManualDocumento] = useState(null)
  const manualFileRef = useRef(null)
  const importFileRef = useRef(null)
  const importHistoricoFileRef = useRef(null)
  const [form, setForm] = useState(FORM_EMISSAO_VAZIO)
  const [showApolices, setShowApolices] = useState(false)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [filtroInicio, setFiltroInicio] = useState(initialRange.inicio)
  const [filtroFim, setFiltroFim] = useState(initialRange.fim)
  const [importResumo, setImportResumo] = useState(null)
  const [importHistoricoResumo, setImportHistoricoResumo] = useState(null)
  const [mesAnoEmissoes, setMesAnoEmissoes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [buscaEmissoes, setBuscaEmissoes] = useState('')
  const [filtroSeguradoraEmissoes, setFiltroSeguradoraEmissoes] = useState('todas')
  const [filtroTipoEmissoes, setFiltroTipoEmissoes] = useState('todos')
  const [filtroStatusEmissoes, setFiltroStatusEmissoes] = useState('todos')
  const [filtroResponsavelEmissoes, setFiltroResponsavelEmissoes] = useState('todos')

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes', periodo, filtroInicio, filtroFim],
    queryFn: () => getEmissoesAuto({ inicio: filtroInicio || undefined, fim: filtroFim || undefined }),
  })

  const { data: autoTags = [] } = useQuery({
    queryKey: ['auto-tags'],
    queryFn: getAutoTags,
  })
  const tagsAtivas = useMemo(() => autoTags.filter(tag => tag.ativa), [autoTags])
  const tagsPorId = useMemo(() => new Map(autoTags.map(tag => [tag.id, tag])), [autoTags])

  const { mutate: salvarTagsEmissao } = useMutation({
    mutationFn: ({ id, tags }) => atualizarTagsEmissao(id, tags),
    onMutate: async ({ id, tags }) => {
      await qc.cancelQueries({ queryKey: ['auto-emissoes'] })
      qc.setQueriesData({ queryKey: ['auto-emissoes'] }, old =>
        Array.isArray(old) ? old.map(item => (item.id === id ? { ...item, tags } : item)) : old)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { data: emissaoDaRota, isLoading: isLoadingEmissao } = useQuery({
    queryKey: ['auto-emissao', emissaoId],
    queryFn: () => getEmissaoAuto(emissaoId),
    enabled: Boolean(emissaoId),
  })

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { mutate: salvarResultado, isPending: isSavingResultado } = useMutation({
    mutationFn: ({ id, payload }) => salvarResultadoCotacao(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      setModalResultado(null)
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao salvar o resultado', message: error?.message || 'Tente novamente.' })
    },
  })

  const { mutateAsync: emitirAsync, isPending } = useMutation({
    mutationFn: payload => emitirApoliceAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setModalEmissao(null)
      setForm(FORM_EMISSAO_VAZIO)
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao salvar a emissão', message: error?.message || 'Verifique os dados informados.' })
    },
  })

  const { mutate: criarManual, isPending: isCreatingManual } = useMutation({
    mutationFn: payload => criarEmissaoManualAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setManualOpen(false)
      setManualForm(FORM_MANUAL_VAZIO)
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao salvar a emissão manual', message: error?.message || 'Verifique os dados informados.' })
    },
  })


  const { mutateAsync: importarPlanilhaAsync, isPending: isImportingPlanilha } = useMutation({
    mutationFn: rows => importarApolicesAutoPlanilha(rows),
    onSuccess: resumo => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-apolices'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setImportResumo(resumo)
      toast({
        type: 'success',
        title: 'Planilha importada',
        message: `${resumo.importadas} novas e ${resumo.atualizadas} atualizadas. ${resumo.ignoradas} ignoradas.`,
      })
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao importar planilha', message: error?.message || 'Revise o arquivo enviado.' })
    },
  })
  const { mutateAsync: importarHistoricoAsync, isPending: isImportingHistorico } = useMutation({
    mutationFn: rows => importarApolicesAutoHistorico(rows),
    onSuccess: resumo => {
      qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      qc.invalidateQueries({ queryKey: ['auto-apolices'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setImportHistoricoResumo(resumo)
      toast({
        type: 'success',
        title: 'Historico importado',
        message: `${resumo.importadas} apolices novas, ${resumo.duplicadas} ja existentes e ${resumo.ignoradas} ignoradas.`,
      })
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao importar historico', message: error?.message || 'Revise o arquivo enviado.' })
    },
  })
  const { mutate: salvarEdicao, isPending: isSavingEdicao } = useMutation({
    mutationFn: payload => atualizarEmissaoAutoCompleta(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-apolices'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setDetalhe(null)
      setManualOpen(false)
      setManualMode('novo')
      setManualForm(FORM_MANUAL_VAZIO)
      setManualDocumento(null)
      if (manualFileRef.current) manualFileRef.current.value = ''
      toast({ type: 'success', title: 'Emissao atualizada', message: 'As alteracoes foram salvas com sucesso.' })
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao salvar a emissao', message: error?.message || 'Revise o JSON informado.' })
    },
  })

  const { mutate: excluirRegistro, isPending: isDeleting } = useMutation({
    mutationFn: item => {
      const cotacaoId = item?.cotacao_id || item?.cotacoes_auto?.id
      return cotacaoId ? deletarCotacaoAuto(cotacaoId) : deletarEmissaoAuto(item.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-apolices'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setDetalhe(null)
      setEditando(null)
      setEdicaoTexto('')
      toast({ type: 'success', title: 'Registro excluido', message: 'A emissao foi removida.' })
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao excluir', message: error?.message || 'Tente novamente.' })
    },
  })

  const seguradorasAprovadas = useMemo(() => getSeguradorasAprovadas(modalEmissao), [modalEmissao])

  function setField(campo, valor) {
    setForm(current => {
      const next = { ...current, [campo]: valor }
      const deveSincronizar = next.condutor_igual_segurado && ['nome_cliente', 'cpf_cliente'].includes(campo)
      if (deveSincronizar) {
        next.condutor_nome = next.nome_cliente
        next.condutor_cpf = next.cpf_cliente
      }
      if (campo === 'condutor_igual_segurado') {
        if (valor) {
          next.condutor_nome = next.nome_cliente
          next.condutor_cpf = next.cpf_cliente
        } else if (current.condutor_nome === current.nome_cliente && current.condutor_cpf === current.cpf_cliente) {
          next.condutor_nome = ''
          next.condutor_cpf = ''
        }
      }
      if (campo === 'eh_renovacao' && valor) {
        next.renovacao_premio_liquido_ano_atual = next.renovacao_premio_liquido_ano_atual || next.premio_liquido
        next.renovacao_comissao_ano_atual = next.renovacao_comissao_ano_atual || ((toNumber(next.premio_liquido) || 0) * (toNumber(next.pct_comissao) || 0))
      }
      return next
    })
  }

  function setManualField(campo, valor) {
    setManualForm(current => {
      const next = { ...current, [campo]: valor }
      const deveSincronizar = next.condutor_igual_segurado && ['nome_cliente', 'cpf_cliente'].includes(campo)
      if (deveSincronizar) {
        next.condutor_nome = next.nome_cliente
        next.condutor_cpf = next.cpf_cliente
      }
      if (campo === 'condutor_igual_segurado') {
        if (valor) {
          next.condutor_nome = next.nome_cliente
          next.condutor_cpf = next.cpf_cliente
        } else if (current.condutor_nome === current.nome_cliente && current.condutor_cpf === current.cpf_cliente) {
          next.condutor_nome = ''
          next.condutor_cpf = ''
        }
      }
      if (campo === 'eh_renovacao' && valor) {
        next.renovacao_premio_liquido_ano_atual = next.renovacao_premio_liquido_ano_atual || next.premio_liquido
        next.renovacao_comissao_ano_atual = next.renovacao_comissao_ano_atual || ((toNumber(next.premio_liquido) || 0) * (toNumber(next.pct_comissao) || 0))
      }
      return next
    })
  }


  async function handleImportPlanilha(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const rows = await parseAutoPlanilhaFile(file)
      if (!rows.length) {
        toast({
          type: 'error',
          title: 'Planilha sem linhas reconhecidas',
          message: 'Use colunas DATA, CIA, SEGURADO e STATUS, como na planilha de renova��es auto.',
        })
        return
      }
      await importarPlanilhaAsync(rows)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao ler planilha', message: error?.message || 'Arquivo invalido ou fora do modelo esperado.' })
    }
  }
  async function handleImportHistorico(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const rows = await parseAutoHistoricoPlanilhaFile(file)
      if (!rows.length) {
        toast({
          type: 'error',
          title: 'Nenhuma linha verde encontrada',
          message: 'So linhas com preenchimento verde (renovacao confirmada) sao importadas.',
        })
        return
      }
      await importarHistoricoAsync(rows)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao ler planilha', message: error?.message || 'Arquivo invalido ou fora do modelo esperado.' })
    }
  }
  function handlePeriodoChange(value) {
    setPeriodo(value)
    if (value === 'custom') return
    const range = getPeriodoRange(value)
    setFiltroInicio(range.inicio)
    setFiltroFim(range.fim)
  }

  // Selecao explicita de mes+ano para "Ultimas emissoes" (considera o ano
  // junto ao mes, evitando misturar emissoes de anos diferentes).
  function handleMesAnoEmissoesChange(value) {
    setMesAnoEmissoes(value)
    if (!value) return
    const [ano, mes] = value.split('-').map(Number)
    if (!ano || !mes) return
    const base = new Date(ano, mes - 1, 1)
    setPeriodo('custom')
    setFiltroInicio(toDateInput(startOfMonth(base)))
    setFiltroFim(toDateInput(endOfMonth(base)))
  }

  function handleDrop(colunaDestino) {
    if (!dragging) return
    if (colunaDestino === 'cotacao_feita') {
      setModalResultado(dragging)
    } else if (colunaDestino === 'proposta_transmitida' || colunaDestino === 'apolice_emitida') {
      setManualStage(colunaDestino)
      setModalEmissao(dragging)
    } else {
      mover({ id: dragging.id, coluna: colunaDestino === 'pendentes' ? null : colunaDestino })
    }
    setDragging(null)
    setDragOver(null)
  }

  function abrirDetalhe(item) {
    if (!item) return
    navigate('/auto/emissoes/' + item.id, { state: { emissao: item } })
  }

  function abrirEditor(item) {
    if (!item) return
    setDetalhe(null)
    setEditando(item)
    setManualMode('editar')
    setManualForm(getEditFormInicial(item))
    setManualDocumento(null)
    setManualStage(getEmissaoColuna(item))
    setManualOpen(true)
  }

  function buildSeguradorasPayload(seguradoras) {
    return normalizeSeguradorasCotadas(seguradoras)
      .filter(seg => String(seg.nome || '').trim() !== '')
      .map(seg => ({
        nome: seg.nome,
        valor_total: toNumber(seg.valor_total) || 0,
        premio_liquido: toNumber(seg.premio_liquido) || 0,
        pct_comissao: toNumber(seg.pct_comissao) || 0,
        valor_comissao: (toNumber(seg.premio_liquido) || 0) * (toNumber(seg.pct_comissao) || 0) / 100,
        parcelamentos: seg.parcelamentos || '',
        forma_pagamento: seg.forma_pagamento || '',
      }))
  }

  function handleSalvarEdicao(formData) {
    if (!editando || !formData) return

    salvarEdicao({
      ...formData,
      id: formData.id || editando.id,
      cotacao_id: formData.cotacao_id || editando.cotacao_id || editando.cotacoes_auto?.id || null,
      apolice_id: formData.apolice_id || getApoliceVinculada(editando)?.id || null,
      seguradoras_cotadas: buildSeguradorasPayload(formData.seguradoras_cotadas),
      documento_apolice: manualDocumento || formData.documento_apolice || null,
      user_id: user?.id || null,
    })
  }

  function handleExcluir(item) {
    if (!item) return
    const confirmou = window.confirm('Excluir a emissao de ' + nomeEmissao(item) + '? Esta acao nao pode ser desfeita.')
    if (!confirmou) return
    excluirRegistro(item)
  }

  function abrirCotacaoCompleta(item) {
    const cotacaoId = item?.cotacoes_auto?.id || item?.cotacao_id
    if (!cotacaoId) return
    setDetalhe(null)
    navigate(`/auto/cotacoes/${cotacaoId}`, {
      state: {
        from: '/auto/emissoes',
        fromLabel: 'Gestao de Emissoes',
      },
    })
  }

  useEffect(() => {
    if (!modalEmissao) {
      setForm(FORM_EMISSAO_VAZIO)
      return
    }
    setForm({ ...getFormEmissaoInicial(modalEmissao), coluna: manualStage })
  }, [modalEmissao])

  const premioLiquido = toNumber(form.premio_liquido) || 0
  const pctComissao = toNumber(form.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const valorRepasse = form.tem_repasse ? valorComissao * (toNumber(form.pct_repasse) || 0) : 0
  const renovacaoComparativo = form.eh_renovacao
    ? buildRenovacaoComparativo(form, premioLiquido, valorComissao)
    : {
        renovacao_premio_liquido_ano_anterior: null,
        renovacao_comissao_ano_anterior: null,
        renovacao_premio_liquido_ano_atual: null,
        renovacao_comissao_ano_atual: null,
        renovacao_diferenca_premio_liquido: null,
        renovacao_diferenca_comissao: null,
      }

  function handleEmitir() {
    emitirAsync({
      emissao_id: modalEmissao.id,
      cliente_id: modalEmissao.cliente_id,
      nome_cliente: modalEmissao.cotacoes_auto?.nome_cliente || modalEmissao.nome_cliente || null,
      cpf_cliente: modalEmissao.cotacoes_auto?.cpf_cliente || modalEmissao.cpf_cliente || null,
      celular_cliente: modalEmissao.cotacoes_auto?.celular_cliente || modalEmissao.celular_cliente || null,
      condutor_nome: modalEmissao.cotacoes_auto?.condutor_nome || modalEmissao.condutor_nome || null,
      condutor_cpf: modalEmissao.cotacoes_auto?.condutor_cpf || modalEmissao.condutor_cpf || null,
      modelo_veiculo: modalEmissao.cotacoes_auto?.modelo_veiculo || modalEmissao.modelo_veiculo || null,
      placa: modalEmissao.cotacoes_auto?.placa || modalEmissao.placa || null,
      seguradora: form.seguradora,
      numero_apolice: form.numero_apolice,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim,
      premio_liquido: premioLiquido,
      pct_comissao: pctComissao,
      valor_comissao: valorComissao,
      forma_pagamento: form.forma_pagamento,
      parcelamento: form.parcelamento,
      tipo_producao: form.tipo_producao,
      responsavel: form.tipo_producao === 'individual' ? form.responsavel : null,
      eh_renovacao: form.eh_renovacao,
      ...renovacaoComparativo,
      tem_repasse: form.tem_repasse,
      pct_repasse: form.tem_repasse ? toNumber(form.pct_repasse) : null,
      nome_repasse: form.tem_repasse ? form.nome_repasse : null,
      valor_repasse: form.tem_repasse ? valorRepasse : null,
      coluna: form.coluna || 'proposta_transmitida',
      documento_apolice: emissaoDocumento,
      user_id: user?.id || null,
    }).then(() => {
      mover({ id: modalEmissao.id, coluna: form.coluna || 'proposta_transmitida' })
    }).catch(() => {})
  }

  function handleCreateManual() {
    if (manualMode === 'editar') {
      handleSalvarEdicao(manualForm)
      return
    }
    criarManual({
      nome_cliente: manualForm.nome_cliente,
      cpf_cliente: manualForm.cpf_cliente,
      celular_cliente: manualForm.celular_cliente,
      condutor_nome: manualForm.condutor_nome,
      condutor_cpf: manualForm.condutor_cpf,
      modelo_veiculo: manualForm.modelo_veiculo,
      placa: manualForm.placa,
      seguradora: manualForm.seguradora,
      numero_apolice: manualForm.numero_apolice,
      vigencia_inicio: manualForm.vigencia_inicio,
      vigencia_fim: manualForm.vigencia_fim,
      premio_liquido: toNumber(manualForm.premio_liquido),
      pct_comissao: toNumber(manualForm.pct_comissao),
      tem_repasse: manualForm.tem_repasse,
      pct_repasse: manualForm.tem_repasse ? toNumber(manualForm.pct_repasse) : null,
      nome_repasse: manualForm.tem_repasse ? manualForm.nome_repasse : null,
      forma_pagamento: manualForm.forma_pagamento,
      parcelamento: manualForm.parcelamento,
      responsavel: manualForm.responsavel,
      eh_renovacao: manualForm.eh_renovacao,
      ...(
        manualForm.eh_renovacao
          ? buildRenovacaoComparativo(manualForm, toNumber(manualForm.premio_liquido) || 0, (toNumber(manualForm.premio_liquido) || 0) * (toNumber(manualForm.pct_comissao) || 0))
          : {
              renovacao_premio_liquido_ano_anterior: null,
              renovacao_comissao_ano_anterior: null,
              renovacao_premio_liquido_ano_atual: null,
              renovacao_comissao_ano_atual: null,
              renovacao_diferenca_premio_liquido: null,
              renovacao_diferenca_comissao: null,
            }
      ),
      tipo_producao: 'individual',
    })
  }

  const metricas = useMemo(() => ({
    total: emissoes.length,
    pendentes: emissoes.filter(item => getEmissaoColuna(item) === 'pendentes').length,
    renovacoes: emissoes.filter(item => (item.cotacoes_auto?.tipo || item.tipo) === 'renovacao').length,
    emitidas: emissoes.filter(item => getEmissaoColuna(item) === 'apolice_emitida').length,
  }), [emissoes])

  const boardSummary = [
    { label: 'Pendentes', value: metricas.pendentes, tone: 'warning' },
    { label: 'Em fila', value: metricas.total, tone: 'secondary' },
    { label: 'Renovacoes', value: metricas.renovacoes, tone: 'success' },
    { label: 'Emitidas', value: metricas.emitidas, tone: 'accent' },
  ]

  const seguradorasEmissoesOpcoes = useMemo(() => {
    const nomes = new Set()
    emissoes.forEach(item => { const nome = seguradoraEmissao(item); if (nome && nome !== '-') nomes.add(nome) })
    return Array.from(nomes).sort()
  }, [emissoes])

  const responsaveisEmissoesOpcoes = useMemo(() => {
    const nomes = new Set()
    emissoes.forEach(item => { const resp = getApoliceVinculada(item)?.responsavel; if (resp) nomes.add(resp) })
    return Array.from(nomes).sort()
  }, [emissoes])

  const emissoesFiltradas = useMemo(() => {
    const termo = buscaEmissoes.trim().toLowerCase()
    return emissoes.filter(item => {
      if (filtroSeguradoraEmissoes !== 'todas' && seguradoraEmissao(item) !== filtroSeguradoraEmissoes) return false
      const tipoItem = item.cotacoes_auto?.tipo || item.tipo
      if (filtroTipoEmissoes !== 'todos' && tipoItem !== filtroTipoEmissoes) return false
      if (filtroStatusEmissoes !== 'todos' && getEmissaoColuna(item) !== filtroStatusEmissoes) return false
      if (filtroResponsavelEmissoes !== 'todos' && (getApoliceVinculada(item)?.responsavel || '') !== filtroResponsavelEmissoes) return false
      if (!termo) return true
      const texto = [
        nomeEmissao(item),
        seguradoraEmissao(item),
        item.modelo_veiculo,
        item.placa,
        item.numero_apolice,
      ].filter(Boolean).join(' ').toLowerCase()
      return texto.includes(termo)
    })
  }, [emissoes, buscaEmissoes, filtroSeguradoraEmissoes, filtroTipoEmissoes, filtroStatusEmissoes, filtroResponsavelEmissoes])

  const isManualSubmitting = manualMode === 'editar' ? isSavingEdicao : isCreatingManual
  const precisaDocumentoApoliceManual = manualMode !== 'editar' && manualForm.coluna === 'apolice_emitida'

  const modalEmissaoResumo = modalEmissao ? {
    cliente: modalEmissao.cotacoes_auto?.nome_cliente || modalEmissao.cotacoes_auto?.cpf_cliente || '—',
    cpf: modalEmissao.cotacoes_auto?.cpf_cliente || '—',
    veiculo: modalEmissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado',
    placa: modalEmissao.cotacoes_auto?.placa || 'Sem placa',
    tipo: (modalEmissao.cotacoes_auto?.tipo || modalEmissao.tipo) === 'renovacao' ? 'Renovacao' : 'Novo',
    coluna: getEmissaoColuna(modalEmissao),
  } : null

  const emissaoDetalhada = emissaoDaRota || location.state?.emissao || null

  if (emissaoId && !manualOpen) {
    if (isLoadingEmissao && !emissaoDetalhada) {
      return <div className="flex min-h-[50vh] items-center justify-center text-sm text-dark-muted">Carregando emissão...</div>
    }
    if (!emissaoDetalhada) {
      return (
        <div className="space-y-4 p-4">
          <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <EmptyState title="Emissão não encontrada" description="O registro pode ter sido removido." />
        </div>
      )
    }
    return (
      <div className="auto-page space-y-4 px-1 pb-8 animate-fade-in">
        <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para emissões
        </button>
        <ModalDetalhe page emissao={emissaoDetalhada} onClose={() => navigate('/auto/emissoes')}
          onAbrirCotacao={() => abrirCotacaoCompleta(emissaoDetalhada)} onRegistrarResultado={setModalResultado}
          onEmitirApolice={setModalEmissao} onEditar={abrirEditor} onExcluir={handleExcluir} isDeleting={isDeleting}
          tagsAtivas={tagsAtivas} onSalvarTags={(id, tags) => salvarTagsEmissao({ id, tags })} />
      </div>
    )
  }

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title={isGestaoRoute ? 'Gestao AUTO' : 'Gestao de Emissoes'}
        description={isGestaoRoute
          ? 'Area dedicada ao kanban operacional do modulo Auto.'
          : 'Area de emissao e consulta de apolices do modulo Auto.'}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(isGestaoRoute ? '/auto/emissoes' : '/auto/gestao')}
              className="btn-secondary"
            >
              {isGestaoRoute ? 'Ir para Emissoes' : 'Gestao AUTO'}
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportPlanilha}
              className="hidden"
            />
            <button
              onClick={() => importFileRef.current?.click()}
              disabled={isImportingPlanilha}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isImportingPlanilha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar planilha
            </button>
            <input
              ref={importHistoricoFileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportHistorico}
              className="hidden"
            />
            <button
              onClick={() => importHistoricoFileRef.current?.click()}
              disabled={isImportingHistorico}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isImportingHistorico ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Importar historico (renovacoes)
            </button>
            <button onClick={() => navigate('/auto/cotacoes')} className="btn-primary">
              Nova cotacao
            </button>
            <button onClick={() => { setManualMode('novo'); setManualForm(FORM_MANUAL_VAZIO); setManualDocumento(null); setManualOpen(true) }} className="btn-primary">
              Nova emissao
            </button>
            <button onClick={() => setShowApolices(true)} className="btn-secondary">
              Consultar apolices emitidas
            </button>
          </div>
        )}
        stats={isGestaoRoute ? undefined : (
          <>
            <MetricCard label="Pendentes" value={metricas.pendentes} hint="cotacoes sem status" tone="warning" icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Em fila" value={metricas.total} hint="registros no kanban" icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Renovacoes" value={metricas.renovacoes} hint="itens de carteira" tone="success" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Emitidas" value={metricas.emitidas} hint="fechadas no fluxo" tone="accent" icon={<CheckCircle2 className="w-5 h-5" />} />
          </>
        )}
      />
      {importResumo && (
        <DataCard className="border-brand-accent/20 bg-brand-accent/5" bodyClassName="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-dark-text">Ultima importacao de apolices auto</p>
              <p className="mt-1 text-xs text-dark-muted">
                {importResumo.total} linhas lidas. {importResumo.importadas} novas, {importResumo.atualizadas} atualizadas e {importResumo.ignoradas} ignoradas.
              </p>
            </div>
            {importResumo.erros?.length > 0 && (
              <span className="rounded-2xl border border-status-warning/25 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
                {importResumo.erros.length} linha(s) com aviso
              </span>
            )}
          </div>
        </DataCard>
      )}
      {importHistoricoResumo && (
        <DataCard className="border-status-warning/25 bg-status-warning/5" bodyClassName="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-dark-text">Ultima importacao de historico Auto</p>
              <p className="mt-1 text-xs text-dark-muted">
                {importHistoricoResumo.total} linhas verdes lidas. {importHistoricoResumo.importadas} novas, {importHistoricoResumo.duplicadas} ja existentes e {importHistoricoResumo.ignoradas} ignoradas.
              </p>
            </div>
            {importHistoricoResumo.erros?.length > 0 && (
              <span className="rounded-2xl border border-status-warning/25 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
                {importHistoricoResumo.erros.length} linha(s) com aviso
              </span>
            )}
          </div>
        </DataCard>
      )}
      {isGestaoRoute ? (
        <>
          <FilterBar>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-dark-muted">Periodo das emissoes</span>
              <div className="inline-flex flex-wrap rounded-2xl border border-dark-border/60 bg-dark-surface/70 p-1 shadow-sm">
                {PERIOD_OPTIONS.map(option => {
                  const active = periodo === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handlePeriodoChange(option.value)}
                      className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                        active ? 'bg-dark-text text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {periodo === 'custom' && (
                <>
                  <input
                    type="date"
                    value={filtroInicio}
                    onChange={e => setFiltroInicio(e.target.value)}
                    className="rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
                  />
                  <span className="text-xs text-dark-muted">ate</span>
                  <input
                    type="date"
                    value={filtroFim}
                    onChange={e => setFiltroFim(e.target.value)}
                    className="rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none"
                  />
                </>
              )}
              {periodo !== 'custom' && filtroInicio && filtroFim && (
                <span className="text-xs text-dark-muted">
                  {formatDateBR(filtroInicio)} ate {formatDateBR(filtroFim)}
                </span>
              )}
              {(filtroInicio || filtroFim || periodo !== 'semana') && (
                <button
                  onClick={() => handlePeriodoChange('semana')}
                  className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text"
                >
                  Voltar para semana
                </button>
              )}
            </div>
          </FilterBar>

          <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 pt-1 px-1 snap-x snap-mandatory md:snap-none">
            {COLUNAS.map(coluna => {
              const cards = emissoes.filter(item => getEmissaoColuna(item) === coluna.id)
              return (
                <DataCard
                  key={coluna.id}
                  title={coluna.label}
                  subtitle={`${cards.length} item(ns)`}
                  className={`w-[300px] shrink-0 snap-start ${dragOver === coluna.id ? 'ring-2 ring-brand-accent/20' : ''}`}
                  bodyClassName="pt-4"
                >
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(coluna.id) }}
                    onDrop={() => handleDrop(coluna.id)}
                    onDragLeave={() => setDragOver(null)}
                    className="min-h-[72vh] space-y-3"
                  >
                    {cards.length === 0 ? (
                      <EmptyState
                        icon={<Car className="w-6 h-6" />}
                        title={coluna.id === 'pendentes' ? 'Sem pendencias' : 'Coluna vazia'}
                        description={coluna.id === 'pendentes'
                          ? 'As cotacoes criadas pelo formulario aparecem aqui primeiro.'
                          : 'Arraste um card para avancar no fluxo.'}
                        className="py-8"
                      />
                    ) : (
                      cards.map(item => (
                        <CardEmissao
                          key={item.id}
                          emissao={item}
                          onDragStart={setDragging}
                          onClick={abrirDetalhe}
                          tagsPorId={tagsPorId}
                        />
                      ))
                    )}
                  </div>
                </DataCard>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <DataCard className="overflow-hidden border-brand-secondary/10" bodyClassName="p-0">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative overflow-hidden bg-gradient-to-br from-brand-secondary/12 via-transparent to-brand-accent/8 p-6 md:p-8">
                <div className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-brand-secondary/10 blur-3xl" />
                <div className="absolute -bottom-4 left-1/3 h-24 w-24 rounded-full bg-brand-accent/10 blur-3xl" />
                <div className="relative z-[1] max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-secondary/15 bg-dark-surface/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Mesa de emissao
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                    Consulte as emissoes recentes e abra a gestao quando precisar do kanban.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                    Aqui ficam a visao geral, os atalhos e a consulta das apolices emitidas. O kanban foi movido para a area dedicada de Gestao AUTO.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="badge badge-warning">{metricas.pendentes} pendentes</span>
                    <span className="badge badge-info">{metricas.total} registros</span>
                    <span className="badge badge-success">{metricas.emitidas} emitidas</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
                {boardSummary.map(item => {
                  const barClasses = {
                    warning: 'bg-status-warning/15',
                    secondary: 'bg-brand-secondary/15',
                    success: 'bg-status-success/15',
                    accent: 'bg-brand-accent/15',
                  }
                  return (
                    <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/75 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
                      <div className={`mt-3 h-1.5 rounded-full ${barClasses[item.tone]}`} />
                    </div>
                  )
                })}
              </div>
            </div>
          </DataCard>

          <FilterBar>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-dark-muted">Atalhos da area</span>
              <button onClick={() => navigate('/auto/gestao')} className="rounded-2xl border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-2 text-xs font-semibold text-status-info">
                Abrir Gestao AUTO
              </button>
              <button onClick={() => { setManualMode('novo'); setManualForm(FORM_MANUAL_VAZIO); setManualDocumento(null); setManualOpen(true) }} className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text">
                Nova emissao
              </button>
              <button onClick={() => setShowApolices(true)} className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text">
                Consultar apolices emitidas
              </button>
            </div>
          </FilterBar>

          <DataCard
            title="Ultimas emissoes"
            subtitle={`${emissoesFiltradas.length} de ${emissoes.length} registro(s) no periodo selecionado`}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-dark-muted">Mes/ano:</span>
                <input type="month" value={mesAnoEmissoes} onChange={e => handleMesAnoEmissoesChange(e.target.value)} className="input" />
              </div>
            )}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                <input
                  value={buscaEmissoes}
                  onChange={e => setBuscaEmissoes(e.target.value)}
                  placeholder="Buscar cliente, veiculo, placa ou apolice..."
                  className="input pl-10"
                />
              </div>
              <select value={filtroSeguradoraEmissoes} onChange={e => setFiltroSeguradoraEmissoes(e.target.value)} className="select">
                <option value="todas">Todas seguradoras</option>
                {seguradorasEmissoesOpcoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
              <select value={filtroTipoEmissoes} onChange={e => setFiltroTipoEmissoes(e.target.value)} className="select">
                <option value="todos">Novo e renovacao</option>
                <option value="novo">Seguro novo</option>
                <option value="renovacao">Renovacao</option>
              </select>
              <select value={filtroStatusEmissoes} onChange={e => setFiltroStatusEmissoes(e.target.value)} className="select">
                <option value="todos">Todos os status</option>
                {COLUNAS.map(coluna => <option key={coluna.id} value={coluna.id}>{coluna.label}</option>)}
              </select>
              {responsaveisEmissoesOpcoes.length > 0 && (
                <select value={filtroResponsavelEmissoes} onChange={e => setFiltroResponsavelEmissoes(e.target.value)} className="select">
                  <option value="todos">Todos responsaveis</option>
                  {responsaveisEmissoesOpcoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              )}
            </div>

            {emissoes.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                title="Nenhuma emissao encontrada"
                description="Use os atalhos acima para criar uma nova emissao ou abrir as apolices emitidas."
              />
            ) : emissoesFiltradas.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-6 h-6" />}
                title="Nenhuma emissao para os filtros aplicados"
                description="Ajuste a busca, o mes/ano ou os filtros selecionados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-border/60 text-left">
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo</th>
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Status</th>
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Apolice</th>
                      <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vigencia</th>
                      <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/40">
                    {emissoesFiltradas.slice(0, 25).map(item => (
                      <tr key={item.id} onClick={() => abrirDetalhe(item)} className="cursor-pointer transition-colors hover:bg-brand-accent/5">
                        <td className="py-3 pr-4 font-medium text-dark-text">{nomeEmissao(item)}</td>
                        <td className="py-3 pr-4 text-dark-muted">{seguradoraEmissao(item)}</td>
                        <td className="py-3 pr-4 text-dark-muted">{(item.cotacoes_auto?.tipo || item.tipo) === 'renovacao' ? 'Renovacao' : 'Novo'}</td>
                        <td className="py-3 pr-4 text-dark-muted">{getColunaMeta(getEmissaoColuna(item)).label}</td>
                        <td className="py-3 pr-4 text-dark-muted">{item.numero_apolice || '—'}</td>
                        <td className="py-3 pr-4 text-dark-muted">
                          {item.vigencia_inicio ? formatDateBR(item.vigencia_inicio) : '—'} — {item.vigencia_fim ? formatDateBR(item.vigencia_fim) : '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => abrirDetalhe(item)}
                              className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info"
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirEditor(item)}
                              className="rounded-2xl border border-dark-border px-3 py-1.5 text-xs font-semibold text-dark-text"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluir(item)}
                              className="rounded-2xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      )}

      {/* Modal: resultado da cotacao (drag para cotacao_feita) */}
      {modalResultado && (
        <ModalResultado
          emissao={modalResultado}
          onClose={() => setModalResultado(null)}
          onSave={(id, payload) => salvarResultado({ id, payload })}
          isSaving={isSavingResultado}
        />
      )}

      {/* Modal: emitir apolice (drag para proposta/apolice) */}
      {modalEmissao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-backdrop" onClick={() => { setModalEmissao(null); setForm(FORM_EMISSAO_VAZIO); setEmissaoDocumento(null); if (emissaoFileRef.current) emissaoFileRef.current.value = '' }} />
          <div className="relative z-10 glass-modal w-full max-w-6xl overflow-hidden rounded-[32px]">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="relative overflow-hidden bg-gradient-to-br from-brand-secondary/12 via-dark-surface2/70 to-brand-accent/10 p-6 md:p-7">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-dark-surface/40 blur-3xl" />
                <div className="relative z-[1]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-dark-surface/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                    <FileText className="h-3.5 w-3.5" />
                    Emissao selecionada
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-dark-text">Emitir apolice</h2>
                  <p className="mt-2 text-sm leading-6 text-dark-muted">{modalEmissaoResumo?.cliente}</p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Cliente</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalEmissaoResumo?.cliente}</p>
                      <p className="mt-1 text-xs text-dark-muted">CPF {modalEmissaoResumo?.cpf}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Veiculo</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalEmissaoResumo?.veiculo}</p>
                      <p className="mt-1 text-xs text-dark-muted">{modalEmissaoResumo?.placa}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Contexto</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-info">{modalEmissaoResumo?.tipo}</span>
                        <span className="badge badge-muted">{modalEmissaoResumo?.coluna}</span>
                      </div>
                    </div>
                  </div>

                  {premioLiquido > 0 && pctComissao > 0 && (
                    <div className="mt-6 rounded-3xl border border-status-success/20 bg-status-success/10 px-4 py-4 text-sm font-medium text-status-success shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-status-success/80">Comissao calculada</p>
                      <p className="mt-2 text-2xl font-semibold">{formatMoney(valorComissao)}</p>
                      <p className="mt-1 text-xs text-status-success/80">baseado no premio liquido informado</p>
                    </div>
                  )}
                </div>
              </aside>

              <div className="overflow-y-auto bg-dark-surface/70 p-6 md:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Dados da apolice</p>
                    <h3 className="mt-2 text-xl font-semibold text-dark-text">Preencher e confirmar emissao</h3>
                  </div>
                  <button
                    onClick={() => { setModalEmissao(null); setForm(FORM_EMISSAO_VAZIO); setEmissaoDocumento(null); if (emissaoFileRef.current) emissaoFileRef.current.value = '' }}
                    className="rounded-full p-2 hover:bg-dark-border/40 transition-colors"
                  >
                    <X className="w-5 h-5 text-dark-muted" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Etapa da transmissão</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setForm(current => ({ ...current, coluna: 'proposta_transmitida' }))}
                        className={
                          'rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ' +
                          (form.coluna === 'proposta_transmitida'
                            ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text')
                        }
                      >
                        Proposta transmitida
                        <span className="mt-1 block text-[11px] font-normal text-dark-muted">Envio inicial, sem apólice finalizada.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(current => ({ ...current, coluna: 'apolice_emitida' }))}
                        className={
                          'rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ' +
                          (form.coluna === 'apolice_emitida'
                            ? 'border-status-success bg-status-success/10 text-status-success'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text')
                        }
                      >
                        Apólice emitida
                        <span className="mt-1 block text-[11px] font-normal text-dark-muted">Permite anexar documento e número da apólice.</span>
                      </button>
                    </div>
                    {form.coluna === 'apolice_emitida' && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Anexar documento</label>
                          <input
                            ref={emissaoFileRef}
                            type="file"
                            accept="application/pdf,.pdf,.png,.jpg,.jpeg"
                            onChange={e => setEmissaoDocumento(e.target.files?.[0] || null)}
                            className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                          />
                        </div>
                        <div className="rounded-2xl border border-status-success/20 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                          A apólice será criada junto com a transmissão final.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</label>
                      {seguradorasAprovadas.length > 0 ? (
                        <select
                          value={form.seguradora}
                          onChange={e => setField('seguradora', e.target.value)}
                          className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                        >
                          <option value="">Selecionar seguradora aprovada</option>
                          {seguradorasAprovadas.map(seg => (
                            <option key={seg.nome} value={seg.nome}>
                              {seg.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-2xl border border-dark-border bg-dark-surface/70 px-3 py-2 text-sm text-dark-muted">
                          Nenhuma seguradora aprovada nesta ficha
                        </div>
                      )}
                    </div>
                    <CampoTexto label="Numero da apolice" campo="numero_apolice" value={form.numero_apolice} onChange={setField} />
                    <CampoTexto label="Vigencia inicio" campo="vigencia_inicio" value={form.vigencia_inicio} onChange={setField} type="date" />
                    <CampoTexto label="Vigencia fim" campo="vigencia_fim" value={form.vigencia_fim} onChange={setField} type="date" />
                    <CampoTexto label="Premio liquido" campo="premio_liquido" value={form.premio_liquido} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="% Comissao" campo="pct_comissao" value={form.pct_comissao} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento} onChange={setField} />
                    <CampoTexto label="Parcelamento (vezes)" campo="parcelamento" value={form.parcelamento} onChange={setField} />
                  </div>

                  <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Dados do condutor</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setField('condutor_igual_segurado', true)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          form.condutor_igual_segurado
                            ? 'border-status-success bg-status-success/10 text-status-success'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                        }`}
                      >
                        Segurado é o condutor
                      </button>
                      <button
                        type="button"
                        onClick={() => setField('condutor_igual_segurado', false)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          !form.condutor_igual_segurado
                            ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                        }`}
                      >
                        Preencher manualmente
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <CampoTexto
                        label="Nome do condutor"
                        campo="condutor_nome"
                        value={form.condutor_nome}
                        onChange={setField}
                        disabled={form.condutor_igual_segurado}
                        placeholder={form.condutor_igual_segurado ? 'Copiado do segurado' : ''}
                      />
                      <CampoTexto
                        label="CPF do condutor"
                        campo="condutor_cpf"
                        value={form.condutor_cpf}
                        onChange={setField}
                        disabled={form.condutor_igual_segurado}
                        placeholder={form.condutor_igual_segurado ? 'Copiado do segurado' : ''}
                      />
                    </div>
                    {form.condutor_igual_segurado && (
                      <p className="mt-2 text-[11px] text-dark-muted">
                        Os dados do condutor estão sendo copiados do segurado. Se precisar, desmarque para editar manualmente.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo de producao</label>
                      <select
                        value={form.tipo_producao}
                        onChange={e => setField('tipo_producao', e.target.value)}
                        className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                      >
                        <option value="equipe">Equipe</option>
                        <option value="individual">Individual</option>
                      </select>
                    </div>
                    {form.tipo_producao === 'individual' && (
                      <CampoTexto label="Responsavel" campo="responsavel" value={form.responsavel} onChange={setField} />
                    )}
                  </div>

                  <div className="grid gap-3 rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <label className="flex items-center gap-2 text-sm text-dark-text">
                      <input
                        type="checkbox"
                        checked={form.eh_renovacao}
                        onChange={e => setField('eh_renovacao', e.target.checked)}
                      />
                      E renovacao da carteira?
                    </label>
                    <label className="flex items-center gap-2 text-sm text-dark-text">
                      <input
                        type="checkbox"
                        checked={form.tem_repasse}
                        onChange={e => setField('tem_repasse', e.target.checked)}
                      />
                      Existe repasse?
                    </label>
                  </div>

                  {form.eh_renovacao && (
                    <div className="grid gap-4 rounded-3xl border border-status-success/20 bg-status-success/8 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <CampoTexto
                          label="Premio liquido ano passado"
                          campo="renovacao_premio_liquido_ano_anterior"
                          value={form.renovacao_premio_liquido_ano_anterior}
                          onChange={setField}
                          type="text"
                          inputMode="decimal"
                        />
                        <CampoTexto
                          label="Comissao ano passado"
                          campo="renovacao_comissao_ano_anterior"
                          value={form.renovacao_comissao_ano_anterior}
                          onChange={setField}
                          type="text"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-status-success/20 bg-dark-surface/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Premio liquido deste ano</p>
                          <p className="mt-2 text-sm font-semibold text-dark-text">{formatMoney(premioLiquido)}</p>
                        </div>
                        <div className="rounded-2xl border border-status-success/20 bg-dark-surface/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissao deste ano</p>
                          <p className="mt-2 text-sm font-semibold text-dark-text">{formatMoney(valorComissao)}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-brand-secondary/20 bg-dark-surface/75 p-4 text-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Comparativo</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-dark-muted">Diferenca de premio liquido</p>
                            <p className="mt-1 font-semibold text-dark-text">
                              {formatMoney((toNumber(form.renovacao_premio_liquido_ano_atual) || premioLiquido) - (toNumber(form.renovacao_premio_liquido_ano_anterior) || 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-dark-muted">Diferenca de comissao</p>
                            <p className="mt-1 font-semibold text-dark-text">
                              {formatMoney((toNumber(form.renovacao_comissao_ano_atual) || valorComissao) - (toNumber(form.renovacao_comissao_ano_anterior) || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {form.tem_repasse && (
                    <div className="grid gap-4 rounded-3xl border border-brand-secondary/20 bg-brand-secondary/8 p-4 md:grid-cols-2">
                      <CampoTexto label="% Repasse" campo="pct_repasse" value={form.pct_repasse} onChange={setField} type="number" />
                      <CampoTexto label="Nome do repasse" campo="nome_repasse" value={form.nome_repasse} onChange={setField} />
                      {valorRepasse > 0 && (
                        <div className="md:col-span-2 rounded-2xl border border-brand-secondary/20 bg-dark-surface/70 px-4 py-3 text-sm font-medium text-status-info">
                          Repasse calculado: {formatMoney(valorRepasse)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3 border-t border-dark-border/60 pt-5">
                  <button
                    onClick={() => { setModalEmissao(null); setForm(FORM_EMISSAO_VAZIO); setEmissaoDocumento(null); if (emissaoFileRef.current) emissaoFileRef.current.value = '' }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEmitir}
                    disabled={isPending || !form.seguradora || (form.coluna === 'apolice_emitida' && (!form.numero_apolice || !form.vigencia_inicio || !form.vigencia_fim || !emissaoDocumento))}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {isPending ? 'Salvando...' : (form.coluna === 'apolice_emitida' ? 'Confirmar apólice' : 'Salvar proposta')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="modal-backdrop" onClick={() => { setManualOpen(false); setManualMode('novo'); setManualForm(FORM_MANUAL_VAZIO); setManualDocumento(null); if (manualFileRef.current) manualFileRef.current.value = '' }} />
          <div className="relative z-10 glass-modal w-full max-w-6xl overflow-hidden rounded-[32px]">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="relative overflow-hidden bg-gradient-to-br from-brand-secondary/12 via-dark-surface2/70 to-brand-accent/10 p-6 md:p-7">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-dark-surface/40 blur-3xl" />
                <div className="relative z-[1]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-dark-surface/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                    <Plus className="h-3.5 w-3.5" />
                    Cadastro manual
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-dark-text">{manualMode === 'editar' ? 'Editar emissao' : 'Nova emissao'}</h2>
                  <p className="mt-2 text-sm leading-6 text-dark-muted">
                    Registre uma emissao sem cotacao previa. O sistema grava a emissao ou a apolice conforme a etapa escolhida.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Cliente</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{manualForm.nome_cliente || 'Nome pendente'}</p>
                      <p className="mt-1 text-xs text-dark-muted">{manualForm.cpf_cliente || 'CPF pendente'}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Apolice</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{manualForm.seguradora || 'Seguradora pendente'}</p>
                      <p className="mt-1 text-xs text-dark-muted">{manualForm.numero_apolice || 'Numero da apolice pendente'}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-dark-surface/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Financeiro</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-info">{manualForm.eh_renovacao ? 'Renovacao' : 'Novo'}</span>
                        <span className="badge badge-muted">{manualForm.tem_repasse ? 'Com repasse' : 'Sem repasse'}</span>
                      </div>
                    </div>
                  </div>

                  {manualForm.premio_liquido && manualForm.pct_comissao && (
                    <div className="mt-6 rounded-3xl border border-status-success/20 bg-status-success/10 px-4 py-4 text-sm font-medium text-status-success shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-status-success/80">Comissao calculada</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatMoney((toNumber(manualForm.premio_liquido) || 0) * (toNumber(manualForm.pct_comissao) || 0))}
                      </p>
                    </div>
                  )}
                </div>
              </aside>

              <div className="overflow-y-auto bg-dark-surface/70 p-6 md:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Dados da emissao</p>
                    <h3 className="mt-2 text-xl font-semibold text-dark-text">{manualMode === 'editar' ? 'Editar e salvar alteracoes' : 'Preencher e salvar manualmente'}</h3>
                  </div>
                  <button
                    onClick={() => { setManualOpen(false); setManualMode('novo'); setManualForm(FORM_MANUAL_VAZIO); setManualDocumento(null); if (manualFileRef.current) manualFileRef.current.value = '' }}
                    className="rounded-full p-2 hover:bg-dark-border/40 transition-colors"
                  >
                    <X className="w-5 h-5 text-dark-muted" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Etapa da transmissão</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setManualForm(current => ({ ...current, coluna: 'proposta_transmitida' }))}
                        className={
                          'rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ' +
                          (manualForm.coluna === 'proposta_transmitida'
                            ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text')
                        }
                      >
                        Proposta transmitida
                        <span className="mt-1 block text-[11px] font-normal text-dark-muted">Envio inicial, sem apólice finalizada.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualForm(current => ({ ...current, coluna: 'apolice_emitida' }))}
                        className={
                          'rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ' +
                          (manualForm.coluna === 'apolice_emitida'
                            ? 'border-status-success bg-status-success/10 text-status-success'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text')
                        }
                      >
                        Apólice emitida
                        <span className="mt-1 block text-[11px] font-normal text-dark-muted">Permite anexar documento e número da apólice.</span>
                      </button>
                    </div>
                    {manualForm.coluna === 'apolice_emitida' && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Anexar documento</label>
                          <input
                            ref={manualFileRef}
                            type="file"
                            accept="application/pdf,.pdf,.png,.jpg,.jpeg"
                            onChange={e => setManualDocumento(e.target.files?.[0] || null)}
                            className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                          />
                        </div>
                        <div className="rounded-2xl border border-status-success/20 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                          A apólice será criada junto com o cadastro.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Nome do segurado" campo="nome_cliente" value={manualForm.nome_cliente} onChange={setManualField} />
                    <CampoTexto label="CPF do segurado" campo="cpf_cliente" value={manualForm.cpf_cliente} onChange={setManualField} />
                    <CampoTexto label="Celular" campo="celular_cliente" value={manualForm.celular_cliente} onChange={setManualField} />
                    <CampoTexto label="Modelo do veiculo" campo="modelo_veiculo" value={manualForm.modelo_veiculo} onChange={setManualField} />
                    <CampoTexto label="Placa" campo="placa" value={manualForm.placa} onChange={setManualField} />
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</label>
                      <SeguradoraSelect
                        value={manualForm.seguradora}
                        onChange={value => setManualField('seguradora', value)}
                        produto="auto"
                        placeholder="Selecionar seguradora"
                      />
                    </div>
                    <CampoTexto label="Numero da apolice" campo="numero_apolice" value={manualForm.numero_apolice} onChange={setManualField} />
                    <CampoTexto label="Vigencia inicio" campo="vigencia_inicio" value={manualForm.vigencia_inicio} onChange={setManualField} type="date" />
                    <CampoTexto label="Vigencia fim" campo="vigencia_fim" value={manualForm.vigencia_fim} onChange={setManualField} type="date" />
                    <CampoTexto label="Premio liquido" campo="premio_liquido" value={manualForm.premio_liquido} onChange={setManualField} type="text" inputMode="decimal" />
                    <CampoTexto label="% Comissao" campo="pct_comissao" value={manualForm.pct_comissao} onChange={setManualField} type="text" inputMode="decimal" />
                    <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={manualForm.forma_pagamento} onChange={setManualField} />
                    <CampoTexto label="Parcelamento (vezes)" campo="parcelamento" value={manualForm.parcelamento} onChange={setManualField} />
                  </div>

                  <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Dados do condutor</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setManualField('condutor_igual_segurado', true)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          manualForm.condutor_igual_segurado
                            ? 'border-status-success bg-status-success/10 text-status-success'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                        }`}
                      >
                        Segurado é o condutor
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualField('condutor_igual_segurado', false)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          !manualForm.condutor_igual_segurado
                            ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                        }`}
                      >
                        Preencher manualmente
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <CampoTexto
                        label="Nome do condutor"
                        campo="condutor_nome"
                        value={manualForm.condutor_nome}
                        onChange={setManualField}
                        disabled={manualForm.condutor_igual_segurado}
                        placeholder={manualForm.condutor_igual_segurado ? 'Copiado do segurado' : ''}
                      />
                      <CampoTexto
                        label="CPF do condutor"
                        campo="condutor_cpf"
                        value={manualForm.condutor_cpf}
                        onChange={setManualField}
                        disabled={manualForm.condutor_igual_segurado}
                        placeholder={manualForm.condutor_igual_segurado ? 'Copiado do segurado' : ''}
                      />
                    </div>
                    {manualForm.condutor_igual_segurado && (
                      <p className="mt-2 text-[11px] text-dark-muted">
                        Os dados do condutor estão sendo copiados do segurado. Se precisar, desmarque para editar manualmente.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <CampoTexto label="Responsavel" campo="responsavel" value={manualForm.responsavel} onChange={setManualField} placeholder="Opcional" />
                    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                      <label className="flex items-center gap-2 text-sm text-dark-text">
                        <input
                          type="checkbox"
                          checked={manualForm.eh_renovacao}
                          onChange={e => setManualField('eh_renovacao', e.target.checked)}
                        />
                        E renovacao?
                      </label>
                    </div>
                  </div>

                  {manualForm.eh_renovacao && (
                    <div className="grid gap-4 rounded-3xl border border-status-success/20 bg-status-success/8 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <CampoTexto
                          label="Premio liquido ano passado"
                          campo="renovacao_premio_liquido_ano_anterior"
                          value={manualForm.renovacao_premio_liquido_ano_anterior}
                          onChange={setManualField}
                          type="text"
                          inputMode="decimal"
                        />
                        <CampoTexto
                          label="Comissao ano passado"
                          campo="renovacao_comissao_ano_anterior"
                          value={manualForm.renovacao_comissao_ano_anterior}
                          onChange={setManualField}
                          type="text"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-status-success/20 bg-dark-surface/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Premio liquido deste ano</p>
                          <p className="mt-2 text-sm font-semibold text-dark-text">{formatMoney(toNumber(manualForm.premio_liquido) || 0)}</p>
                        </div>
                        <div className="rounded-2xl border border-status-success/20 bg-dark-surface/80 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissao deste ano</p>
                          <p className="mt-2 text-sm font-semibold text-dark-text">{formatMoney((toNumber(manualForm.premio_liquido) || 0) * (toNumber(manualForm.pct_comissao) || 0))}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <label className="flex items-center gap-2 text-sm text-dark-text">
                      <input
                        type="checkbox"
                        checked={manualForm.tem_repasse}
                        onChange={e => setManualField('tem_repasse', e.target.checked)}
                      />
                      Tem repasse?
                    </label>

                    {manualForm.tem_repasse && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <CampoTexto label="% Repasse" campo="pct_repasse" value={manualForm.pct_repasse} onChange={setManualField} type="number" />
                        <CampoTexto label="Nome do repasse" campo="nome_repasse" value={manualForm.nome_repasse} onChange={setManualField} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-dark-border/60 pt-5">
                    <button
                      onClick={() => { setManualOpen(false); setManualMode('novo'); setManualForm(FORM_MANUAL_VAZIO); setManualDocumento(null); if (manualFileRef.current) manualFileRef.current.value = '' }}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateManual}
                      disabled={isManualSubmitting
                        || !manualForm.nome_cliente
                        || !manualForm.cpf_cliente
                        || !manualForm.celular_cliente
                        || !manualForm.condutor_nome
                        || !manualForm.seguradora
                        || !manualForm.premio_liquido
                        || !manualForm.pct_comissao
                        || (manualForm.coluna === 'apolice_emitida' && (!manualForm.numero_apolice || !manualForm.vigencia_inicio || !manualForm.vigencia_fim || (precisaDocumentoApoliceManual && !manualDocumento)))
                        || (manualForm.tem_repasse && (!manualForm.pct_repasse || !manualForm.nome_repasse))
                      }
                      className="btn-primary flex-1 disabled:opacity-50"
                    >
                      {isManualSubmitting ? 'Salvando...' : (manualMode === 'editar' ? 'Salvar alteracoes' : (manualForm.coluna === 'apolice_emitida' ? 'Salvar apolice' : 'Salvar proposta'))}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApolices && <ModalApolices onClose={() => setShowApolices(false)} onOpenApolice={apoliceId => { setShowApolices(false); navigate(`/auto/apolices/${apoliceId}`) }} />}

      {detalhe && (
        <ModalDetalhe
          emissao={detalhe}
          onClose={() => setDetalhe(null)}
          onAbrirCotacao={() => abrirCotacaoCompleta(detalhe)}
          onRegistrarResultado={(em) => { setDetalhe(null); setModalResultado(em) }}
          onEmitirApolice={(em) => { setDetalhe(null); setModalEmissao(em) }}
          onEditar={abrirEditor}
          onExcluir={handleExcluir}
          isDeleting={isDeleting}
          tagsAtivas={tagsAtivas}
          onSalvarTags={(id, tags) => salvarTagsEmissao({ id, tags })}
        />
      )}
    </div>
  )
}



