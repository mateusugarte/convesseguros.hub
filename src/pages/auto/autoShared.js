export const AUTO_LINKS = [
  { to: '/auto', label: 'Dashboard' },
  { to: '/auto/renovacoes', label: 'Renovacoes' },
  { to: '/auto/emissoes', label: 'Emissoes' },
  { to: '/auto/cotacoes', label: 'Cotacoes' },
  { to: '/auto/sinistros', label: 'Sinistros' },
]

export const RENOVACAO_STATUS = {
  pendente: { label: 'Pendente', tone: 'muted', cls: 'badge-muted' },
  nao_cotada: { label: 'Nao cotada', tone: 'danger', cls: 'badge-danger' },
  cotada_nao_enviada: { label: 'Cotada nao enviada', tone: 'warning', cls: 'badge-warning' },
  cotada_enviada: { label: 'Cotada enviada', tone: 'success', cls: 'badge-success' },
}

export const RENOVACAO_RESULTADO = {
  pendente: { label: 'Pendente', tone: 'warning' },
  renovada: { label: 'Renovada', tone: 'success' },
  nao_renovada: { label: 'Nao renovada', tone: 'danger' },
}

export const AUTO_COLUNAS = [
  { id: 'cotacao_feita', label: 'Cotacao feita' },
  { id: 'negociando', label: 'Negociando' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria' },
  { id: 'emitida', label: 'Emitida' },
]

export const COTACAO_ABAS = [
  { value: 'novo', label: 'Seguro novo' },
  { value: 'renovacao', label: 'Renovacao' },
]

export const COTACAO_STATUS = {
  pendente: { label: 'Pendente', tone: 'warning' },
  aberta: { label: 'Pendente', tone: 'warning' },
  convertida: { label: 'Convertida', tone: 'success' },
  perdida: { label: 'Perdida', tone: 'danger' },
}

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

export function formatPercent(value) {
  const n = Number(value ?? 0)
  return `${(n * 100).toFixed(0)}%`
}

export function formatDateBR(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}

export function formatDateTimeBR(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function monthKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'invalid'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabelFromKey(key) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
}

export function toneClasses(tone) {
  const tones = {
    accent: 'bg-brand-accent/10 text-status-info border-brand-accent/15',
    secondary: 'bg-brand-secondary/10 text-status-info border-brand-secondary/15',
    success: 'bg-status-success/10 text-status-success border-status-success/15',
    warning: 'bg-status-warning/10 text-status-warning border-status-warning/15',
    danger: 'bg-status-danger/10 text-status-danger border-status-danger/15',
  }
  return tones[tone] || tones.accent
}

export function statusToneClass(tone) {
  switch (tone) {
    case 'success':
      return 'bg-status-success/10 text-status-success border-status-success/15'
    case 'warning':
      return 'bg-status-warning/10 text-status-warning border-status-warning/15'
    case 'danger':
      return 'bg-status-danger/10 text-status-danger border-status-danger/15'
    default:
      return 'bg-brand-secondary/10 text-status-info border-brand-secondary/15'
  }
}

export function isApoliceAtiva(apolice, hojeISO = new Date().toISOString().slice(0, 10)) {
  return Boolean(apolice?.vigencia_fim && apolice.vigencia_fim >= hojeISO)
}

export function getClienteStatusAuto(apolices = [], hojeISO = new Date().toISOString().slice(0, 10)) {
  if (!apolices.length) return null
  return apolices.some(item => isApoliceAtiva(item, hojeISO)) ? 'ativo' : 'inativo'
}

export function formatMonthYearBR(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// Dias restantes ate a vigencia final, comparando por dia de calendario (nao
// por horario exato) para nao variar conforme a hora em que a pagina e aberta.
export function diasParaVencer(value, hoje = new Date()) {
  if (!value) return null
  const alvo = new Date(`${value}T12:00:00`)
  if (Number.isNaN(alvo.getTime())) return null
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const alvoDia = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate())
  return Math.round((alvoDia - base) / (1000 * 60 * 60 * 24))
}

export function formatDiasParaVencer(dias) {
  if (typeof dias !== 'number' || Number.isNaN(dias)) return 'Sem data'
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanha'
  if (dias === -1) return 'Vencida ha 1 dia'
  if (dias < 0) return `Vencida ha ${Math.abs(dias)} dias`
  return `Faltam ${dias} dias`
}

export const RENOVACAO_URGENCIA_META = {
  vencida: { label: 'Vencida', rowClass: 'border-status-danger/50 bg-status-danger/10', badgeClass: 'badge-danger' },
  urgente: { label: 'Urgente (ate 10 dias)', rowClass: 'border-status-danger/30 bg-status-danger/5', badgeClass: 'badge-danger' },
  mes_atual: { label: 'Vence este mes', rowClass: 'border-status-warning/25 bg-status-warning/5', badgeClass: 'badge-warning' },
  proximo_mes: { label: 'Vence no proximo mes', rowClass: 'border-dark-border/70', badgeClass: 'badge-muted' },
  concluida: { label: 'Concluida', rowClass: 'border-status-success/25 bg-status-success/5 opacity-75', badgeClass: 'badge-success' },
}

// Hierarquia: concluida > vencida > urgente (<=10 dias) > mes atual/proximo mes.
export function getRenovacaoUrgencia({ dias, concluida = false, proximoMes = false } = {}) {
  if (concluida) return 'concluida'
  if (typeof dias === 'number' && !Number.isNaN(dias)) {
    if (dias < 0) return 'vencida'
    if (dias <= 10) return 'urgente'
  }
  return proximoMes ? 'proximo_mes' : 'mes_atual'
}

export const RENEWAL_QUOTE_STATUS_META = {
  nao_cotada: { label: 'Ainda nao cotada', tone: 'muted' },
  em_andamento: { label: 'Cotacao em andamento', tone: 'warning' },
  aguardando_retorno: { label: 'Aguardando retorno', tone: 'secondary' },
  concluida: { label: 'Concluida', tone: 'success' },
  perdida: { label: 'Perdida ou cancelada', tone: 'danger' },
}

// Deriva o status da cotacao de renovacao a partir do vinculo renovacao ->
// cotacao (renovacao.cotacoes_auto), em vez de depender de um campo separado
// que poderia ficar dessincronizado. Sem cotacao vinculada => "nao cotada".
export function getRenewalQuoteStatus(renovacao) {
  const cotacao = renovacao?.cotacoes_auto
  if (!cotacao) return 'nao_cotada'
  if (cotacao.status === 'perdida') return 'perdida'
  if (cotacao.status === 'convertida') return 'concluida'

  const emissao = Array.isArray(cotacao.emissoes_auto) ? cotacao.emissoes_auto[0] : cotacao.emissoes_auto
  const coluna = emissao?.coluna
  if (coluna === 'negociando' || coluna === 'aguardando_vistoria') return 'aguardando_retorno'
  return 'em_andamento'
}

export const AVISO_VIRADA_DIAS = 15
export const PRAZO_ENVIO_ORCAMENTO_DIAS = 7

function mesRefDe(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Mes-alvo do lembrete de virada de mes: comeca a valer 15 dias antes do
// mes seguinte comecar; se esse mes ja foi concluido mas um mes anterior
// (ate 2 meses atras) ainda estiver pendente, retorna o mais antigo pendente
// em vez de "esquecer" dele. Retorna null quando nao ha nada pendente.
export function getMesAlvoRenovacao(hoje = new Date(), statusPorMes = {}, avisoDias = AVISO_VIRADA_DIAS) {
  // Check if next month's window has opened
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const abreProximo = new Date(proximo.getFullYear(), proximo.getMonth(), 1 - avisoDias)

  if (hoje < abreProximo) {
    // Next month's window hasn't opened yet, no active work
    return null
  }

  // Next month's window has opened, check from next to 2 months back
  for (let offset = 1; offset >= -2; offset -= 1) {
    const refDate = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1)
    const mesRef = mesRefDe(refDate)
    if (!statusPorMes[mesRef]?.concluido_em) {
      return mesRef
    }
  }

  return null
}
