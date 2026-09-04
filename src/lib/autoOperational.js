function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function monthLastDay(monthRef) {
  const match = String(monthRef || '').match(/^(\d{4})-(\d{2})$/)
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]), 0)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value, fallback = '') {
  const text = String(value || '').trim()
  if (!text) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/)
  if (!match) return fallback
  const fallbackYear = Number(fallback.slice(0, 4)) || new Date().getFullYear()
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : fallbackYear
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

export const AUTO_PIPELINE_STAGES = [
  { id: 'renovacoes', label: 'Renovações', shortLabel: 'Renovações', color: '#0ea5a4' },
  { id: 'renovacoes_para_enviar', label: 'Renovações para enviar hoje', shortLabel: 'Enviar hoje', color: '#f59e0b' },
  { id: 'pendentes', label: 'Cotações pendentes', shortLabel: 'Pendentes', color: '#f97316' },
  { id: 'cotacao_iniciada', label: 'Cotações iniciadas', shortLabel: 'Iniciadas', color: '#7c3aed' },
  { id: 'cotacao_feita', label: 'Cotações feitas', shortLabel: 'Feitas', color: '#3563e9' },
  { id: 'negociando', label: 'Negociando', shortLabel: 'Negociando', color: '#38bdf8' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria ou rastreador', shortLabel: 'Vistoria/rastreador', color: '#a855f7' },
  { id: 'proposta_transmitida', label: 'Proposta transmitida', shortLabel: 'Proposta', color: '#10b981' },
  { id: 'apolice_emitida', label: 'Apólice emitida', shortLabel: 'Emitida', color: '#0f766e' },
  { id: 'nao_renovou', label: 'Não renovou', shortLabel: 'Não renovou', color: '#dc2626' },
]

// Renovações e novos negócios usam os mesmos status persistidos, mas são duas
// mesas operacionais diferentes. Manter listas explícitas impede que cards e
// contadores dos dois fluxos voltem a se misturar na interface.
export const AUTO_RENEWAL_PIPELINE_STAGES = AUTO_PIPELINE_STAGES.filter(stage => stage.id !== 'pendentes')
export const AUTO_OTHER_PIPELINE_STAGES = AUTO_PIPELINE_STAGES.filter(stage => !['renovacoes', 'renovacoes_para_enviar', 'nao_renovou'].includes(stage.id))

export function isAutoRenewalEmission(item = {}) {
  const tipo = item?.cotacoes_auto?.tipo || item?.tipo
  return tipo === 'renovacao' || item?.eh_renovacao === true
}

export function filterAutoPipelineEmissions(items = [], view = 'outros') {
  const renewalView = view === 'renovacoes'
  return items.filter(item => isAutoRenewalEmission(item) === renewalView)
}

function firstRelated(value) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Data que define em qual competencia mensal o card aparece na Pipeline.
 *
 * - Renovacao acompanha a vigencia, mesmo que a cotacao tenha sido criada no
 *   mes anterior.
 * - Proposta/vistoria acompanha a transmissao.
 * - Apolice emitida acompanha a emissao (com transmissao como fallback).
 * - Cotacao ainda em trabalho acompanha a criacao da propria cotacao.
 */
export function getAutoPipelineReferenceDate(item = {}) {
  const cotacao = item.cotacoes_auto || item.cotacao || {}
  const apolice = firstRelated(item.apolices_auto) || {}
  const stage = resolveAutoEmissionStage(item)

  if (isAutoRenewalEmission(item)) {
    return item.vigencia_inicio || apolice.vigencia_inicio || cotacao.vigencia_inicio
      || item.data_transmissao || item.created_at || cotacao.created_at || ''
  }

  if (stage === 'apolice_emitida') {
    return apolice.data_emissao || item.data_emissao || item.data_transmissao
      || apolice.created_at || item.created_at || cotacao.created_at || ''
  }

  if (['aguardando_vistoria', 'proposta_transmitida'].includes(stage)) {
    return item.data_transmissao || apolice.data_emissao || item.updated_at
      || item.created_at || cotacao.created_at || ''
  }

  return cotacao.created_at || item.created_at || item.updated_at || ''
}

export function isAutoPipelineItemInMonth(item, monthRef) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthRef || ''))) return false
  const referenceDate = String(getAutoPipelineReferenceDate(item) || '')
  return referenceDate.slice(0, 7) === monthRef
}

export const AUTO_TIPO_META = {
  novo: { label: 'Seguro novo', className: 'auto-type-tag is-new' },
  renovacao: { label: 'Renovação', className: 'auto-type-tag is-renewal' },
  endosso: { label: 'Endosso', className: 'auto-type-tag is-endorsement' },
}

