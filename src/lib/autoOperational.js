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
  { id: 'cotacao_feita', label: 'Cotações feitas', shortLabel: 'Feitas', color: '#3563e9' },
  { id: 'negociando', label: 'Negociando', shortLabel: 'Negociando', color: '#38bdf8' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria ou rastreador', shortLabel: 'Vistoria/rastreador', color: '#a855f7' },
  { id: 'proposta_transmitida', label: 'Proposta transmitida', shortLabel: 'Proposta', color: '#10b981' },
  { id: 'apolice_emitida', label: 'Apólice emitida', shortLabel: 'Emitida', color: '#0f766e' },
]

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
  if (!raw || raw === 'pendente') return 'pendentes'
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
