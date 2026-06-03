import { supabase } from './supabase'

export async function fetchCodigos(imobiliariaId) {
  const { data } = await supabase
    .from('imobiliaria_codigos')
    .select('id, codigo, seguradora_id, seguradoras!seguradora_id(nome_canonico)')
    .eq('imobiliaria_id', imobiliariaId)
    .order('created_at')
  return data || []
}

export async function fetchSeguradoras() {
  const { data } = await supabase
    .from('seguradoras')
    .select('id, nome_canonico')
    .eq('ativa', true)
    .order('nome_canonico')
  return data || []
}

export async function upsertCodigo(imobiliariaId, seguradoraId, codigo) {
  const { error } = await supabase.from('imobiliaria_codigos').upsert(
    { imobiliaria_id: imobiliariaId, seguradora_id: seguradoraId, codigo },
    { onConflict: 'imobiliaria_id,seguradora_id' }
  )
  return error
}

export async function deletarCodigo(id) {
  const { error } = await supabase.from('imobiliaria_codigos').delete().eq('id', id)
  return error
}