export function countAutoEmissionTypes(items = []) {
  return items.reduce((counts, item) => {
    const tipo = ['novo', 'renovacao', 'endosso'].includes(item?.tipo) ? item.tipo : 'novo'
    counts[tipo] += 1
    return counts
  }, { novo: 0, renovacao: 0, endosso: 0 })
}

export function resolveAutoEmissionStage(item = {}) {
  const policies = item?.apolices_auto
  const hasLinkedPolicy = Array.isArray(policies) ? policies.length > 0 : Boolean(policies)
  if (hasLinkedPolicy) return 'apolice_emitida'

  const raw = typeof item?.coluna === 'string' ? item.coluna.trim() : ''
  if (!raw || raw === 'pendente') {
    return item?.cotacoes_auto?.status === 'aberta' || item?.cotacao?.status === 'aberta'
      ? 'cotacao_iniciada'
      : 'pendentes'
  }
  if (raw === 'emitida') return 'apolice_emitida'
  if (raw === 'cotacao_feita' && !item?.resultado) return 'pendentes'
  return raw
}

export function classificarRenovacoesPipeline(items = [], today = new Date().toISOString().slice(0, 10)) {
  return items.reduce((groups, item) => {
    const limite = item?.data_limite_envio || item?.vigencia_fim || ''
    if (limite && limite <= today) groups.paraEnviar.push(item)
    else groups.futuras.push(item)
    return groups
  }, { futuras: [], paraEnviar: [] })
}

export function isRenovacaoSemCalculo(item = {}) {
  if (item.cotada_em) return false
  if (['renovada', 'nao_renovada'].includes(item.status_renovacao)) return false

  const operational = normalizeText(item.status_operacional).replace(/\s+/g, '_')
  if (['cotado', 'enviado', 'negociando', 'outra_corretora', 'renovado', 'cancelado'].includes(operational)) return false
  // Abrir a ficha de cotacao cria o vinculo e marca "cotando", mas o calculo
  // so existe de fato depois da confirmacao que preenche cotada_em.
  if (operational === 'cotando') return true

  const quoteStatus = normalizeText(item.status_cotacao).replace(/\s+/g, '_')
  return !quoteStatus || quoteStatus === 'nao_cotada'
}

export function renewalStatusFields(value) {
  switch (value) {
    case 'em_andamento': return { status_operacional: 'cotando', status_cotacao: 'cotada_nao_enviada', status_renovacao: 'pendente' }
    case 'cotada': return { status_operacional: 'cotado', status_cotacao: 'cotada_nao_enviada', status_renovacao: 'pendente' }
    case 'enviada': return { status_operacional: 'enviado', status_cotacao: 'cotada_enviada', status_renovacao: 'pendente' }
    case 'negociando': return { status_operacional: 'negociando', status_cotacao: 'cotada_enviada', status_renovacao: 'pendente' }
    case 'outra_corretora': return { status_operacional: 'outra_corretora', status_cotacao: 'cotada_enviada', status_renovacao: 'nao_renovada' }
    case 'renovada': return { status_operacional: 'renovado', status_cotacao: 'cotada_enviada', status_renovacao: 'renovada' }
    case 'nao_renovada': return { status_operacional: 'cancelado', status_cotacao: 'nao_cotada', status_renovacao: 'nao_renovada' }
    default: return { status_operacional: 'pendente', status_cotacao: 'nao_cotada', status_renovacao: 'pendente' }
  }
}

export function renewalStatusValue(item = {}) {
  const operational = normalizeText(item.status_operacional).replace(/\s+/g, '_')
  if (operational === 'renovado') return 'renovada'
  if (operational === 'cancelado') return 'nao_renovada'
  if (operational === 'outra_corretora') return 'outra_corretora'
  if (operational === 'negociando') return 'negociando'
  if (operational === 'enviado') return 'enviada'
  if (operational === 'cotando') return 'em_andamento'
  if (operational === 'cotado') return 'cotada'
  if (item.status_renovacao === 'renovada') return 'renovada'
  if (item.status_renovacao === 'nao_renovada') return 'nao_renovada'
  if (item.status_cotacao === 'cotada_enviada') return 'enviada'
  if (item.status_cotacao === 'cotada_nao_enviada' || item.cotacao_id) return 'em_andamento'
  return 'pendente'
}

