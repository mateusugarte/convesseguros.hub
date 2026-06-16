export const AUTO_LINKS = [
  { to: '/auto', label: 'Dashboard' },
  { to: '/auto/renovacoes', label: 'Renovacoes' },
  { to: '/auto/emissoes', label: 'Emissoes' },
  { to: '/auto/cotacoes', label: 'Cotacoes' },
  { to: '/auto/sinistros', label: 'Sinistros' },
]

export const RENOVACAO_STATUS = {
  nao_cotada: { label: 'Nao cotada', tone: 'danger' },
  cotada_nao_enviada: { label: 'Cotada nao enviada', tone: 'warning' },
  cotada_enviada: { label: 'Cotada enviada', tone: 'success' },
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
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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
    accent: 'bg-brand-accent/10 text-brand-accent border-brand-accent/15',
    secondary: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/15',
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
      return 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/15'
  }
}
