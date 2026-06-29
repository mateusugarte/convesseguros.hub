import { getFichaOperationalState } from '../lib/fichaOperational'

const STATUS_FALLBACK = {
  pendente: 'Pendente',
  em_cotacao: 'Em CotaÃ§Ã£o',
  em_analise: 'Em AnÃ¡lise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  emitido: 'Emitido',
  cancelado: 'Cancelado',
  cpf_invalido: 'CPF InvÃ¡lido',
  expirada: 'Expirada',
}

export function getFichaOperationalMeta(ficha = {}) {
  return getFichaOperationalState(ficha)
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
