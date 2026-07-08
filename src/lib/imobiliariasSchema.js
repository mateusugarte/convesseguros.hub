import { supabase } from './supabase'

export const IMOBILIARIA_CONTACT_FIELDS = [
  'email',
  'cnpj',
  'creci',
  'telefone',
  'responsavel',
  'endereco',
]

export const IMOBILIARIA_COMMERCIAL_FIELDS = [
  'recebe_comissao',
  'pct_comissao',
  'objetivo_comercial',
  'observacoes_comerciais',
]

export const IMOBILIARIA_OPTIONAL_FIELDS = [
  ...IMOBILIARIA_COMMERCIAL_FIELDS,
  ...IMOBILIARIA_CONTACT_FIELDS,
]

const IMOBILIARIA_BASE_SELECT = [
  'id',
  'nome_canonico',
  'ativa',
  'created_at',
  'imagem_url',
  'imagem_path',
  'imobiliaria_aliases(id, alias)',
].join(', ')

const IMOBILIARIA_FIELD_LABELS = {
  email: 'E-mail',
  cnpj: 'CNPJ',
  creci: 'CRECI',
  telefone: 'Telefone',
  responsavel: 'Responsavel',
  endereco: 'Endereco',
  recebe_comissao: 'Recebe comissao',
  pct_comissao: '% Comissao',
  objetivo_comercial: 'Objetivo comercial',
  observacoes_comerciais: 'Observacoes comerciais',
}

function buildSelect(optionalFields) {
  return optionalFields.length
    ? `${IMOBILIARIA_BASE_SELECT}, ${optionalFields.join(', ')}`
    : IMOBILIARIA_BASE_SELECT
}

function normalizeMessage(value) {
  return String(value || '')
}

export function formatImobiliariaFieldLabel(field) {
  return IMOBILIARIA_FIELD_LABELS[field] || field
}

export function isMissingImobiliariaColumnError(error, field) {
  if (!error) return false

  const code = String(error.code || '')
  const message = normalizeMessage(error.message).toLowerCase()
  const target = String(field || '').toLowerCase()

  if (!target) return code === '42703' || code === 'PGRST204'

  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes(`'${target}'`) ||
    message.includes(`"${target}"`) ||
    message.includes(`.${target}`) ||
    message.includes(`column ${target}`) ||
    message.includes(`${target} column`)
  )
}

export function extractMissingImobiliariaColumn(error) {
  const message = normalizeMessage(error?.message)
  const patterns = [
    /column ["']?(?:public\.)?(?:imobiliarias\.)?([a-z0-9_]+)["']? does not exist/i,
    /could not find the ['"]([a-z0-9_]+)['"] column/i,
    /column ([a-z0-9_]+) does not exist/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1].toLowerCase()
  }

  return null
}

// Cache em memória (dura a sessão da aba) das colunas opcionais ainda não
// migradas no banco. Sem isso, toda visita a ImobiliariaDetalhe refaz a
// descoberta coluna-a-coluna (1 round-trip sequencial por coluna ausente)
// antes de conseguir carregar a página.
let _knownMissingFields = null

export async function fetchImobiliariaById(id) {
  const knownMissing = _knownMissingFields || []
  const remainingFields = IMOBILIARIA_OPTIONAL_FIELDS.filter(field => !knownMissing.includes(field))
  const missingFields = [...knownMissing]

  while (true) {
    const { data, error } = await supabase
      .from('imobiliarias')
      .select(buildSelect(remainingFields))
      .eq('id', id)
      .maybeSingle()

    if (!error) {
      const withDefaults = data
        ? {
            ...Object.fromEntries(IMOBILIARIA_OPTIONAL_FIELDS.map(field => [field, null])),
            ...data,
          }
        : null

      _knownMissingFields = missingFields

      return {
        data: withDefaults,
        error: null,
        availableFields: new Set(remainingFields),
        missingFields: new Set(missingFields),
      }
    }

    const missingField = extractMissingImobiliariaColumn(error)
    if (!missingField || !remainingFields.includes(missingField) || !isMissingImobiliariaColumnError(error, missingField)) {
      return {
        data: null,
        error,
        availableFields: new Set(remainingFields),
        missingFields: new Set(missingFields),
      }
    }

    missingFields.push(missingField)
    remainingFields.splice(remainingFields.indexOf(missingField), 1)
  }
}
