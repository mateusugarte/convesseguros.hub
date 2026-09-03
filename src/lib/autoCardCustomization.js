const CARD_COLOR_PREFIX = '__card_color__:'
const EMISSION_REQUIREMENT_PREFIX = '__emission_requirement__:'

export const AUTO_CARD_COLORS = [
  '#10B981',
  '#2563EB',
  '#7C3AED',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#0F766E',
  '#475569',
]

export const AUTO_EMISSION_REQUIREMENTS = ['nenhuma', 'vistoria', 'rastreador', 'vistoria_rastreador']

function tagsArray(tags) {
  return Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string' && tag.trim()) : []
}

export function normalizeCardColor(value) {
  const color = String(value || '').trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(color) ? color : ''
}

export function getAutoCardColor(tags) {
  const token = tagsArray(tags).find(tag => tag.startsWith(CARD_COLOR_PREFIX))
  return normalizeCardColor(token?.slice(CARD_COLOR_PREFIX.length))
}

export function setAutoCardColor(tags, color) {
  const remaining = tagsArray(tags).filter(tag => !tag.startsWith(CARD_COLOR_PREFIX))
  const normalized = normalizeCardColor(color)
  return normalized ? [...remaining, `${CARD_COLOR_PREFIX}${normalized}`] : remaining
}

export function getAutoEmissionRequirement(tags) {
  const token = tagsArray(tags).find(tag => tag.startsWith(EMISSION_REQUIREMENT_PREFIX))
  const requirement = token?.slice(EMISSION_REQUIREMENT_PREFIX.length) || 'nenhuma'
  return AUTO_EMISSION_REQUIREMENTS.includes(requirement) ? requirement : 'nenhuma'
}

export function setAutoEmissionRequirement(tags, requirement) {
  const remaining = tagsArray(tags).filter(tag => !tag.startsWith(EMISSION_REQUIREMENT_PREFIX))
  const normalized = AUTO_EMISSION_REQUIREMENTS.includes(requirement) ? requirement : 'nenhuma'
  return normalized === 'nenhuma'
    ? remaining
    : [...remaining, `${EMISSION_REQUIREMENT_PREFIX}${normalized}`]
}

export function resolveAutoEmissionDestination(column, requirement) {
  if (column === 'apolice_emitida') return 'apolice_emitida'
  return requirement && requirement !== 'nenhuma'
    ? 'aguardando_vistoria'
    : 'proposta_transmitida'
}

export function autoEmissionRequirementLabel(requirement) {
  if (requirement === 'vistoria') return 'Vistoria necessária'
  if (requirement === 'rastreador') return 'Instalar rastreador'
  if (requirement === 'vistoria_rastreador') return 'Vistoria + rastreador'
  return ''
}
