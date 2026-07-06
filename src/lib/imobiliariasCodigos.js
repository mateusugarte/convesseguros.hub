import { supabase } from './supabase'

function hasMissingColumn(error, columnName) {
  if (!error) return false
  // 42703 = coluna nao existe (Postgres); PGRST204 = coluna fora do schema
  // cache do PostgREST (comum em insert/upsert logo apos alterar a tabela).
  const code = String(error.code || '')
  if (code === '42703' || code === 'PGRST204') return true

  const message = String(error.message || '').toLowerCase()
  const col = String(columnName).toLowerCase()
  return (
    (message.includes('column') && message.includes(col) && message.includes('does not exist')) ||
    (message.includes('could not find') && message.includes(col) && message.includes('column'))
  )
}

export async function fetchCodigos(imobiliariaId) {
  const { data, error } = await supabase
    .from('imobiliaria_codigos')
    .select('id, codigo, observacoes, seguradora_id, seguradoras!seguradora_id(nome_canonico, logo_url, logo_path)')
    .eq('imobiliaria_id', imobiliariaId)
    .order('created_at')

  if (error && hasMissingColumn(error, 'observacoes')) {
    const retry = await supabase
      .from('imobiliaria_codigos')
      .select('id, codigo, seguradora_id, seguradoras!seguradora_id(nome_canonico, logo_url, logo_path)')
      .eq('imobiliaria_id', imobiliariaId)
      .order('created_at')
    return (retry.data || []).map(item => ({ ...item, observacoes: '' }))
  }

  return data || []
}

export async function upsertCodigo(imobiliariaId, seguradoraId, payload) {
  const normalized = typeof payload === 'object' && payload !== null
    ? {
        codigo: payload.codigo ?? '',
        observacoes: payload.observacoes ?? '',
      }
    : {
        codigo: payload ?? '',
        observacoes: '',
      }

  let { error } = await supabase.from('imobiliaria_codigos').upsert(
    {
      imobiliaria_id: imobiliariaId,
      seguradora_id: seguradoraId,
      codigo: normalized.codigo,
      observacoes: normalized.observacoes,
    },
    { onConflict: 'imobiliaria_id,seguradora_id' }
  )

  if (error && hasMissingColumn(error, 'observacoes')) {
    ;({ error } = await supabase.from('imobiliaria_codigos').upsert(
      {
        imobiliaria_id: imobiliariaId,
        seguradora_id: seguradoraId,
        codigo: normalized.codigo,
      },
      { onConflict: 'imobiliaria_id,seguradora_id' }
    ))
  }

  return error
}
