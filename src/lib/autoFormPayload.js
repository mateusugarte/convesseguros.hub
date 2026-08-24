const AUTO_FORM_FIELDS = {
  tipo_residencia: {
    aliases: ['tipo residencia', 'tipo de residencia'],
    required: ['tipo', 'residencia'],
  },
  passagem_leilao: {
    aliases: [
      'veiculo tem passagem por leilao',
      'veiculo possui passagem por leilao',
      'passagem por leilao',
    ],
    required: ['leilao'],
  },
}

export function normalizarChaveFormulario(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function preenchido(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function payloadDaCotacao(quote) {
  const payload = quote?.payload_origem
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return payload.body && typeof payload.body === 'object' && !Array.isArray(payload.body)
    ? payload.body
    : payload
}

export function valorFormularioAuto(quote, field) {
  if (preenchido(quote?.[field])) return quote[field]

  const payload = payloadDaCotacao(quote)
  if (preenchido(payload?._conves?.[field])) return payload._conves[field]

  const config = AUTO_FORM_FIELDS[field]
  if (!config) return ''

  const entries = Object.entries(payload)
    .filter(([key]) => key !== '_conves')
    .map(([key, value]) => [normalizarChaveFormulario(key), value])

  for (const alias of config.aliases) {
    const normalizedAlias = normalizarChaveFormulario(alias)
    const match = entries.find(([key, value]) => key === normalizedAlias && preenchido(value))
    if (match) return match[1]
  }

  const match = entries.find(([key, value]) => (
    config.required.every(term => key.includes(normalizarChaveFormulario(term))) && preenchido(value)
  ))

  return match?.[1] ?? ''
}