/**
 * Colunas da Pipeline AUTO onde uma renovacao pode parar e o status que cada
 * uma grava em `renovacoes_auto`.
 *
 * A renovacao NAO vira cotacao ao ser arrastada: continua sendo a mesma linha
 * de `renovacoes_auto`, so muda de status. Quem quer cotar de verdade usa o
 * botao "Iniciar cotacao" do card, que e o caminho que cria cotacao e emissao.
 *
 * `pendentes` ("Cotacoes pendentes") volta a renovacao para o estado pendente
 * de proposito: aquela coluna e, por desenho, so de seguro novo ainda nao
 * cotado (`emissoesPipeline` filtra por `tipo === 'novo'`), e "pendente" e
 * exatamente o que a renovacao passa a ser. O card reaparece na coluna de
 * renovacao correspondente a data limite dela.
 */
export const RENOVACAO_STAGE_STATUS = {
  renovacoes: 'pendente',
  renovacoes_para_enviar: 'pendente',
  pendentes: 'pendente',
  cotacao_iniciada: 'em_andamento',
  cotacao_feita: 'cotada',
  negociando: 'negociando',
  aguardando_vistoria: 'negociando',
  proposta_transmitida: 'enviada',
  apolice_emitida: 'renovada',
  nao_renovou: 'nao_renovada',
}

// Volta de `status_operacional` para a coluna. `cotando` possui uma etapa
// explicita: iniciar o trabalho nao pode fazer o card desaparecer nem continuar
// parecendo uma renovacao ainda intocada.
const STAGE_POR_OPERACIONAL = {
  cotando: 'cotacao_iniciada',
  cotado: 'cotacao_feita',
  enviado: 'proposta_transmitida',
  negociando: 'negociando',
  renovado: 'apolice_emitida',
  cancelado: 'nao_renovou',
}

/**
 * Campos gravados ao soltar a renovacao numa coluna.
 *
 * "Aguardando vistoria ou rastreador" nao tem status proprio em
 * `renovacoes_auto`. O par (`negociando` + `cotada_nao_enviada`) e valido pelos
 * dois CHECKs da tabela, nao e produzido por nenhum outro caminho do sistema e
 * por isso identifica a coluna sem precisar de migration. Para as outras telas
 * o negocio segue aparecendo como "Aguardando retorno", que e o que ele e.
 */
export function renovacaoStageFields(stageId) {
  const status = RENOVACAO_STAGE_STATUS[stageId]
  if (!status) return null
  const fields = renewalStatusFields(status)
  if (stageId === 'aguardando_vistoria') return { ...fields, status_cotacao: 'cotada_nao_enviada' }
  return fields
}

/** Coluna da Pipeline onde a renovacao deve ser desenhada. */
export function resolveRenovacaoStage(item = {}, today = new Date().toISOString().slice(0, 10)) {
  const operational = normalizeText(item?.status_operacional).replace(/\s+/g, '_')
  const stage = STAGE_POR_OPERACIONAL[operational]
  if (stage === 'negociando') {
    return item?.status_cotacao === 'cotada_nao_enviada' ? 'aguardando_vistoria' : 'negociando'
  }
  if (stage) return stage

  // Pendente (ou qualquer estado sem coluna propria) continua dividido pela
  // data limite de envio, como antes do arrasto existir.
  const limite = item?.data_limite_envio || item?.vigencia_fim || ''
  return limite && limite <= today ? 'renovacoes_para_enviar' : 'renovacoes'
}

/**
 * A renovacao ainda pertence ao quadro?
 *
 * Sem isto o card sumia ao ser arrastado: `isRenovacaoSemCalculo` responde
 * `false` para 'cotado', 'enviado', 'negociando' e 'renovado', que sao
 * justamente os estados que o arrasto grava. "Cancelado" agora possui a
 * coluna explicita "Nao renovou"; apenas "Outra corretora" continua fora.
 */
export function isRenovacaoNoQuadro(item = {}) {
  if (isRenovacaoSemCalculo(item)) return true
  const operational = normalizeText(item?.status_operacional).replace(/\s+/g, '_')
  return Boolean(STAGE_POR_OPERACIONAL[operational])
}

