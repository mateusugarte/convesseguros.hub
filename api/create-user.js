import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res, status, body) {
  res.status(status).json(body)
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
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
    return json(res, 403, { error: 'Only admins can create users' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
  const nome = String(body.nome || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const areasAtuacao = normalizeArray(body.areas_atuacao)
  const isAdmin = Boolean(body.is_admin)

  if (!nome || !email || !password) {
    return json(res, 400, { error: 'Nome, email e senha sao obrigatorios' })
  }

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (createUserError || !createdUser?.user?.id) {
    return json(res, 400, { error: createUserError?.message || 'Nao foi possivel criar o usuario' })
  }

  const profilePayload = {
    id: createdUser.user.id,
    nome,
    orcamentista_label: nome.toUpperCase(),
    avatar_url: null,
    areas_atuacao: areasAtuacao,
    is_admin: isAdmin,
  }

  const { error: profileUpsertError } = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (profileUpsertError) {
    return json(res, 400, { error: profileUpsertError.message })
  }

  return json(res, 200, {
    ok: true,
    user: {
      id: createdUser.user.id,
      email,
    },
    profile: profilePayload,
  })
}
