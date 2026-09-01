import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { ArrowLeft, ArrowRight, CalendarDays, Car, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Loader2, PencilLine, RefreshCw, Search, ShieldCheck, Trash2, Upload, X, XCircle, Plus, History } from 'lucide-react'
import { endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'
import {
  atualizarEmissaoAutoCompleta, atualizarStatusRenovacao, atualizarTagsEmissao, calcularValorComissaoAuto, cancelarRenovacao, criarEmissaoManualAuto, deletarCotacaoAuto, deletarEmissaoAuto,
  emitirApoliceAuto, getApolicesAuto, getAutoTags, getEmissaoAuto, getEmissaoColuna, getEmissoesAuto, getRenovacoesPendentesSemCotacao,
  iniciarCotacaoRenovacao, importarApolicesAutoHistorico, moverEmissaoColuna,
  salvarPropostaPlanilhaAuto, salvarResultadoCotacao,
} from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, DatePicker, FilterBar, EmptyState } from '../../components/ui'
import { AutoPdfAutomation, AutoQuoteSnapshot } from '../../components/auto'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  formatDateBR, formatDiasParaVencer, formatMoney, diasParaVencer,
  getRenovacaoUrgencia, RENOVACAO_URGENCIA_META,
} from './autoShared'
import { uploadDocumento } from '../../lib/documentos'
import { toNumber } from '../../lib/apolices'
import { parseAutoHistoricoPlanilha, somarUmAno } from '../../lib/autoHistoricoImport.js'
import { parseOrcamentoAuto, parsePropostaAuto } from '../../lib/autoPdfParser.js'
import {
  AUTO_OTHER_PIPELINE_STAGES, AUTO_PIPELINE_STAGES, AUTO_RENEWAL_PIPELINE_STAGES, AUTO_TIPO_META,
  filterAutoPipelineEmissions, isAutoPipelineItemInMonth, renovacaoStageFields, resolveRenovacaoStage, scoreCotacaoSuggestion,
} from '../../lib/autoOperational.js'
import {
  alternarColunaRecolhida, etapaVizinha, etapaVizinhaRenovacao, gravarPreferenciasPipeline,
  isProposalTransmissionStage, lerPreferenciasPipeline, requiresAutoEmissionRegistration, resumoFinanceiroEtapa,
} from '../../lib/autoPipelineBoard.js'
import { useOrigemAtual, useVoltar } from '../../hooks/useVoltar.js'
const COLUNAS = [
  { id: 'pendentes', label: 'Cotações pendentes', hint: 'somente seguros novos ainda não cotados', tone: 'warning' },
  { id: 'cotacao_feita', label: 'Cotações feitas', hint: 'seguro novo, renovação ou endosso identificados pela etiqueta', tone: 'secondary' },
  { id: 'negociando', label: 'Negociando', hint: 'em tratativa com cliente', tone: 'accent' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria ou rastreador', hint: 'dependem de vistoria ou instalação', tone: 'warning' },
  { id: 'proposta_transmitida', label: 'Proposta transmitida', hint: 'proposta enviada para a seguradora', tone: 'success' },
  { id: 'apolice_emitida', label: 'Apólice emitida', hint: 'apólice finalizada com documento', tone: 'accent' },
]

const PIPELINE_VIEWS = [
  { id: 'renovacoes', label: 'Renovações', description: 'Carteira, cálculos e acompanhamento até a emissão', icon: RefreshCw },
  { id: 'outros', label: 'Novos e endossos', description: 'Cotações novas, endossos e propostas em andamento', icon: Car },
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
  data_emissao: '',
  data_transmissao: '',
  emissor: '',
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
  valor_repasse: '',
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
  data_emissao: '',
  data_transmissao: '',
  emissor: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  coluna: 'proposta_transmitida',
  premio_liquido: '',
  pct_comissao: '',
  tem_repasse: false,
  valor_repasse: '',
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
  data_emissao: '',
  data_transmissao: '',
  emissor: '',
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

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function validMonthRef(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? value : currentMonthRef()
}

function pipelineMonthLabel(value) {
  const [year, month] = validMonthRef(value).split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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

// Ao arrastar um card para "Cotacao feita" pela primeira vez, o modal de
// resultado abria sempre em branco - o usuario tinha que redigitar a
// seguradora e os valores que ja estavam preenchidos na cotacao (seguradora
// preferencial, ou a mais barata na falta dela - mesma ordem de prioridade
// usada em getFormEmissaoInicial/seguradoraEmissao). Se a emissao ja tem um
// resultado registrado (reabrindo o modal depois de "Editar"), usa esse
// resultado em vez de voltar a copiar da cotacao.
function getSeguradorasResultadoInicial(emissao) {
  const jaRegistradas = getSeguradorasAprovadas(emissao)
  if (jaRegistradas.length > 0) {
    return jaRegistradas.map(seg => ({ ...NOVA_SEGURADORA, ...seg }))
  }

  const c = emissao?.cotacoes_auto || {}
  const preferencial = c.seguradora_preferencial
  const maisBarata = c.seguradora_mais_barata
  const base = preferencial?.nome ? preferencial : (maisBarata?.nome ? maisBarata : null)
  if (!base) return [{ ...NOVA_SEGURADORA }]

  return [{
    ...NOVA_SEGURADORA,
    nome: base.nome || '',
    valor_total: base.premio_total ?? '',
    premio_liquido: base.premio_liquido ?? '',
    pct_comissao: base.pct_comissao ?? '',
    parcelamentos: base.parcelamentos || '',
    forma_pagamento: base.forma_pagamento || '',
  }]
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
  const tipoCotacao = c.tipo || emissao?.tipo || 'novo'
  // Endosso nao tem seguradoras aprovadas: herda a seguradora que ja esta na
  // emissao ou na apolice de origem (copiada para seguradora_preferencial por
  // criarCotacaoEndosso).
  const seguradoraInicial = tipoCotacao === 'endosso'
    ? (emissao?.seguradora || preferida || '')
    : primeiraAprovada

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
    seguradora: seguradoraInicial,
    numero_apolice: emissao?.numero_apolice || c.numero_orcamento || '',
    data_emissao: emissao?.data_emissao || getApoliceVinculada(emissao)?.data_emissao || new Date().toISOString().slice(0, 10),
    data_transmissao: emissao?.data_transmissao || new Date().toISOString().slice(0, 10),
    emissor: emissao?.emissor || '',
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
    valor_repasse: emissao?.valor_repasse ?? '',
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

// `COLUNAS` so descreve as 6 etapas de emissao. A renovacao tambem passa pelas
// duas colunas de renovacao, que so existem em `AUTO_PIPELINE_STAGES`.
function getEtapaLabel(stageId) {
  return AUTO_PIPELINE_STAGES.find(item => item.id === stageId)?.label || getColunaMeta(stageId).label
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
    tipo: ['novo', 'renovacao', 'endosso'].includes(c.tipo || emissao?.tipo) ? (c.tipo || emissao?.tipo) : 'novo',
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
    data_emissao: apolice?.data_emissao || '',
    data_transmissao: emissao?.data_transmissao || '',
    emissor: emissao?.emissor || '',
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
    renovacao_comissao_ano_atual: toNumberOrEmpty(apolice?.renovacao_comissao_ano_atual ?? emissao?.renovacao_comissao_ano_atual ?? calcularValorComissaoAuto(toNumber(premioLiquido) || 0, toNumber(pctComissao) || 0)),
    seguradoras_cotadas: normalizeSeguradorasCotadas(aprovadas),
  }
}

function CardEmissao({ emissao, onDragStart, onClick, onMover, tagsPorId }) {
  const cardTags = (emissao.tags ?? []).map(id => tagsPorId?.get(id)).filter(Boolean)
  const coluna = getEmissaoColuna(emissao)
  const colunaMeta = getColunaMeta(coluna)
  const tipo = emissao.cotacoes_auto?.tipo || emissao.tipo
  const isRenovacao = tipo === 'renovacao'
  const tipoMeta = AUTO_TIPO_META[tipo] || AUTO_TIPO_META.novo
  const isRecusada = emissao.resultado === 'recusada'
  const isEmitida = coluna === 'apolice_emitida'
  const isAprovada = emissao.resultado === 'aprovada' && !isEmitida
  const isCotada = emissao.resultado === 'cotada'
  const nome = nomeEmissao(emissao)
  const apolice = getApoliceVinculada(emissao)
  const veiculo = emissao.modelo_veiculo || apolice?.modelo_veiculo || emissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado'
  const placa = emissao.placa || apolice?.placa || emissao.cotacoes_auto?.placa || 'Sem placa'
  const seguradora = apolice?.seguradora || seguradoraEmissao(emissao)
  const vigenciaFim = apolice?.vigencia_fim || emissao.vigencia_fim || emissao.cotacoes_auto?.vigencia_fim || ''
  const premio = apolice?.premio_liquido ?? emissao.premio_liquido ?? 0
  const comissao = apolice?.valor_comissao ?? emissao.valor_comissao ?? 0
  const prazo = vigenciaFim ? Math.ceil((new Date(`${vigenciaFim}T12:00:00`) - new Date()) / (1000 * 60 * 60 * 24)) : null
  // Quando a renovacao ja virou emissao, voltar de "Cotacao feita" para o
  // backlog exigiria alterar a linha de renovacoes_auto, nao a emissao. Por
  // isso esta e a primeira etapa movel deste tipo de card.
  const etapaAnterior = isRenovacao && coluna === 'cotacao_feita' ? null : etapaVizinha(coluna, -1)
  const proximaEtapa = etapaVizinha(coluna, 1)

  let shellClass = 'border-brand-secondary/20 bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
  let accentClass = 'from-brand-secondary to-brand-accent'
  if (isRecusada) {
    shellClass = 'border-red-200 bg-red-50/90 shadow-[0_10px_24px_rgba(239,68,68,0.07)]'
    accentClass = 'from-red-400 to-red-500'
  } else if (isRenovacao) {
    shellClass = 'border-status-success/20 bg-status-success/5 shadow-[0_10px_24px_rgba(34,197,94,0.07)]'
    accentClass = 'from-status-success to-brand-secondary'
  } else if (coluna === 'pendentes') {
    shellClass = 'border-status-warning/20 bg-status-warning/5 shadow-[0_10px_24px_rgba(245,158,11,0.07)]'
    accentClass = 'from-brand-accent to-brand-secondary'
  }

  // Div com papel de botao, e nao <button>: os controles de avancar/voltar
  // etapa moram dentro do card, e botao dentro de botao e HTML invalido.
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={() => onDragStart(emissao)}
      onClick={() => onClick(emissao)}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onClick(emissao)
      }}
      title="Abrir detalhes da emissao"
      className={['auto-kanban-card group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)]', shellClass].join(' ')}
    >
      <div className={['absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accentClass].join(' ')} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-dark-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">{colunaMeta.label}</span>
            <span className={tipoMeta.className}>{tipoMeta.label}</span>
            {typeof prazo === 'number' && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${prazo < 0 ? 'bg-red-100 text-red-600' : prazo <= 15 ? 'bg-status-warning/10 text-status-warning' : 'bg-dark-surface text-dark-muted'}`}>{prazo < 0 ? `${Math.abs(prazo)}d vencida` : `${prazo}d p/ vencer`}</span>}
          </div>
          <div>
            <p className="truncate text-sm font-semibold text-dark-text">{nome}</p>
            <p className="mt-0.5 truncate text-xs text-dark-muted">{veiculo}</p>
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
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isRecusada && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">Recusada</span>}
          {isEmitida && <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold text-status-success">Emitida</span>}
          {isAprovada && <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold text-status-success">Aprovada</span>}
          {isCotada && !isEmitida && <span className="rounded-full bg-brand-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-status-info">Cotada</span>}
          {!emissao.resultado && !isEmitida && <span className="rounded-full bg-dark-surface px-2 py-0.5 text-[10px] font-semibold text-dark-muted">Em andamento</span>}
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-white/70 bg-dark-surface/70 p-2">
        <div className="flex items-center gap-2">
          <SeguradoraBadge nome={seguradora} size="md" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-dark-text">{seguradora}</p>
            <p className="truncate text-[11px] text-dark-muted">Placa {placa} · CPF {cpfEmissao(emissao)}</p>
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-x-2 gap-y-1.5 rounded-xl border border-white/70 bg-white/70 p-2 text-xs text-dark-muted sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted">Vigência</p>
          <p className="truncate text-xs font-medium text-dark-text">{emissao.vigencia_inicio ? formatDateBR(emissao.vigencia_inicio) : '—'} · {vigenciaFim ? formatDateBR(vigenciaFim) : '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted">Condutor</p>
          <p className="truncate text-xs font-medium text-dark-text">{condutorEmissao(emissao)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted">Prêmio líquido</p>
          <p className="truncate text-xs font-medium text-dark-text">{formatMoney(premio)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted">Comissão</p>
          <p className="truncate text-xs font-medium text-dark-text">{formatMoney(comissao)}</p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-dark-muted">
        <span className="auto-kanban-card-hint">{colunaMeta.hint}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-status-info">Abrir <ArrowRight className="h-3.5 w-3.5" /></span>
      </div>

      {/* Avancar/voltar sem arrastar. Num notebook, arrastar um card por um
          quadro que rola na horizontal e a acao mais custosa da tela; aqui um
          clique faz o mesmo. `stopPropagation` impede que o clique tambem abra
          o detalhe do card. */}
      <span className="auto-kanban-card-move" role="group" aria-label="Mover de etapa">
        <button
          type="button"
          disabled={!etapaAnterior}
          title={etapaAnterior ? `Voltar para ${getColunaMeta(etapaAnterior).label}` : 'Primeira etapa do funil'}
          aria-label={etapaAnterior ? `Voltar para ${getColunaMeta(etapaAnterior).label}` : 'Primeira etapa do funil'}
          onClick={event => { event.stopPropagation(); if (etapaAnterior) onMover?.(emissao, etapaAnterior) }}
        >
          <ChevronsLeft />
        </button>
        <button
          type="button"
          disabled={!proximaEtapa}
          title={proximaEtapa ? `Avançar para ${getColunaMeta(proximaEtapa).label}` : 'Última etapa do funil'}
          aria-label={proximaEtapa ? `Avançar para ${getColunaMeta(proximaEtapa).label}` : 'Última etapa do funil'}
          onClick={event => { event.stopPropagation(); if (proximaEtapa) onMover?.(emissao, proximaEtapa) }}
        >
          <ChevronsRight />
        </button>
      </span>
    </div>
  )
}

// Card da renovacao no quadro. A renovacao vive em `renovacoes_auto`, fora do
// modelo emissoes_auto/cotacoes_auto que alimenta as outras colunas, mas
// circula pelo funil como qualquer outro card: arrastar grava o status na
// propria linha e o card fica na coluna de destino. "Iniciar cotacao" continua
// sendo o caminho separado para transformar a renovacao em cotacao de verdade.
function CardRenovacaoPendente({ renovacao, onDragStart, onMover, onIniciarCotacao, onCancelar, iniciando, cancelando }) {
  const apolice = renovacao.apolices_auto || {}
  const nome = renovacao.clientes_auto?.nome_completo || apolice.nome_cliente || renovacao.nome_segurado_anterior || 'Segurado'
  const seguradora = renovacao.seguradora || apolice.seguradora || null
  const dias = diasParaVencer(renovacao.vigencia_fim)
  const urgenciaKey = getRenovacaoUrgencia({ dias, concluida: false, proximoMes: false })
  const urgencia = RENOVACAO_URGENCIA_META[urgenciaKey]

  const coluna = resolveRenovacaoStage(renovacao)
  const etapaAnterior = etapaVizinhaRenovacao(coluna, -1)
  const proximaEtapa = etapaVizinhaRenovacao(coluna, 1)

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(renovacao)}
      className="auto-kanban-card relative flex w-full flex-col overflow-hidden rounded-2xl border border-brand-accent/20 bg-brand-accent/5 p-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-accent to-brand-secondary" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-dark-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Renovação</span>
        {typeof dias === 'number' && (
          <span className={`badge ${urgencia.badgeClass}`}>{formatDiasParaVencer(dias)}</span>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-dark-text">{nome}</p>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 p-2">
        {seguradora ? <SeguradoraBadge nome={seguradora} size="sm" /> : <span className="text-[11px] text-dark-muted">Seguradora não informada</span>}
        <div className="min-w-0 text-[11px] leading-snug text-dark-muted">
          <p className="truncate">Vence {formatDateBR(renovacao.vigencia_fim)}</p>
          {renovacao.data_limite_envio && <p className="truncate">Envio até {formatDateBR(renovacao.data_limite_envio)}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onIniciarCotacao(renovacao.id)}
          disabled={iniciando}
          className="btn-primary inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {iniciando ? 'Abrindo...' : (renovacao.cotacao_id ? 'Abrir cotação' : 'Iniciar cotação')}
        </button>
        <button
          type="button"
          onClick={() => onCancelar(renovacao.id)}
          disabled={cancelando}
          className="rounded-xl border border-status-danger/30 bg-status-danger/5 px-3 py-1.5 text-[11px] font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
        >
          Cancelar renovação
        </button>
      </div>

      {/* Mesmo par de setas do card de emissao: arrastar num quadro que rola na
          horizontal e caro no trackpad, e a renovacao agora percorre o mesmo
          funil. */}
      <span className="auto-kanban-card-move" role="group" aria-label="Mover de etapa">
        <button
          type="button"
          disabled={!etapaAnterior}
          title={etapaAnterior ? `Voltar para ${getEtapaLabel(etapaAnterior)}` : 'Primeira etapa do funil'}
          aria-label={etapaAnterior ? `Voltar para ${getEtapaLabel(etapaAnterior)}` : 'Primeira etapa do funil'}
          onClick={event => { event.stopPropagation(); if (etapaAnterior) onMover?.(renovacao, etapaAnterior) }}
        >
          <ChevronsLeft />
        </button>
        <button
          type="button"
          disabled={!proximaEtapa}
          title={proximaEtapa ? `Avançar para ${getEtapaLabel(proximaEtapa)}` : 'Última etapa do funil'}
          aria-label={proximaEtapa ? `Avançar para ${getEtapaLabel(proximaEtapa)}` : 'Última etapa do funil'}
          onClick={event => { event.stopPropagation(); if (proximaEtapa) onMover?.(renovacao, proximaEtapa) }}
        >
          <ChevronsRight />
        </button>
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
  const tipoRaw = c.tipo || emissao.tipo || 'novo'
  const tipo = tipoRaw === 'renovacao' ? 'Renovação' : tipoRaw === 'endosso' ? 'Endosso' : 'Seguro novo'
  const seguradoras = Array.isArray(emissao.seguradoras_cotadas) ? emissao.seguradoras_cotadas : []
  const seguradoraAtual = emissao.seguradora || apolice?.seguradora || c.seguradora_preferencial?.nome || c.seguradora_mais_barata?.nome || ''
  const etapaAtual = emissao.resultado === 'aprovada' ? 'Cotacao aprovada' : emissao.resultado === 'recusada' ? 'Cotacao recusada' : emissao.resultado === 'cotada' ? 'Cotacao feita' : 'Aguardando resultado'
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
                  <span className={tipoRaw === 'renovacao' ? 'rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success' : 'rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-status-info'}>{tipo}</span>
                  {emissao.resultado && <span className={emissao.resultado === 'aprovada' ? 'rounded-full bg-status-success/10 px-2.5 py-1 text-[10px] font-semibold text-status-success' : emissao.resultado === 'recusada' ? 'rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-semibold text-red-600' : 'rounded-full bg-brand-secondary/10 px-2.5 py-1 text-[10px] font-semibold text-status-info'}>{emissao.resultado === 'aprovada' ? 'Aprovada' : emissao.resultado === 'recusada' ? 'Recusada' : 'Cotada'}</span>}
                </div>
                <h2 className="mt-4 truncate text-2xl font-semibold text-dark-text">{nome}</h2>
                <p className="mt-2 text-sm text-dark-muted">{emissao.modelo_veiculo || c.modelo_veiculo || 'Veiculo nao informado'}{(emissao.placa || c.placa) ? ` · Placa ${emissao.placa || c.placa}` : ''}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-dark-muted transition-colors hover:bg-dark-border/40">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 auto-pipeline-quote-complete">
              <div className="auto-pipeline-quote-complete-head">
                <div><span>Cotação completa</span><strong>Todas as informações disponíveis</strong><small>O primeiro clique na Pipeline já abre o conteúdo integral do negócio.</small></div>
              </div>
              <AutoQuoteSnapshot quote={c} emission={emissao} policy={apolice || {}} />
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
                {temCotacao && onAbrirCotacao && <button type="button" onClick={onAbrirCotacao} className="btn-secondary w-full text-xs">Editar no workspace da cotação</button>}
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
  const valorComissao = calcularValorComissaoAuto(toNumber(seg.premio_liquido) || 0, toNumber(seg.pct_comissao) || 0)

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
  const [seguradoras, setSeguradoras] = useState(() => getSeguradorasResultadoInicial(emissao))
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfStatus, setPdfStatus] = useState('idle')
  const [pdfResult, setPdfResult] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [pdfApplied, setPdfApplied] = useState(false)

  const c = emissao.cotacoes_auto || {}
  const nome = nomeEmissao(emissao)
  const herdouDaCotacao = getSeguradorasAprovadas(emissao).length === 0
    && Boolean(c.seguradora_preferencial?.nome || c.seguradora_mais_barata?.nome)

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

  async function handlePdf(file) {
    setPdfFile(file)
    setPdfResult(null)
    setPdfError('')
    setPdfApplied(false)
    if (!file) {
      setPdfStatus('idle')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setPdfStatus('attached')
      return
    }
    setPdfStatus('reading')
    try {
      const parsed = await parseOrcamentoAuto(file)
      setPdfResult(parsed)
      setPdfStatus('ready')
    } catch (error) {
      setPdfError(error?.message || 'O conteúdo do documento não pôde ser extraído.')
      setPdfStatus('error')
    }
  }

  function applyPdf() {
    const imported = pdfResult?.seguradora_cotada
    if (!imported) return
    const next = { ...NOVA_SEGURADORA, ...imported }
    setSeguradoras(current => {
      const matchingIndex = current.findIndex(item => item.nome && item.nome === next.nome)
      if (matchingIndex >= 0) return current.map((item, index) => index === matchingIndex ? { ...item, ...next } : item)
      const emptyIndex = current.findIndex(item => !item.nome)
      if (emptyIndex >= 0) return current.map((item, index) => index === emptyIndex ? next : item)
      return [...current, next]
    })
    setPdfApplied(true)
  }

  function handleSave() {
    const seguradasFinal = resultado === 'aprovada'
      ? seguradoras.map(s => ({
          nome: s.nome,
          valor_total: toNumber(s.valor_total) || 0,
          premio_liquido: toNumber(s.premio_liquido) || 0,
          pct_comissao: toNumber(s.pct_comissao) || 0,
          valor_comissao: calcularValorComissaoAuto(toNumber(s.premio_liquido) || 0, toNumber(s.pct_comissao) || 0),
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
            <AutoPdfAutomation
              mode="orcamento"
              file={pdfFile}
              status={pdfStatus}
              result={pdfResult}
              error={pdfError}
              applied={pdfApplied}
              onFile={handlePdf}
              onApply={applyPdf}
              onClear={() => { setPdfFile(null); setPdfStatus('idle'); setPdfResult(null); setPdfError(''); setPdfApplied(false) }}
              compact
            />
            <p className="text-xs text-dark-muted">
              Adicione ao menos uma seguradora com o resultado da cotacao.
            </p>
            {herdouDaCotacao && (
              <div className="rounded-2xl border border-status-success/25 bg-status-success/8 px-3 py-2 text-xs text-status-success">
                Seguradora e valores preenchidos automaticamente a partir da cotacao. Confira antes de salvar.
              </div>
            )}
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

function PropostaTransmitidaFields({ form, onChange, valorComissao, tipo }) {
  const setRepasse = (campo, value) => {
    onChange(campo, value)
    onChange('tem_repasse', Boolean(String(value || '').trim()))
  }

  return (
    <div className="rounded-3xl border border-brand-accent/20 bg-brand-accent/5 p-4">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-status-info">Mesmos campos da planilha</p>
        <p className="mt-1 text-xs text-dark-muted">
          {form.coluna === 'aguardando_vistoria'
            ? 'Registre a transmissão; a proposta ficará aguardando a vistoria ou a instalação do rastreador.'
            : 'Registre a transmissão agora; número da apólice e veículo continuam opcionais.'}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CampoTexto label="Transmissão" campo="data_transmissao" type="date" value={form.data_transmissao} onChange={onChange} />
        <CampoTexto label="Vigência" campo="vigencia_inicio" type="date" value={form.vigencia_inicio} onChange={onChange} />
        <CampoTexto label="Segurado" campo="nome_cliente" value={form.nome_cliente} onChange={onChange} />
        <CampoTexto label="Qnt. de parcelas" campo="parcelamento" value={form.parcelamento} onChange={onChange} placeholder="Ex.: 10x" />
        <CampoTexto label="Seguradora" campo="seguradora" value={form.seguradora} onChange={onChange} />
        <CampoTexto label="Prêmio líquido" campo="premio_liquido" value={form.premio_liquido} onChange={onChange} inputMode="decimal" />
        <CampoTexto label="% Comissão" campo="pct_comissao" value={form.pct_comissao} onChange={onChange} inputMode="decimal" />
        <CampoTexto label="Valor da comissão" campo="valor_comissao" value={valorComissao ? formatMoney(valorComissao) : ''} onChange={onChange} disabled />
        <CampoTexto label="Repasse comissão" campo="valor_repasse" value={form.valor_repasse} onChange={setRepasse} inputMode="decimal" />
        <CampoTexto label="Corretor" campo="responsavel" value={form.responsavel} onChange={onChange} />
        <CampoTexto label="O que é" campo="tipo" value={AUTO_TIPO_META[tipo]?.label || 'Seguro novo'} onChange={onChange} disabled />
        <CampoTexto label="Emissor" campo="emissor" value={form.emissor} onChange={onChange} />
        <CampoTexto label="Status" campo="status" value="EM EMISSÃO" onChange={onChange} disabled />
        <CampoTexto label="Nº apólice" campo="numero_apolice" value={form.numero_apolice} onChange={onChange} placeholder="Opcional nesta etapa" />
        <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento} onChange={onChange} />
        <CampoTexto label="Veículo" campo="modelo_veiculo" value={form.modelo_veiculo} onChange={onChange} placeholder="Opcional" />
        <CampoTexto label="Placa" campo="placa" value={form.placa} onChange={onChange} placeholder="Opcional" />
        <CampoTexto label="WhatsApp" campo="celular_cliente" value={form.celular_cliente} onChange={onChange} />
      </div>
    </div>
  )
}

const NOVA_LINHA_PLANILHA = {
  emissao_id: '', cotacao_id: '', data_transmissao: '', vigencia_inicio: '', nome_cliente: '',
  modelo_veiculo: '', parcelamento: '', seguradora: '', premio_liquido: '', pct_comissao: '',
  valor_repasse: '', responsavel: '', tipo: 'novo', emissor: '', coluna: 'proposta_transmitida',
}

function PlanilhaEmissoes({ items, onSave, onOpen, onEdit, onMove, saving }) {
  const [draft, setDraft] = useState(() => ({ ...NOVA_LINHA_PLANILHA, data_transmissao: new Date().toISOString().slice(0, 10) }))
  const set = (field, value) => setDraft(current => ({ ...current, [field]: value }))
  const sugestoes = useMemo(() => {
    if (draft.emissao_id || draft.nome_cliente.trim().length < 2) return []
    return items
      .filter(item => item.cotacao_id || item.cotacoes_auto?.id)
      .map(item => ({ item, score: scoreCotacaoSuggestion(item, draft.nome_cliente, draft.data_transmissao) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(entry => entry.item)
  }, [draft.data_transmissao, draft.emissao_id, draft.nome_cliente, items])

  const selecionar = item => {
    const cotacao = item.cotacoes_auto || {}
    const tipo = cotacao.tipo || item.tipo || 'novo'
    setDraft(current => ({
      ...current,
      emissao_id: item.id,
      cotacao_id: item.cotacao_id || cotacao.id || '',
      nome_cliente: nomeEmissao(item),
      modelo_veiculo: item.modelo_veiculo || cotacao.modelo_veiculo || '',
      vigencia_inicio: item.vigencia_inicio || cotacao.vigencia_inicio || '',
      parcelamento: item.parcelamento || '',
      seguradora: seguradoraEmissao(item) === '-' ? '' : seguradoraEmissao(item),
      premio_liquido: item.premio_liquido ?? '',
      pct_comissao: item.pct_comissao ?? '',
      valor_repasse: item.valor_repasse ?? '',
      responsavel: item.responsavel || '',
      emissor: item.emissor || '',
      tipo,
    }))
  }

  const submit = async event => {
    event.preventDefault()
    await onSave(draft)
    setDraft({ ...NOVA_LINHA_PLANILHA, data_transmissao: new Date().toISOString().slice(0, 10) })
  }

  const valorComissao = calcularValorComissaoAuto(draft.premio_liquido, draft.pct_comissao)

  return (
    <div className="auto-sheet-wrap">
      <table className="auto-sheet auto-sheet-emissions">
        <thead><tr>
          <th>Transmissão</th><th>Vigência</th><th>Segurado</th><th>Veículo</th><th>Parcelas</th><th>Seguradora</th>
          <th>Prêmio líquido</th><th>% comissão</th><th>Valor comissão</th><th>Repasse</th><th>Corretor</th><th>O que é</th><th>Emissor</th><th>Status</th><th>Ação</th>
        </tr></thead>
        <tbody>
          <tr className="auto-sheet-new-row">
            <td><input form="nova-linha-emissao" type="date" value={draft.data_transmissao} onChange={e => set('data_transmissao', e.target.value)} /></td>
            <td><input form="nova-linha-emissao" type="date" value={draft.vigencia_inicio} onChange={e => set('vigencia_inicio', e.target.value)} /></td>
            <td className="auto-sheet-suggestion-cell">
              <input form="nova-linha-emissao" value={draft.nome_cliente} onChange={e => setDraft(current => ({ ...current, nome_cliente: e.target.value, emissao_id: '', cotacao_id: '' }))} placeholder="Digite ou busque cotação" />
              {sugestoes.length > 0 && <div className="auto-sheet-suggestions">{sugestoes.map(item => {
                const tipo = item.cotacoes_auto?.tipo || item.tipo || 'novo'
                return <button type="button" key={item.id} onClick={() => selecionar(item)}><strong>{nomeEmissao(item)}</strong><small>{AUTO_TIPO_META[tipo]?.label || 'Seguro novo'} · {formatDateBR(item.created_at?.slice(0, 10))}</small></button>
              })}</div>}
            </td>
            <td><input form="nova-linha-emissao" value={draft.modelo_veiculo} onChange={e => set('modelo_veiculo', e.target.value)} placeholder="Veículo / placa" /></td>
            <td><input form="nova-linha-emissao" value={draft.parcelamento} onChange={e => set('parcelamento', e.target.value)} placeholder="Ex. 10x" /></td>
            <td><input form="nova-linha-emissao" value={draft.seguradora} onChange={e => set('seguradora', e.target.value)} /></td>
            <td><input form="nova-linha-emissao" type="number" step="0.01" value={draft.premio_liquido} onChange={e => set('premio_liquido', e.target.value)} /></td>
            <td><input form="nova-linha-emissao" type="number" step="0.01" value={draft.pct_comissao} onChange={e => set('pct_comissao', e.target.value)} /></td>
            <td><span className="auto-sheet-calculated">{formatMoney(valorComissao)}</span></td>
            <td><input form="nova-linha-emissao" type="number" step="0.01" value={draft.valor_repasse} onChange={e => set('valor_repasse', e.target.value)} /></td>
            <td><input form="nova-linha-emissao" value={draft.responsavel} onChange={e => set('responsavel', e.target.value)} /></td>
            <td><select form="nova-linha-emissao" value={draft.tipo} onChange={e => set('tipo', e.target.value)}><option value="novo">NOVO</option><option value="renovacao">RENOVAÇÃO</option><option value="endosso">ENDOSSO</option></select></td>
            <td><input form="nova-linha-emissao" value={draft.emissor} onChange={e => set('emissor', e.target.value)} /></td>
            <td><select form="nova-linha-emissao" value={draft.coluna} onChange={e => set('coluna', e.target.value)}>{COLUNAS.map(coluna => <option key={coluna.id} value={coluna.id}>{coluna.label}</option>)}</select></td>
            <td><form id="nova-linha-emissao" onSubmit={submit}><button className="auto-sheet-save" disabled={saving || !draft.nome_cliente.trim()}>{saving ? 'Salvando…' : draft.emissao_id ? 'Vincular' : 'Adicionar'}</button></form></td>
          </tr>
          {items.map(item => {
            const tipo = item.cotacoes_auto?.tipo || item.tipo || 'novo'
            const meta = AUTO_TIPO_META[tipo] || AUTO_TIPO_META.novo
            return <tr key={item.id}>
              <td>{item.data_transmissao ? formatDateBR(item.data_transmissao) : formatDateBR(item.created_at?.slice(0, 10))}</td>
              <td>{item.vigencia_inicio ? formatDateBR(item.vigencia_inicio) : '—'}</td>
              <td><button className="auto-sheet-link" onClick={() => onOpen(item)}>{nomeEmissao(item)}</button></td>
              <td>{item.modelo_veiculo || item.cotacoes_auto?.modelo_veiculo || '—'}</td><td>{item.parcelamento || '—'}</td><td>{seguradoraEmissao(item)}</td>
              <td>{formatMoney(item.premio_liquido)}</td><td>{item.pct_comissao ?? '—'}{item.pct_comissao != null ? '%' : ''}</td><td>{formatMoney(item.valor_comissao)}</td><td>{formatMoney(item.valor_repasse)}</td>
              <td>{item.responsavel || '—'}</td><td><span className={meta.className}>{meta.label}</span></td><td>{item.emissor || '—'}</td>
              <td><select value={getEmissaoColuna(item)} onChange={e => onMove(item, e.target.value)}>{COLUNAS.map(coluna => <option key={coluna.id} value={coluna.id}>{coluna.label}</option>)}</select></td>
              <td className="auto-sheet-actions"><button onClick={() => onEdit(item)}>Editar</button></td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Pagina principal ───────────────────────────────────────────────────

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  // Esta pagina responde por /auto/gestao (Pipeline), /auto/emissoes (Apolices)
  // e /auto/emissoes/:id (detalhe). Por isso a origem sai da rota, nunca escrita
  // fixa: quem abria uma cotacao pelo Pipeline voltava para Apolices.
  const origemAtual = useOrigemAtual()
  const voltar = useVoltar('/auto/emissoes')
  const location = useLocation()
  const { id: emissaoId } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const isGestaoRoute = location.pathname.startsWith('/auto/gestao')
  const [pipelineView, setPipelineView] = useState(() => {
    const queryView = new URLSearchParams(location.search).get('pipeline')
    if (['renovacoes', 'outros'].includes(queryView)) return queryView
    try {
      const saved = window.localStorage.getItem('conves:auto:pipeline-view')
      return ['renovacoes', 'outros'].includes(saved) ? saved : 'renovacoes'
    } catch {
      return 'renovacoes'
    }
  })
  const periodoInicial = isGestaoRoute ? 'todos' : 'mes'
  const initialRange = useMemo(() => getPeriodoRange(periodoInicial), [periodoInicial])

  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  // Preferencias do quadro (densidade e colunas recolhidas) sao lidas uma vez e
  // regravadas a cada mudanca: quem trabalha todo dia na Pipeline nao deve
  // remontar a propria tela a cada visita.
  const [preferenciasIniciais] = useState(() => lerPreferenciasPipeline())
  const [kanbanDensity, setKanbanDensity] = useState(() => {
    const salva = localStorage.getItem('auto-kanban-density') || preferenciasIniciais.densidade
    if (salva === 'compact' || salva === 'comfortable') return salva
    // Notebook de 1366/1440px nao cabe o card detalhado sem rolagem: o padrao
    // ali e a coluna compacta.
    return typeof window !== 'undefined' && window.innerWidth < 1440 ? 'compact' : 'comfortable'
  })
  const [colunasRecolhidas, setColunasRecolhidas] = useState(preferenciasIniciais.recolhidas)
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
  const [manualPdfStatus, setManualPdfStatus] = useState('idle')
  const [manualPdfResult, setManualPdfResult] = useState(null)
  const [manualPdfError, setManualPdfError] = useState('')
  const [manualPdfApplied, setManualPdfApplied] = useState(false)
  const manualFileRef = useRef(null)
  const [emissaoDocumento, setEmissaoDocumento] = useState(null)
  const [emissaoPdfStatus, setEmissaoPdfStatus] = useState('idle')
  const [emissaoPdfResult, setEmissaoPdfResult] = useState(null)
  const [emissaoPdfError, setEmissaoPdfError] = useState('')
  const [emissaoPdfApplied, setEmissaoPdfApplied] = useState(false)
  const emissaoFileRef = useRef(null)
  const importHistoricoFileRef = useRef(null)
  const kanbanScrollRef = useRef(null)
  const [kanbanNavigation, setKanbanNavigation] = useState({ index: 0, canLeft: false, canRight: true })
  const [form, setForm] = useState(FORM_EMISSAO_VAZIO)
  const [showApolices, setShowApolices] = useState(false)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [filtroInicio, setFiltroInicio] = useState(initialRange.inicio)
  const [filtroFim, setFiltroFim] = useState(initialRange.fim)
  const [mesRenovacoes, setMesRenovacoes] = useState(() => validMonthRef(new URLSearchParams(location.search).get('mes')))
  const [buscaPipeline, setBuscaPipeline] = useState('')
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

  const kanbanStages = pipelineView === 'renovacoes'
    ? AUTO_RENEWAL_PIPELINE_STAGES
    : AUTO_OTHER_PIPELINE_STAGES
  const colunasRecolhidasAtivas = colunasRecolhidas.filter(id => kanbanStages.some(stage => stage.id === id))

  useEffect(() => {
    try {
      window.localStorage.setItem('conves:auto:pipeline-view', pipelineView)
    } catch {
      // Preferencia opcional: a Pipeline continua funcional sem storage.
    }
    setDragging(null)
    setDragOver(null)
    setKanbanNavigation({ index: 0, canLeft: false, canRight: true })
    if (kanbanScrollRef.current) kanbanScrollRef.current.scrollLeft = 0
  }, [pipelineView])

  // A planilha de emissoes tambem permite classificar um card. Quando a etapa
  // escolhida exige registro, ela encaminha o item para esta tela e o mesmo
  // formulario da Pipeline abre automaticamente — sem existir um atalho que
  // apenas troque o status e deixe os dados obrigatorios para tras.
  useEffect(() => {
    const request = location.state?.autoEmissionRegistration
    if (!request?.item || !requiresAutoEmissionRegistration(request.stage)) return

    setManualStage(request.stage)
    setModalEmissao(request.item)

    const nextState = { ...(location.state || {}) }
    delete nextState.autoEmissionRegistration
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: nextState },
    )
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    localStorage.setItem('auto-kanban-density', kanbanDensity)
    gravarPreferenciasPipeline({ densidade: kanbanDensity, recolhidas: colunasRecolhidas })
  }, [kanbanDensity, colunasRecolhidas])

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes', isGestaoRoute ? 'pipeline' : periodo, isGestaoRoute ? '' : filtroInicio, isGestaoRoute ? '' : filtroFim],
    queryFn: () => getEmissoesAuto(isGestaoRoute
      ? {}
      : { inicio: filtroInicio || undefined, fim: filtroFim || undefined }),
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

  // Atualizacao otimista: o card precisa mudar de coluna no instante em que o
  // usuario solta o mouse. Esperar o round-trip fazia o card "voltar" por um
  // piscar e parecia que o arraste tinha falhado.
  const aplicarColunaLocalmente = useCallback((id, patch) => {
    qc.setQueriesData({ queryKey: ['auto-emissoes'] }, old =>
      Array.isArray(old) ? old.map(item => (item.id === id ? { ...item, ...patch } : item)) : old)
  }, [qc])

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onMutate: ({ id, coluna }) => aplicarColunaLocalmente(id, { coluna }),
    onError: error => toast({ type: 'error', title: 'Erro ao mover o card', message: error?.message || 'Tente novamente.' }),
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
      qc.invalidateQueries({ queryKey: ['auto-pendencias'] }),
    ]),
  })

  // Passagem para "Cotacoes feitas" sem perguntar nada (ver `moverCardPipeline`).
  const { mutate: marcarCotacaoFeita } = useMutation({
    mutationFn: ({ id, payload }) => salvarResultadoCotacao(id, payload),
    onMutate: ({ id, payload }) => aplicarColunaLocalmente(id, { coluna: 'cotacao_feita', resultado: payload.resultado }),
    onError: error => toast({ type: 'error', title: 'Erro ao mover para Cotações feitas', message: error?.message || 'Tente novamente.' }),
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
      qc.invalidateQueries({ queryKey: ['auto-pendencias'] }),
    ]),
  })

  // Arrastar renovacao NAO cria cotacao nem emissao: grava o status na propria
  // linha de `renovacoes_auto` e o card passa a ser desenhado na coluna que
  // aquele status aponta. Quem quer cotar de fato usa "Iniciar cotacao".
  const { mutate: moverRenovacao } = useMutation({
    mutationFn: ({ id, campos }) => atualizarStatusRenovacao(id, campos),
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: ['auto-renovacoes-pendentes'] })
      qc.setQueriesData({ queryKey: ['auto-renovacoes-pendentes'] }, old =>
        Array.isArray(old) ? old.map(item => (item.id === id ? { ...item, ...campos } : item)) : old)
    },
    onError: error => toast({ type: 'error', title: 'Erro ao mover a renovação', message: error?.message || 'Tente novamente.' }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] }),
  })

  // As colunas virtuais de renovacao usam uma carteira mensal explicita e
  // independente do periodo das emissoes. Somente itens sem calculo concluido
  // entram nesta consulta.
  const { data: renovacoesPendentes = [], isError: isErrorRenovacoesPendentes, error: errorRenovacoesPendentes } = useQuery({
    queryKey: ['auto-renovacoes-pendentes', mesRenovacoes],
    queryFn: () => getRenovacoesPendentesSemCotacao(mesRenovacoes),
  })

  const { mutateAsync: salvarLinhaPlanilha, isPending: salvandoLinhaPlanilha } = useMutation({
    mutationFn: salvarPropostaPlanilhaAuto,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-pendencias'] })
      toast({ type: 'success', title: 'Proposta transmitida', message: 'A linha e o Pipeline foram atualizados juntos.' })
    },
    onError: error => toast({ type: 'error', title: 'Erro ao salvar a linha', message: error?.message || 'Confira os campos informados.' }),
  })

  const termoPipeline = buscaPipeline.trim().toLocaleLowerCase('pt-BR')
  const matchesPipelineSearch = useCallback((item) => {
    if (!termoPipeline) return true
    const cotacao = item?.cotacoes_auto || item?.cotacao || {}
    const cliente = item?.clientes_auto || item?.cliente || cotacao?.clientes_auto || {}
    const apolice = getApoliceVinculada(item) || item?.apolices_auto || {}
    return [
      nomeEmissao(item),
      cpfEmissao(item),
      celularEmissao(item),
      item?.nome_cliente,
      item?.cpf_cliente,
      item?.modelo_veiculo,
      item?.placa,
      item?.numero_apolice,
      item?.responsavel,
      item?.seguradora,
      cotacao?.nome_cliente,
      cotacao?.cpf_cliente,
      cotacao?.modelo_veiculo,
      cotacao?.placa,
      cliente?.nome_completo,
      cliente?.cpf,
      apolice?.numero_apolice,
      apolice?.seguradora,
    ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(termoPipeline)
  }, [termoPipeline])

  const emissoesDoMesPipeline = useMemo(
    () => emissoes.filter(item => isAutoPipelineItemInMonth(item, mesRenovacoes)),
    [emissoes, mesRenovacoes],
  )
  const emissoesPipeline = useMemo(
    () => filterAutoPipelineEmissions(emissoesDoMesPipeline, pipelineView).filter(item => {
      if (!matchesPipelineSearch(item)) return false
      if (getEmissaoColuna(item) !== 'pendentes') return true
      const tipo = item.cotacoes_auto?.tipo || item.tipo
      return tipo === 'novo'
    }),
    [emissoesDoMesPipeline, matchesPipelineSearch, pipelineView],
  )
  const renovacoesPipeline = useMemo(
    () => pipelineView === 'renovacoes' ? renovacoesPendentes.filter(matchesPipelineSearch) : [],
    [renovacoesPendentes, matchesPipelineSearch, pipelineView],
  )
  // As renovacoes deixaram de morar so nas duas colunas de prazo: cada uma cai
  // na coluna que o proprio status aponta, do mesmo jeito que uma emissao.
  const renovacoesPorColuna = useMemo(() => {
    const mapa = new Map(kanbanStages.map(stage => [stage.id, []]))
    renovacoesPipeline.forEach(item => {
      const stage = resolveRenovacaoStage(item)
      if (!mapa.has(stage)) mapa.set(stage, [])
      mapa.get(stage).push(item)
    })
    return mapa
  }, [kanbanStages, renovacoesPipeline])

  const kanbanCounts = useMemo(() => {
    const counts = new Map(kanbanStages.map(stage => [stage.id, 0]))
    renovacoesPorColuna.forEach((items, stage) => {
      counts.set(stage, (counts.get(stage) || 0) + items.length)
    })
    emissoesPipeline.forEach(item => {
      const stage = getEmissaoColuna(item)
      counts.set(stage, (counts.get(stage) || 0) + 1)
    })
    return counts
  }, [emissoesPipeline, kanbanStages, renovacoesPorColuna])

  const pipelineViewCounts = useMemo(() => ({
    renovacoes: filterAutoPipelineEmissions(emissoesDoMesPipeline, 'renovacoes').filter(item => getEmissaoColuna(item) !== 'pendentes').length + renovacoesPendentes.length,
    outros: filterAutoPipelineEmissions(emissoesDoMesPipeline, 'outros').filter(item => {
      if (getEmissaoColuna(item) !== 'pendentes') return true
      return (item.cotacoes_auto?.tipo || item.tipo) === 'novo'
    }).length,
  }), [emissoesDoMesPipeline, renovacoesPendentes])

  const updateKanbanNavigation = useCallback(() => {
    const container = kanbanScrollRef.current
    if (!container) return
    const columns = Array.from(container.querySelectorAll('.auto-kanban-column'))
    if (!columns.length) return

    const firstOffset = columns[0].offsetLeft
    const currentLeft = container.scrollLeft
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    columns.forEach((column, index) => {
      const distance = Math.abs((column.offsetLeft - firstOffset) - currentLeft)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    const next = {
      index: nearestIndex,
      canLeft: currentLeft > 8,
      canRight: currentLeft < container.scrollWidth - container.clientWidth - 8,
    }
    setKanbanNavigation(previous => (
      previous.index === next.index && previous.canLeft === next.canLeft && previous.canRight === next.canRight
        ? previous
        : next
    ))
  }, [])

  const scrollToKanbanColumn = useCallback((requestedIndex) => {
    const container = kanbanScrollRef.current
    if (!container) return
    const columns = Array.from(container.querySelectorAll('.auto-kanban-column'))
    if (!columns.length) return
    const index = Math.max(0, Math.min(requestedIndex, columns.length - 1))
    const firstOffset = columns[0].offsetLeft
    container.scrollTo({ left: columns[index].offsetLeft - firstOffset, behavior: 'smooth' })
    setKanbanNavigation(previous => ({ ...previous, index }))
  }, [])

  const scrollKanbanByColumn = useCallback((direction) => {
    scrollToKanbanColumn(kanbanNavigation.index + direction)
  }, [kanbanNavigation.index, scrollToKanbanColumn])

  useEffect(() => {
    if (!isGestaoRoute) return undefined
    const container = kanbanScrollRef.current
    if (!container) return undefined
    const handleChange = () => updateKanbanNavigation()
    const frame = window.requestAnimationFrame(handleChange)
    container.addEventListener('scroll', handleChange, { passive: true })
    window.addEventListener('resize', handleChange, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      container.removeEventListener('scroll', handleChange)
      window.removeEventListener('resize', handleChange)
    }
  }, [isGestaoRoute, kanbanDensity, emissoes.length, renovacoesPendentes.length, updateKanbanNavigation])

  const [iniciandoCotacaoId, setIniciandoCotacaoId] = useState(null)

  const { mutateAsync: iniciarCotacaoRenovacaoAsync } = useMutation({
    mutationFn: renovacaoId => iniciarCotacaoRenovacao(renovacaoId),
    onSuccess: async ({ cotacaoId }) => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      navigate(`/auto/cotacoes/${cotacaoId}`)
    },
    onSettled: () => setIniciandoCotacaoId(null),
  })

  const handleIniciarCotacaoRenovacao = async renovacaoId => {
    if (iniciandoCotacaoId) return
    setIniciandoCotacaoId(renovacaoId)
    try {
      await iniciarCotacaoRenovacaoAsync(renovacaoId)
    } catch (err) {
      toast({ type: 'error', title: 'Erro ao iniciar cotação de renovação', message: err?.message || 'Tente novamente.' })
    }
  }

  const { mutateAsync: cancelarRenovacaoAsync, isPending: cancelandoRenovacao } = useMutation({
    mutationFn: ({ id, motivo }) => cancelarRenovacao(id, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] }),
    onError: err => toast({ type: 'error', title: 'Erro ao cancelar renovação', message: err?.message || 'Tente novamente.' }),
  })

  function handleCancelarRenovacaoPendente(id) {
    const motivo = window.prompt('Motivo do cancelamento (opcional):')
    if (motivo === null) return
    cancelarRenovacaoAsync({ id, motivo: motivo || null })
  }

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
      // A coluna virtual "Renovacoes" vem de uma query propria: sem invalidar
      // aqui, o card excluido continuava visivel ate o proximo reload.
      qc.invalidateQueries({ queryKey: ['auto-renovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-cotacoes-todas'] })
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
  // Tipo real da emissao aberta no modal (vem da cotacao quando existe).
  // Endosso nao passa por cotacao com seguradoras aprovadas, entao o campo
  // Seguradora fica livre para digitacao nesse caso.
  const tipoEmissaoModal = modalEmissao?.cotacoes_auto?.tipo || modalEmissao?.tipo || 'novo'
  const modalRegistraProposta = isProposalTransmissionStage(form.coluna)

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
        next.renovacao_comissao_ano_atual = next.renovacao_comissao_ano_atual || calcularValorComissaoAuto(toNumber(next.premio_liquido) || 0, toNumber(next.pct_comissao) || 0)
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
        next.renovacao_comissao_ano_atual = next.renovacao_comissao_ano_atual || calcularValorComissaoAuto(toNumber(next.premio_liquido) || 0, toNumber(next.pct_comissao) || 0)
      }
      return next
    })
  }

  async function handleEmissaoPdf(file) {
    setEmissaoDocumento(file)
    setEmissaoPdfResult(null)
    setEmissaoPdfError('')
    setEmissaoPdfApplied(false)
    if (!file) {
      setEmissaoPdfStatus('idle')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setEmissaoPdfStatus('attached')
      return
    }
    setEmissaoPdfStatus('reading')
    try {
      setEmissaoPdfResult(await parsePropostaAuto(file))
      setEmissaoPdfStatus('ready')
    } catch (error) {
      setEmissaoPdfError(error?.message || 'O conteúdo do documento não pôde ser extraído.')
      setEmissaoPdfStatus('error')
    }
  }

  async function handleManualPdf(file) {
    setManualDocumento(file)
    setManualPdfResult(null)
    setManualPdfError('')
    setManualPdfApplied(false)
    if (!file) {
      setManualPdfStatus('idle')
      return
    }
    const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setManualPdfStatus('attached')
      return
    }
    setManualPdfStatus('reading')
    try {
      setManualPdfResult(await parsePropostaAuto(file))
      setManualPdfStatus('ready')
    } catch (error) {
      setManualPdfError(error?.message || 'O conteúdo do documento não pôde ser extraído.')
      setManualPdfStatus('error')
    }
  }

  function applyPdfFields(result, setter, emptyForm, setApplied) {
    if (!result?.campos) return
    setter(current => Object.entries(result.campos).reduce((next, [field, value]) => {
      if (Object.prototype.hasOwnProperty.call(emptyForm, field) && value !== null && value !== '') next[field] = value
      return next
    }, { ...current }))
    setApplied(true)
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
  function handleMesRenovacoesChange(value) {
    const next = validMonthRef(value)
    setMesRenovacoes(next)
    const params = new URLSearchParams(location.search)
    params.set('mes', next)
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })
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

  /**
   * Move um card de etapa — por arraste ou pelos botoes de avancar/voltar.
   *
   * "Cotacoes feitas" NAO abre mais formulario. O que ele pedia (resultado e
   * seguradoras cotadas) ja e preenchido dentro do proprio card, no detalhe.
   * O que a coluna precisa e apenas de um `resultado` gravado: sem ele
   * `resolveAutoEmissionStage` devolve `pendentes` e o card volta sozinho para
   * a coluna anterior. `cotada` e o resultado NEUTRO aceito pela migration 64
   * exatamente para isso — nao afirma aprovacao nem recusa, so registra que a
   * cotacao foi feita. Um resultado ja existente (aprovada/recusada) e
   * preservado, e as seguradoras cotadas nunca sao zeradas pela movimentacao.
   *
   * "Aguardando vistoria", "Proposta transmitida" e "Apolice emitida" abrem
   * o formulario. Vistoria ja significa que a proposta foi transmitida e, por
   * isso, coleta os mesmos dados operacionais e financeiros da proposta. A
   * apolice emitida ainda exige os dados e o documento finais.
   */
  function moverCardPipeline(item, colunaDestino) {
    if (!item || !colunaDestino) return
    if (getEmissaoColuna(item) === colunaDestino) return

    if (requiresAutoEmissionRegistration(colunaDestino)) {
      setManualStage(colunaDestino)
      setModalEmissao(item)
      return
    }
    if (colunaDestino === 'cotacao_feita') {
      marcarCotacaoFeita({
        id: item.id,
        payload: {
          resultado: item.resultado || 'cotada',
          seguradoras_cotadas: Array.isArray(item.seguradoras_cotadas) ? item.seguradoras_cotadas : [],
        },
      })
      return
    }
    mover({ id: item.id, coluna: colunaDestino === 'pendentes' ? null : colunaDestino })
  }

  function alternarColuna(id) {
    setColunasRecolhidas(atual => alternarColunaRecolhida(atual, id, kanbanStages.length))
  }

  /**
   * Move a renovacao entre colunas gravando somente o status dela.
   *
   * `renovacaoStageFields` traduz a coluna para os tres campos de
   * `renovacoes_auto`; soltar na coluna onde ela ja esta nao grava nada.
   */
  function moverRenovacaoPipeline(item, colunaDestino) {
    if (!item || !colunaDestino) return
    if (resolveRenovacaoStage(item) === colunaDestino) return
    const campos = renovacaoStageFields(colunaDestino)
    if (!campos) return
    moverRenovacao({ id: item.id, campos })
  }

  // O quadro tem dois tipos de card e cada um grava numa tabela diferente, por
  // isso o que esta sendo arrastado carrega o proprio tipo.
  function handleDrop(colunaDestino) {
    if (!dragging) return
    if (dragging.tipo === 'renovacao') moverRenovacaoPipeline(dragging.item, colunaDestino)
    else moverCardPipeline(dragging.item, colunaDestino)
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
        valor_comissao: calcularValorComissaoAuto(toNumber(seg.premio_liquido) || 0, toNumber(seg.pct_comissao) || 0),
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
    navigate(`/auto/cotacoes/${cotacaoId}`, { state: { from: origemAtual } })
  }

  useEffect(() => {
    if (!modalEmissao) {
      setForm(FORM_EMISSAO_VAZIO)
      setEmissaoDocumento(null)
      setEmissaoPdfStatus('idle')
      setEmissaoPdfResult(null)
      setEmissaoPdfError('')
      setEmissaoPdfApplied(false)
      return
    }
    setForm({ ...getFormEmissaoInicial(modalEmissao), coluna: manualStage })
  }, [modalEmissao])

  useEffect(() => {
    if (manualOpen) return
    setManualPdfStatus('idle')
    setManualPdfResult(null)
    setManualPdfError('')
    setManualPdfApplied(false)
  }, [manualOpen])

  const premioLiquido = toNumber(form.premio_liquido) || 0
  const pctComissao = toNumber(form.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
  const valorRepasseDireto = toNumber(form.valor_repasse) || 0
  const valorRepasse = form.tem_repasse
    ? (valorRepasseDireto || valorComissao * (toNumber(form.pct_repasse) || 0))
    : 0

  useEffect(() => {
    if (!form.vigencia_inicio) return
    const calculado = somarUmAno(form.vigencia_inicio)
    if (calculado && form.vigencia_fim !== calculado && !form._vigenciaFimEditadaManualmente) {
      setForm(current => ({ ...current, vigencia_fim: calculado }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vigencia_inicio])

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
      cotacao_id: modalEmissao.cotacao_id || null,
      cliente_id: modalEmissao.cliente_id,
      tipo: modalEmissao.cotacoes_auto?.tipo || modalEmissao.tipo || 'novo',
      data_emissao: form.data_emissao || null,
      data_transmissao: form.data_transmissao || null,
      emissor: form.emissor || null,
      nome_cliente: form.nome_cliente || modalEmissao.cotacoes_auto?.nome_cliente || modalEmissao.nome_cliente || null,
      cpf_cliente: form.cpf_cliente || modalEmissao.cotacoes_auto?.cpf_cliente || modalEmissao.cpf_cliente || null,
      celular_cliente: form.celular_cliente || modalEmissao.cotacoes_auto?.celular_cliente || modalEmissao.celular_cliente || null,
      condutor_nome: form.condutor_nome || modalEmissao.cotacoes_auto?.condutor_nome || modalEmissao.condutor_nome || null,
      condutor_cpf: form.condutor_cpf || modalEmissao.cotacoes_auto?.condutor_cpf || modalEmissao.condutor_cpf || null,
      modelo_veiculo: form.modelo_veiculo || modalEmissao.cotacoes_auto?.modelo_veiculo || modalEmissao.modelo_veiculo || null,
      placa: form.placa || modalEmissao.cotacoes_auto?.placa || modalEmissao.placa || null,
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
      data_emissao: manualForm.data_emissao || null,
      data_transmissao: manualForm.data_transmissao || null,
      emissor: manualForm.emissor || null,
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
          ? buildRenovacaoComparativo(manualForm, toNumber(manualForm.premio_liquido) || 0, calcularValorComissaoAuto(toNumber(manualForm.premio_liquido) || 0, toNumber(manualForm.pct_comissao) || 0))
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
    emissoes.forEach(item => { const resp = item.responsavel || getApoliceVinculada(item)?.responsavel; if (resp) nomes.add(resp) })
    return Array.from(nomes).sort()
  }, [emissoes])

  const emissoesFiltradas = useMemo(() => {
    const termo = buscaEmissoes.trim().toLowerCase()
    return emissoes.filter(item => {
      if (filtroSeguradoraEmissoes !== 'todas' && seguradoraEmissao(item) !== filtroSeguradoraEmissoes) return false
      const tipoItem = item.cotacoes_auto?.tipo || item.tipo
      if (filtroTipoEmissoes !== 'todos' && tipoItem !== filtroTipoEmissoes) return false
      if (filtroStatusEmissoes !== 'todos' && getEmissaoColuna(item) !== filtroStatusEmissoes) return false
      if (filtroResponsavelEmissoes !== 'todos' && (item.responsavel || getApoliceVinculada(item)?.responsavel || '') !== filtroResponsavelEmissoes) return false
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
          <button onClick={voltar} className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <EmptyState title="Emissão não encontrada" description="O registro pode ter sido removido." />
        </div>
      )
    }
    return (
      <div className="auto-page space-y-4 px-1 pb-8 animate-fade-in">
        <button onClick={voltar} className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <ModalDetalhe page emissao={emissaoDetalhada} onClose={voltar}
          onAbrirCotacao={() => abrirCotacaoCompleta(emissaoDetalhada)} onRegistrarResultado={setModalResultado}
          onEmitirApolice={setModalEmissao} onEditar={abrirEditor} onExcluir={handleExcluir} isDeleting={isDeleting}
          tagsAtivas={tagsAtivas} onSalvarTags={(id, tags) => salvarTagsEmissao({ id, tags })} />
      </div>
    )
  }

  return (
    <div className={`auto-page space-y-6 animate-fade-in ${isGestaoRoute ? 'auto-pipeline-page' : ''}`}>
      {!isGestaoRoute && (
      <PageHeader
        eyebrow="Modulo auto"
        title={isGestaoRoute
          ? (pipelineView === 'renovacoes' ? 'Pipeline de renovações' : 'Pipeline de novos seguros e endossos')
          : 'Apólices e emissões'}
        description={isGestaoRoute
          ? (pipelineView === 'renovacoes'
            ? 'Organize a carteira do vencimento à emissão, sem misturar o trabalho com seguros novos.'
            : 'Acompanhe cotações novas e endossos até a apólice, em uma mesa exclusiva.')
          : 'Consulte emissões recentes, documentos e toda a carteira de apólices Auto.'}
        className={isGestaoRoute ? 'auto-pipeline-page-header' : ''}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(isGestaoRoute ? '/auto/emissoes' : '/auto/gestao')}
              className="btn-secondary"
            >
              {isGestaoRoute ? 'Ver apólices e emissões' : 'Abrir Pipeline'}
            </button>
            {!isGestaoRoute && (
              <button onClick={() => navigate('/auto/emissoes/planilha?subir=1')} className="btn-secondary inline-flex items-center gap-2">
                <Upload className="h-4 w-4" /> Subir apólices
              </button>
            )}
            <input
              ref={importHistoricoFileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportHistorico}
              className="hidden"
            />
            {(!isGestaoRoute || pipelineView === 'renovacoes') && (
              <button onClick={() => importHistoricoFileRef.current?.click()} disabled={isImportingHistorico} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50">
                {isImportingHistorico ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                Importar histórico
              </button>
            )}
            {isGestaoRoute && pipelineView === 'renovacoes' && (
              <button onClick={() => navigate(`/auto/renovacoes/planilha?mes=${mesRenovacoes}`)} className="btn-secondary">
                Abrir planilha
              </button>
            )}
            <button onClick={() => navigate('/auto/cotacoes')} className="btn-primary">
              Nova cotação
            </button>
            {(!isGestaoRoute || pipelineView === 'outros') && (
              <button onClick={() => { const today = new Date().toISOString().slice(0, 10); setManualMode('novo'); setManualForm({ ...FORM_MANUAL_VAZIO, data_emissao: today, data_transmissao: today }); setManualDocumento(null); setManualOpen(true) }} className="btn-primary">
                Nova emissão
              </button>
            )}
            {!isGestaoRoute && <button onClick={() => setShowApolices(true)} className="btn-secondary">Consultar apólices emitidas</button>}
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
          <section className="auto-pipeline-view-switch" aria-label="Escolher pipeline operacional">
            <div className="auto-pipeline-view-switch-copy">
              <span>Mesas de trabalho</span>
              <strong>Escolha o fluxo que deseja operar agora</strong>
              <small>Cada negócio aparece em uma única pipeline, com contadores e etapas independentes.</small>
            </div>
            <div className="auto-pipeline-view-options" role="tablist" aria-label="Pipelines do setor Auto">
              {PIPELINE_VIEWS.map(option => {
                const Icon = option.icon
                const active = pipelineView === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? 'is-active' : ''}
                    onClick={() => setPipelineView(option.id)}
                  >
                    <span><Icon /></span>
                    <div><strong>{option.label}</strong><small>{option.description}</small></div>
                    <b>{pipelineViewCounts[option.id]}</b>
                  </button>
                )
              })}
            </div>
            <div className="auto-pipeline-quick-actions">
              <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Apólices</button>
              {pipelineView === 'renovacoes' && (
                <>
                  <input ref={importHistoricoFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportHistorico} className="hidden" />
                  <button onClick={() => importHistoricoFileRef.current?.click()} disabled={isImportingHistorico} className="btn-secondary disabled:opacity-50">
                    {isImportingHistorico ? 'Importando…' : 'Importar histórico'}
                  </button>
                  <button onClick={() => navigate(`/auto/renovacoes/planilha?mes=${mesRenovacoes}`)} className="btn-secondary">Planilha</button>
                </>
              )}
              <button onClick={() => navigate('/auto/cotacoes')} className="btn-primary">Nova cotação</button>
              {pipelineView === 'outros' && (
                <button onClick={() => { const today = new Date().toISOString().slice(0, 10); setManualMode('novo'); setManualForm({ ...FORM_MANUAL_VAZIO, data_emissao: today, data_transmissao: today }); setManualDocumento(null); setManualOpen(true) }} className="btn-primary">Nova emissão</button>
              )}
            </div>
          </section>

          <FilterBar>
            <div className="auto-pipeline-context-filter">
              <label className="renewal-month-picker">
                <CalendarDays />
                <span>Mês da pipeline</span>
                <input type="month" value={mesRenovacoes} onChange={event => handleMesRenovacoesChange(event.target.value)} />
              </label>
              <div className="auto-pipeline-filter-note">
                {pipelineView === 'renovacoes' ? <RefreshCw /> : <Car />}
                <span>
                  <strong>Operação de {pipelineMonthLabel(mesRenovacoes)}</strong>
                  <small>Somente cotações, propostas e apólices desta competência aparecem no quadro.</small>
                </span>
              </div>
            </div>
          </FilterBar>

          <section className="auto-pipeline-command" aria-label="Navegação da Pipeline AUTO">
            <div className="auto-pipeline-command-main">
              <div className="auto-pipeline-command-copy">
                <span className="auto-pipeline-command-icon">{pipelineView === 'renovacoes' ? <RefreshCw /> : <Car />}</span>
                <div>
                  <strong>{pipelineView === 'renovacoes' ? 'Jornada das renovações' : 'Jornada de novos seguros e endossos'}</strong>
                  <small>Use a busca, as setas ou clique numa etapa para trabalhar sem rolagem manual.</small>
                </div>
              </div>
              <div className="auto-pipeline-command-actions">
                <label className="auto-pipeline-search">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={buscaPipeline}
                    onChange={event => setBuscaPipeline(event.target.value)}
                    placeholder="Cliente, CPF, placa, seguradora..."
                    aria-label="Pesquisar em toda a Pipeline"
                  />
                  {buscaPipeline && (
                    <button type="button" onClick={() => setBuscaPipeline('')} aria-label="Limpar pesquisa">
                      <X aria-hidden="true" />
                    </button>
                  )}
                </label>
                <div className="auto-density-row" role="group" aria-label="Densidade dos cards do Pipeline">
                  <span>Visualização</span>
                  <div>
                    <button type="button" className={kanbanDensity === 'comfortable' ? 'is-active' : ''} onClick={() => setKanbanDensity('comfortable')}>Detalhada</button>
                    <button type="button" className={kanbanDensity === 'compact' ? 'is-active' : ''} onClick={() => setKanbanDensity('compact')}>Compacta</button>
                  </div>
                </div>
                {colunasRecolhidasAtivas.length > 0 && (
                  <button
                    type="button"
                    className="auto-pipeline-expand-all"
                    onClick={() => setColunasRecolhidas([])}
                    title="Reabrir todas as colunas recolhidas"
                  >
                    <ChevronsRight aria-hidden="true" />
                    Expandir {colunasRecolhidasAtivas.length} coluna(s)
                  </button>
                )}
                <div className="auto-pipeline-arrow-group">
                  <button type="button" onClick={() => scrollKanbanByColumn(-1)} disabled={!kanbanNavigation.canLeft} aria-label="Ver coluna anterior" title="Coluna anterior"><ChevronLeft /></button>
                  <span><strong>{kanbanNavigation.index + 1}</strong> de {kanbanStages.length}</span>
                  <button type="button" onClick={() => scrollKanbanByColumn(1)} disabled={!kanbanNavigation.canRight} aria-label="Ver próxima coluna" title="Próxima coluna"><ChevronRight /></button>
                </div>
              </div>
            </div>
            {termoPipeline && (
              <div className="auto-pipeline-search-summary" role="status">
                <Search aria-hidden="true" />
                <span>
                  <strong>{emissoesPipeline.length + renovacoesPipeline.length}</strong> resultado(s) para “{buscaPipeline.trim()}” em todas as etapas
                </span>
                <button type="button" onClick={() => setBuscaPipeline('')}>Mostrar tudo</button>
              </div>
            )}
            <div className="auto-pipeline-stage-track" style={{ '--pipeline-columns': kanbanStages.length }}>
              {kanbanStages.map((stage, index) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => {
                    // Clicar numa etapa recolhida abre a coluna antes de rolar:
                    // rolar ate um trilho fechado nao mostra nada.
                    if (colunasRecolhidas.includes(stage.id)) alternarColuna(stage.id)
                    scrollToKanbanColumn(index)
                  }}
                  className={[
                    kanbanNavigation.index === index ? 'is-active' : '',
                    colunasRecolhidas.includes(stage.id) ? 'is-collapsed' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ '--stage-color': stage.color }}
                  aria-current={kanbanNavigation.index === index ? 'step' : undefined}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{stage.shortLabel}</strong>
                  <small>{kanbanCounts.get(stage.id) || 0}</small>
                </button>
              ))}
            </div>
          </section>

          <div className="auto-kanban-shell">
            <button type="button" onClick={() => scrollKanbanByColumn(-1)} disabled={!kanbanNavigation.canLeft} className="auto-kanban-edge-nav is-left" aria-label="Voltar uma coluna"><ChevronLeft /></button>
            <div
              ref={kanbanScrollRef}
              tabIndex="0"
              onKeyDown={event => {
                if (event.key === 'ArrowLeft') { event.preventDefault(); scrollKanbanByColumn(-1) }
                if (event.key === 'ArrowRight') { event.preventDefault(); scrollKanbanByColumn(1) }
              }}
              className={`auto-kanban-board is-${kanbanDensity} relative -mx-1 flex gap-4 overflow-x-auto pb-3 pt-1 px-1 snap-x snap-mandatory md:snap-proximity`}
              aria-label="Quadro da Pipeline AUTO. Use as setas do teclado para mudar de coluna."
            >
            {pipelineView === 'renovacoes' && [
              { id: 'renovacoes', empty: 'Sem renovações futuras' },
              { id: 'renovacoes_para_enviar', empty: 'Nada atrasado para enviar' },
            ].map(({ id, empty }) => {
              const items = renovacoesPorColuna.get(id) || []
              const stage = kanbanStages.find(item => item.id === id)
              const stageIndex = kanbanStages.findIndex(item => item.id === id)
              return (
                <DataCard
                  key={id}
                  title={<span className="auto-kanban-column-title"><span>{String(stageIndex + 1).padStart(2, '0')}</span>{stage.label}</span>}
                  subtitle={`${items.length} item(ns) sem cálculo · ${pipelineMonthLabel(mesRenovacoes)}`}
                  className={`auto-kanban-column auto-kanban-column-renewals w-[300px] shrink-0 snap-start ${id === 'renovacoes_para_enviar' ? 'is-urgent' : ''} ${dragOver === id ? 'ring-2 ring-brand-accent/20' : ''}`}
                  bodyClassName="pt-3"
                >
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(id) }}
                    onDrop={() => handleDrop(id)}
                    onDragLeave={() => setDragOver(null)}
                    className="auto-kanban-dropzone min-h-[72vh] space-y-2"
                  >
                    {isErrorRenovacoesPendentes ? (
                      <EmptyState icon={<XCircle className="w-6 h-6" />} title="Erro ao carregar renovações" description={errorRenovacoesPendentes?.message || 'Tente recarregar a página.'} className="py-8" />
                    ) : items.length === 0 ? (
                      <EmptyState
                        icon={<RefreshCw className="w-6 h-6" />}
                        title={termoPipeline ? 'Nenhuma renovação encontrada' : empty}
                        description={termoPipeline ? 'A busca continua ativa nas outras etapas.' : (id === 'renovacoes' ? `Aqui ficam somente as renovações de ${pipelineMonthLabel(mesRenovacoes)} ainda sem cálculo e com envio futuro.` : `Aqui aparecem as renovações de ${pipelineMonthLabel(mesRenovacoes)} ainda sem cálculo, com limite hoje ou vencido.`)}
                        className="py-8"
                      />
                    ) : items.map(item => (
                      <CardRenovacaoPendente
                        key={item.id}
                        renovacao={item}
                        onDragStart={arrastada => setDragging({ tipo: 'renovacao', item: arrastada })}
                        onMover={moverRenovacaoPipeline}
                        onIniciarCotacao={handleIniciarCotacaoRenovacao}
                        onCancelar={handleCancelarRenovacaoPendente}
                        iniciando={iniciandoCotacaoId === item.id}
                        cancelando={cancelandoRenovacao}
                      />
                    ))}
                  </div>
                </DataCard>
              )
            })}
            {COLUNAS.filter(coluna => pipelineView !== 'renovacoes' || coluna.id !== 'pendentes').map(coluna => {
              const cards = emissoesPipeline.filter(item => getEmissaoColuna(item) === coluna.id)
              // Renovacoes arrastadas para esta etapa. Elas nao entram em
              // `cards` porque continuam sendo linhas de `renovacoes_auto` e
              // nao alimentam o resumo financeiro da coluna.
              const renovacoesNaColuna = pipelineView === 'renovacoes' ? (renovacoesPorColuna.get(coluna.id) || []) : []
              const totalCards = cards.length + renovacoesNaColuna.length
              const posicao = String(kanbanStages.findIndex(stage => stage.id === coluna.id) + 1).padStart(2, '0')
              const recolhida = colunasRecolhidas.includes(coluna.id)
              const resumo = resumoFinanceiroEtapa(cards, item => {
                const apolice = getApoliceVinculada(item)
                return {
                  premio: apolice?.premio_liquido ?? item.premio_liquido,
                  comissao: apolice?.valor_comissao ?? item.valor_comissao,
                }
              })

              // Coluna recolhida vira um trilho estreito que continua aceitando
              // drop: quem escondeu "Aguardando vistoria" para ganhar espaco
              // ainda precisa conseguir jogar um card la dentro.
              if (recolhida) {
                return (
                  <div
                    key={coluna.id}
                    className={`auto-kanban-rail auto-column-tone-${coluna.tone} ${dragOver === coluna.id ? 'is-drop-target' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(coluna.id) }}
                    onDrop={() => handleDrop(coluna.id)}
                    onDragLeave={() => setDragOver(null)}
                  >
                    <button
                      type="button"
                      onClick={() => alternarColuna(coluna.id)}
                      title={`Expandir ${coluna.label}`}
                      aria-label={`Expandir a coluna ${coluna.label} (${totalCards} itens)`}
                    >
                      <span className="auto-kanban-rail-index">{posicao}</span>
                      <span className="auto-kanban-rail-label">{coluna.label}</span>
                      <span className="auto-kanban-rail-count">{totalCards}</span>
                      <ChevronsRight aria-hidden="true" />
                    </button>
                  </div>
                )
              }

              return (
                <DataCard
                  key={coluna.id}
                  title={(
                    <span className="auto-kanban-column-title">
                      <span>{posicao}</span>
                      {coluna.label}
                      <button
                        type="button"
                        className="auto-kanban-column-collapse"
                        onClick={() => alternarColuna(coluna.id)}
                        title={`Recolher ${coluna.label}`}
                        aria-label={`Recolher a coluna ${coluna.label}`}
                      >
                        <ChevronsLeft aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  subtitle={(
                    <span className="auto-kanban-column-summary">
                      <b>{totalCards}</b> item(ns)
                      {renovacoesNaColuna.length > 0 && <em>{renovacoesNaColuna.length} renovação(ões)</em>}
                      {resumo.premio > 0 && <em>{formatMoney(resumo.premio)} em prêmio</em>}
                    </span>
                  )}
                  className={`auto-kanban-column auto-column-tone-${coluna.tone} w-[300px] shrink-0 snap-start ${dragOver === coluna.id ? 'ring-2 ring-brand-accent/20' : ''}`}
                  bodyClassName="pt-3"
                >
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(coluna.id) }}
                    onDrop={() => handleDrop(coluna.id)}
                    onDragLeave={() => setDragOver(null)}
                    className="auto-kanban-dropzone min-h-[72vh] space-y-2"
                  >
                    {renovacoesNaColuna.map(item => (
                      <CardRenovacaoPendente
                        key={`renovacao-${item.id}`}
                        renovacao={item}
                        onDragStart={arrastada => setDragging({ tipo: 'renovacao', item: arrastada })}
                        onMover={moverRenovacaoPipeline}
                        onIniciarCotacao={handleIniciarCotacaoRenovacao}
                        onCancelar={handleCancelarRenovacaoPendente}
                        iniciando={iniciandoCotacaoId === item.id}
                        cancelando={cancelandoRenovacao}
                      />
                    ))}
                    {totalCards === 0 ? (
                      <EmptyState
                        icon={<Car className="w-6 h-6" />}
                        title={termoPipeline ? 'Nenhum resultado nesta etapa' : (coluna.id === 'pendentes' ? 'Sem pendências' : 'Coluna vazia')}
                        description={termoPipeline
                          ? 'O filtro está sendo aplicado simultaneamente em todo o quadro.'
                          : (coluna.id === 'pendentes'
                            ? 'As cotações criadas pelo formulário aparecem aqui primeiro.'
                            : 'Arraste um card para avançar no fluxo.')}
                        className="py-8"
                      />
                    ) : (
                      cards.map(item => (
                        <CardEmissao
                          key={item.id}
                          emissao={item}
                          onDragStart={arrastado => setDragging({ tipo: 'emissao', item: arrastado })}
                          onClick={abrirDetalhe}
                          onMover={moverCardPipeline}
                          tagsPorId={tagsPorId}
                        />
                      ))
                    )}
                  </div>
                </DataCard>
              )
            })}
            </div>
            <button type="button" onClick={() => scrollKanbanByColumn(1)} disabled={!kanbanNavigation.canRight} className="auto-kanban-edge-nav is-right" aria-label="Avançar uma coluna"><ChevronRight /></button>
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
                    Aqui ficam a visao geral, os atalhos e a consulta das apolices emitidas. O kanban foi movido para a area dedicada de Pipeline Auto.
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
                Abrir Pipeline Auto
              </button>
              <button onClick={() => { const today = new Date().toISOString().slice(0, 10); setManualMode('novo'); setManualForm({ ...FORM_MANUAL_VAZIO, data_emissao: today, data_transmissao: today }); setManualDocumento(null); setManualOpen(true) }} className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text">
                Nova emissao
              </button>
              <button onClick={() => setShowApolices(true)} className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text">
                Consultar apolices emitidas
              </button>
            </div>
          </FilterBar>

          <DataCard className="overflow-hidden" bodyClassName="p-0">
            <div className="auto-emissions-launcher">
              <span><FileText /></span>
              <div>
                <small>Mesa de produção</small>
                <h2>Todas as emissões em uma planilha única</h2>
                <p>Abra a grade completa para filtrar, ordenar, editar qualquer campo, colar dados do Excel e acessar a apólice de cada cliente.</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/auto/emissoes/planilha')}>VER EMISSÕES <ArrowRight className="h-4 w-4" /></button>
            </div>
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

      {/* Modal: transmitir proposta, aguardar vistoria ou emitir apolice */}
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
                  <h2 className="mt-4 text-2xl font-semibold text-dark-text">
                    {modalRegistraProposta ? 'Registrar proposta' : 'Emitir apólice'}
                  </h2>
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
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
                      {modalRegistraProposta ? 'Dados da proposta' : 'Dados da apólice'}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-dark-text">
                      {modalRegistraProposta ? 'Registrar transmissão' : 'Preencher e confirmar emissão'}
                    </h3>
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
                    <div className="grid gap-2 md:grid-cols-3">
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
                        onClick={() => setForm(current => ({ ...current, coluna: 'aguardando_vistoria' }))}
                        className={
                          'rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ' +
                          (form.coluna === 'aguardando_vistoria'
                            ? 'border-status-warning bg-status-warning/10 text-status-warning'
                            : 'border-dark-border bg-dark-surface/70 text-dark-muted hover:border-status-warning/40 hover:text-dark-text')
                        }
                      >
                        Aguardando vistoria ou rastreador
                        <span className="mt-1 block text-[11px] font-normal text-dark-muted">Proposta transmitida, aguardando validação operacional.</span>
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
                      <div className="mt-4">
                        <AutoPdfAutomation
                          mode="proposta"
                          file={emissaoDocumento}
                          status={emissaoPdfStatus}
                          result={emissaoPdfResult}
                          error={emissaoPdfError}
                          applied={emissaoPdfApplied}
                          onFile={handleEmissaoPdf}
                          onApply={() => applyPdfFields(emissaoPdfResult, setForm, FORM_EMISSAO_VAZIO, setEmissaoPdfApplied)}
                          onClear={() => { setEmissaoDocumento(null); setEmissaoPdfStatus('idle'); setEmissaoPdfResult(null); setEmissaoPdfError(''); setEmissaoPdfApplied(false) }}
                          inputRef={emissaoFileRef}
                        />
                      </div>
                    )}
                  </div>
                  {modalRegistraProposta ? (
                    <PropostaTransmitidaFields
                      form={form}
                      onChange={setField}
                      valorComissao={valorComissao}
                      tipo={tipoEmissaoModal}
                    />
                  ) : (<>
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Data de emissão" campo="data_emissao" value={form.data_emissao} onChange={setField} type="date" />
                    {tipoEmissaoModal === 'endosso' ? (
                      <CampoTexto label="Seguradora" campo="seguradora" value={form.seguradora} onChange={setField} />
                    ) : (
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
                    )}
                    <CampoTexto label="Numero da apolice" campo="numero_apolice" value={form.numero_apolice} onChange={setField} />
                    <CampoTexto label="Vigencia inicio" campo="vigencia_inicio" value={form.vigencia_inicio} onChange={setField} type="date" />
                    <CampoTexto
                      label="Vigencia fim (automático, editável)"
                      campo="vigencia_fim"
                      value={form.vigencia_fim}
                      onChange={(campo, valor) => { setField(campo, valor); setField('_vigenciaFimEditadaManualmente', true) }}
                      type="date"
                    />
                    <CampoTexto label="Premio liquido" campo="premio_liquido" value={form.premio_liquido} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="% Comissao" campo="pct_comissao" value={form.pct_comissao} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento} onChange={setField} />
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Quantidade de parcelas</label>
                      <input
                        type="number"
                        min="1"
                        value={String(form.parcelamento || '').replace(/x$/i, '')}
                        onChange={e => setField('parcelamento', e.target.value ? `${e.target.value}x` : '')}
                        className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                        placeholder="Ex.: 12"
                      />
                    </div>
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Data de transmissão" campo="data_transmissao" type="date" value={form.data_transmissao} onChange={setField} />
                    <CampoTexto label="Emissor" campo="emissor" value={form.emissor} onChange={setField} placeholder="Quem transmitiu a proposta" />
                  </div>

                  <div className="grid gap-3 rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo (automático)</p>
                      <span className="badge badge-info">
                        {tipoEmissaoModal === 'renovacao' ? 'Renovação' : tipoEmissaoModal === 'endosso' ? 'Endosso' : 'Seguro novo'}
                      </span>
                    </div>
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
                  </>)}
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
                        {formatMoney(calcularValorComissaoAuto(toNumber(manualForm.premio_liquido) || 0, toNumber(manualForm.pct_comissao) || 0))}
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
                      <div className="mt-4">
                        <AutoPdfAutomation
                          mode="proposta"
                          file={manualDocumento}
                          status={manualPdfStatus}
                          result={manualPdfResult}
                          error={manualPdfError}
                          applied={manualPdfApplied}
                          onFile={handleManualPdf}
                          onApply={() => applyPdfFields(manualPdfResult, setManualForm, FORM_MANUAL_VAZIO, setManualPdfApplied)}
                          onClear={() => { setManualDocumento(null); setManualPdfStatus('idle'); setManualPdfResult(null); setManualPdfError(''); setManualPdfApplied(false) }}
                          inputRef={manualFileRef}
                        />
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
                    <CampoTexto label="Data de emissão" campo="data_emissao" value={manualForm.data_emissao} onChange={setManualField} type="date" />
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Data de transmissão" campo="data_transmissao" type="date" value={manualForm.data_transmissao} onChange={setManualField} />
                    <CampoTexto label="Emissor" campo="emissor" value={manualForm.emissor} onChange={setManualField} placeholder="Quem transmitiu a proposta" />
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
                          <p className="mt-2 text-sm font-semibold text-dark-text">{formatMoney(calcularValorComissaoAuto(toNumber(manualForm.premio_liquido) || 0, toNumber(manualForm.pct_comissao) || 0))}</p>
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
