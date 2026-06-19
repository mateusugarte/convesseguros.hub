import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res, status, body) {
  res.status(status).json(body)
}

function normalizeAreas(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server not configured' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return json(res, 401, { error: 'Missing auth token' })
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    return json(res, 401, { error: 'Invalid session' })
  }

  const { data: adminProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !adminProfile?.is_admin) {
    return json(res, 403, { error: 'Only admins can update profiles' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const id = String(body.id || '').trim()
  if (!id) {
    return json(res, 400, { error: 'Perfil invalido' })
  }

  const updates = {}
  if (typeof body.nome === 'string') updates.nome = body.nome.trim()
  if (typeof body.orcamentista_label === 'string') updates.orcamentista_label = body.orcamentista_label.trim()
  if ('is_admin' in body) updates.is_admin = Boolean(body.is_admin)
  if ('areas_atuacao' in body) updates.areas_atuacao = normalizeAreas(body.areas_atuacao)
  if ('avatar_url' in body) updates.avatar_url = body.avatar_url || null

  const { data, error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, nome, orcamentista_label, avatar_url, is_admin, areas_atuacao')
    .single()

  if (error) {
    return json(res, 400, { error: error.message })
  }

  return json(res, 200, { ok: true, profile: data })
}
