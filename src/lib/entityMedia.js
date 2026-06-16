import { supabase } from './supabase'

export const ENTITY_MEDIA_BUCKET = 'cadastros-media'
export const ENTITY_DOCS_BUCKET = 'entidade-documentos'

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function uniqueName(fileName) {
  const parts = String(fileName || 'arquivo').split('.')
  const ext = parts.length > 1 ? `.${parts.pop()}` : ''
  const base = slugify(parts.join('.')) || 'arquivo'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`
}

export async function uploadEntityImage({ file, entityType, entityId }) {
  const path = `${entityType}/${entityId}/${uniqueName(file.name)}`
  const { error: uploadError } = await supabase.storage
    .from(ENTITY_MEDIA_BUCKET)
    .upload(path, file, { upsert: false })

  if (uploadError) return { error: uploadError }

  const { data } = supabase.storage.from(ENTITY_MEDIA_BUCKET).getPublicUrl(path)

  return {
    error: null,
    path,
    url: data?.publicUrl || null,
  }
}

export async function removeStorageObject(bucket, path) {
  if (!path) return null
  const { error } = await supabase.storage.from(bucket).remove([path])
  return error
}

export async function replaceEntityImage({ file, entityType, entityId, previousPath }) {
  const uploaded = await uploadEntityImage({ file, entityType, entityId })
  if (uploaded.error) return uploaded

  if (previousPath) {
    await removeStorageObject(ENTITY_MEDIA_BUCKET, previousPath)
  }

  return uploaded
}

export async function fetchEntityDocuments({ tipoEntidade, entidadeId }) {
  const { data, error } = await supabase
    .from('entidade_documentos')
    .select('id, created_at, titulo, nome_arquivo, storage_path, tamanho_bytes, tipo_mime, enviado_por, profiles!enviado_por(nome)')
    .eq('tipo_entidade', tipoEntidade)
    .eq('entidade_id', entidadeId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const docs = await Promise.all((data || []).map(async doc => {
    const { data: signed } = await supabase.storage
      .from(ENTITY_DOCS_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 60)

    return {
      ...doc,
      url: signed?.signedUrl || null,
    }
  }))

  return docs
}

export async function uploadEntityDocument({ file, tipoEntidade, entidadeId, titulo, userId }) {
  const path = `${tipoEntidade}/${entidadeId}/${uniqueName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(ENTITY_DOCS_BUCKET)
    .upload(path, file, { upsert: false })

  if (uploadError) return { error: uploadError }

  const { error: dbError } = await supabase.from('entidade_documentos').insert({
    tipo_entidade: tipoEntidade,
    entidade_id: entidadeId,
    titulo: titulo?.trim() || file.name,
    nome_arquivo: file.name,
    storage_path: path,
    tamanho_bytes: file.size,
    tipo_mime: file.type,
    enviado_por: userId || null,
  })

  return { error: dbError }
}

export async function deleteEntityDocument(id) {
  const { data, error } = await supabase
    .from('entidade_documentos')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (error) return error

  if (data?.storage_path) {
    await removeStorageObject(ENTITY_DOCS_BUCKET, data.storage_path)
  }

  const { error: deleteError } = await supabase
    .from('entidade_documentos')
    .delete()
    .eq('id', id)

  return deleteError
}
