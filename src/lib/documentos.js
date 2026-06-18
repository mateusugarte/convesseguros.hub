import { supabase } from './supabase'

// TTL das URLs assinadas em segundos (1 hora)
const SIGNED_URL_TTL = 3600

async function gerarSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error) return null
  return data.signedUrl
}

export async function fetchDocumentos({ fichaId, apoliceId }) {
  let q = supabase
    .from('documentos')
    .select('id, created_at, nome_arquivo, url, tamanho_bytes, tipo_mime, enviado_por, profiles!enviado_por(nome)')
    .order('created_at', { ascending: false })
  if (fichaId)   q = q.eq('ficha_id', fichaId)
  if (apoliceId) q = q.eq('apolice_id', apoliceId)
  const { data, error } = await q
  if (error) throw error
  if (!data || data.length === 0) return []

  // Gerar URL assinada para cada documento (bucket privado)
  const comUrls = await Promise.all(
    data.map(async (doc) => ({
      ...doc,
      signedUrl: await gerarSignedUrl(doc.url),
    }))
  )
  return comUrls
}

export async function uploadDocumento({ file, fichaId, apoliceId, cpfCnpj, userId }) {
  const ext       = file.name.split('.').pop()
  const nomeUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const pasta     = fichaId ? `fichas/${fichaId}` : `apolices/${apoliceId}`
  const caminho   = `${pasta}/${nomeUnico}`

  const { error: uploadErr } = await supabase.storage
    .from('documentos')
    .upload(caminho, file)
  if (uploadErr) return { error: uploadErr }

  // Armazena o path (não a URL pública) — bucket é privado
  const { error: dbErr } = await supabase.from('documentos').insert({
    nome_arquivo:  file.name,
    url:           caminho,
    tamanho_bytes: file.size,
    tipo_mime:     file.type,
    ficha_id:      fichaId   || null,
    apolice_id:    apoliceId || null,
    cpf_cnpj:      cpfCnpj  || null,
    enviado_por:   userId    || null,
  })
  if (dbErr) {
    // Limpar arquivo do storage se insert no banco falhou
    await supabase.storage.from('documentos').remove([caminho])
  }
  return { error: dbErr }
}

export async function deletarDocumento(id, caminho) {
  if (caminho) {
    await supabase.storage.from('documentos').remove([caminho])
  }
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  return error
}