export function parseRenovacoesPaste(text, monthRef) {
  const fallbackDate = monthLastDay(monthRef)
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) return []

  const header = lines[0].split('\t').map(normalizeText)
  const hasHeader = header.some(cell => (
    ['data', 'cia', 'segurado', 'nome', 'status', 'limite', 'veiculo'].includes(cell)
    || cell.includes('vencimento')
    || cell.includes('seguradora')
    || cell.includes('comissao')
  ))
  const indexes = {
    data: header.findIndex(cell => cell === 'data' || cell.includes('vencimento')),
    cia: header.findIndex(cell => cell === 'cia' || cell === 'seguradora' || cell.includes('seguradora atual')),
    outraSeguradora: header.findIndex(cell => cell.includes('outra seguradora') || cell.includes('segunda seguradora') || cell.includes('seguradora alternativa')),
    nome: header.findIndex(cell => cell.includes('segurado') || cell === 'nome' || cell.includes('cliente')),
    veiculo: header.findIndex(cell => cell.includes('veiculo') || cell.includes('modelo')),
    status: header.findIndex(cell => cell.includes('status')),
    limite: header.findIndex(cell => cell.includes('limite') || cell.includes('prazo')),
    comissao: header.findIndex(cell => cell === 'comissao' || cell.includes('comissao atual')),
    comissaoAnterior: header.findIndex(cell => cell.includes('com passada') || cell.includes('comissao passada') || cell.includes('comissao anterior')),
  }

  return lines.slice(hasHeader ? 1 : 0).map(line => {
    const cells = line.split('\t').map(cell => cell.trim())
    const singleName = cells.length === 1
    const nome = singleName ? cells[0] : cells[indexes.nome >= 0 ? indexes.nome : 2]
    if (!nome) return null
    const statusText = normalizeText(indexes.status >= 0 ? cells[indexes.status] : '')
    const status = statusText.includes('renov') || statusText.includes('vendeu')
      ? 'renovada'
      : statusText.includes('outra corretora')
        ? 'outra_corretora'
        : statusText.includes('negoci')
          ? 'negociando'
      : statusText.includes('cancel') || statusText.includes('nao renov')
        ? 'nao_renovada'
        : statusText.includes('envi')
          ? 'enviada'
          : statusText.includes('cot')
            ? 'em_andamento'
            : 'pendente'
    return {
      nome_cliente: nome,
      seguradora: singleName ? '' : (cells[indexes.cia >= 0 ? indexes.cia : 1] || ''),
      outra_seguradora: indexes.outraSeguradora >= 0 ? cells[indexes.outraSeguradora] || '' : (!hasHeader && !singleName ? cells[4] || '' : ''),
      vigencia_fim: parseDate(indexes.data >= 0 ? cells[indexes.data] : (!hasHeader && !singleName ? cells[0] : ''), fallbackDate),
      data_limite_envio: parseDate(indexes.limite >= 0 ? cells[indexes.limite] : '', ''),
      identificacao_veiculo: indexes.veiculo >= 0 ? cells[indexes.veiculo] || '' : (!hasHeader && !singleName ? cells[3] || '' : ''),
      pct_comissao_atual: indexes.comissao >= 0 ? parseNumber(cells[indexes.comissao]) : null,
      pct_comissao_anterior: indexes.comissaoAnterior >= 0 ? parseNumber(cells[indexes.comissaoAnterior]) : (!hasHeader && !singleName ? parseNumber(cells[5]) : null),
      status,
    }
  }).filter(Boolean)
}

function parseNumber(value) {
  const raw = String(value ?? '').trim().replace('%', '')
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function scoreCotacaoSuggestion(item, term, referenceDate) {
  const query = normalizeText(term)
  const name = normalizeText(item?.nome_cliente || item?.cotacoes_auto?.nome_cliente)
  if (!query || !name || !name.includes(query)) return -1
  let score = name === query ? 100 : name.startsWith(query) ? 70 : 45
  const date = item?.updated_at || item?.created_at
  if (referenceDate && date) {
    const distance = Math.abs(new Date(date).getTime() - new Date(referenceDate).getTime()) / 86400000
    score += Math.max(0, 30 - Math.min(distance, 30))
  }
  if (item?.resultado === 'aprovada') score += 15
  if (item?.cotacao_id || item?.cotacoes_auto?.id) score += 10
  return score
}

// Sugestao conservadora para vincular uma linha colada a clientes_auto.
// Retorna somente quando ha uma correspondencia unica; a UI ainda pede a
// confirmacao do usuario antes de persistir cliente_id.
export function suggestRenewalClientByName(nameValue, clients = []) {
  const name = normalizeText(nameValue).replace(/[^a-z0-9]+/g, ' ').trim()
  if (name.length < 3) return null
  const normalized = clients.map(client => ({ client, name: normalizeText(client?.nome_completo).replace(/[^a-z0-9]+/g, ' ').trim() }))
  const exact = normalized.filter(entry => entry.name === name)
  if (exact.length === 1) return exact[0].client
  const close = normalized.filter(entry => entry.name.startsWith(name) || name.startsWith(entry.name))
  return close.length === 1 ? close[0].client : null
}

export function renewalClientMatchesByName(nameValue, clients = []) {
  const name = normalizeText(nameValue).replace(/[^a-z0-9]+/g, ' ').trim()
  if (name.length < 3) return []
  return clients.filter(client => (
    normalizeText(client?.nome_completo).replace(/[^a-z0-9]+/g, ' ').trim() === name
  ))
}
