import { supabase } from './supabase'

export async function fetchDocumentos({ fichaId, apoliceId }) {
  let q = supabase
    .from('documentos')
    .select('id, created_at, nome_arquivo, url, tamanho_bytes, tipo_mime, enviado_por, profiles!enviado_por(nome)')
    .order('created_at', { ascending: false })
  if (fichaId)   q = q.eq('ficha_id', fichaId)
  if (apoliceId) q = q.eq('apolice_id', apoliceId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function uploadDocumento({ file, fichaId, apoliceId, cpfCnpj, userId }) {
  const ext       = file.name.split('.').pop()
  const nomeUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const pasta     = fichaId ? `fichas/${fichaId}` : `apolices/${apoliceId}`
  const caminho   = `${pasta}/${nomeUnico}`

  const { error: uploadErr } = await supabase.storage.from('documentos').upload(caminho, file)
  if (uploadErr) return { error: uploadErr }

  // For private bucket: store the storage path, generate signed URL on demand
  // Store path in url field for now; signed URLs are generated when displaying
  const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(caminho)

  const { error: dbErr } = await supabase.from('documentos').insert({
    nome_arquivo:  file.name,
    url:           publicUrl,
    tamanho_bytes: file.size,
    tipo_mime:     file.type,
    ficha_id:      fichaId   || null,
    apolice_id:    apoliceId || null,
    cpf_cnpj:      cpfCnpj  || null,
    enviado_por:   userId    || null,
  })
  return { error: dbErr }
}

export async function deletarDocumento(id) {
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  return error
}
