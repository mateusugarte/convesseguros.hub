const OPERATIONAL_STATES = {
  aprovada: { label: 'Aprovada', className: 'badge-success' },
  emitida: { label: 'Emitida', className: 'badge-purple' },
  enviada_cobranca: { label: 'Enviado Cobrança', className: 'badge-blue' },
  recuperada: { label: 'Recuperada', className: 'badge-purple' },
  desistiu: { label: 'Desistiu', className: 'badge-muted' },
  expirada: { label: 'Expirada', className: 'badge-muted' },
  recusada: { label: 'Recusada', className: 'badge-danger' },
}

const STATUS_FALLBACK = {
  pendente: 'Pendente',
  em_cotacao: 'Em Cotação',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  emitido: 'Emitido',
  cancelado: 'Cancelado',
  cpf_invalido: 'CPF Inválido',
  expirada: 'Expirada',
}

export function getFichaOperationalMeta(ficha = {}) {
  const raw = ficha?.raw_data || {}
  const recovered = Boolean(raw.recovered_after_cobranca)

  if (ficha.status === 'aprovado') return OPERATIONAL_STATES.aprovada
  if (ficha.status === 'emitido' && ficha.numero_apolice && recovered) return OPERATIONAL_STATES.recuperada
  if (ficha.status === 'emitido' && ficha.retorno_enviado && !ficha.numero_apolice) return OPERATIONAL_STATES.enviada_cobranca
  if (ficha.status === 'emitido' && ficha.numero_apolice) return OPERATIONAL_STATES.emitida
  if (ficha.status === 'cancelado') return OPERATIONAL_STATES.desistiu
  if (ficha.status === 'expirada') return OPERATIONAL_STATES.expirada
  if (ficha.status === 'recusado') return OPERATIONAL_STATES.recusada
  return null
}

export default function FichaStatusBadge({ ficha, className = '' }) {
  const meta = getFichaOperationalMeta(ficha)
  if (meta) {
    return <span className={`badge ${meta.className} ${className}`.trim()}>{meta.label}</span>
  }

  const label = STATUS_FALLBACK[ficha?.status]
  if (!label) return null
  return <span className={`badge badge-info ${className}`.trim()}>{label}</span>
}
