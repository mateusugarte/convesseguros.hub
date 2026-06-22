import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(res, status, body) {
  res.status(status).json(body)
}

function buildOrcamentistaLabel(nome, email) {
  const base = String(nome || '').trim() || String(email || '').split('@')[0] || 'USUARIO'
  return base.toUpperCase()
}

function normalizeAreas(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

async function findAuthUserByEmail(adminClient, email) {
  let page = 1
  const perPage = 100
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    const found = users.find(u => String(u.email || '').toLowerCase() === email)
    if (found) return found
    if (users.length < perPage) return null
    page += 1
  }
}

async function upsertProfile(adminClient, { userId, nome, email, isAdmin, areasAtuacao, comercialProdutos }) {
  const profilePayload = {
    id: userId,
    nome,
    orcamentista_label: buildOrcamentistaLabel(nome, email),
    avatar_url: null,
    is_admin: isAdmin,
    areas_atuacao: normalizeAreas(areasAtuacao),
    comercial_produtos: normalizeAreas(comercialProdutos),
  }

  const { error } = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (error) throw error
  return profilePayload
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
  const isAdmin = Boolean(body.is_admin)
  const areasAtuacao = Array.isArray(body.areas_atuacao) ? body.areas_atuacao : Array.isArray(body.roles) ? body.roles : []
  const comercialProdutos = Array.isArray(body.comercial_produtos) ? body.comercial_produtos : []

  if (!nome || !email || !password) {
    return json(res, 400, { error: 'Nome, email e senha sao obrigatorios' })
  }

  let userRecord = await findAuthUserByEmail(adminClient, email)

  if (userRecord?.id) {
    const { data: updatedUser, error: updateUserError } = await adminClient.auth.admin.updateUserById(userRecord.id, {
      password,
      email_confirm: true,
      user_metadata: { nome },
    })

    if (updateUserError || !updatedUser?.user?.id) {
      return json(res, 400, { error: updateUserError?.message || 'Nao foi possivel atualizar o usuario' })
    }

    userRecord = updatedUser.user
  } else {
    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    })

    if (createUserError || !createdUser?.user?.id) {
      if (createUserError?.message?.toLowerCase().includes('already been registered')) {
        userRecord = await findAuthUserByEmail(adminClient, email)
      } else {
        return json(res, 400, { error: createUserError?.message || 'Nao foi possivel criar o usuario' })
      }
    } else {
      userRecord = createdUser.user
    }
  }

  if (!userRecord?.id) {
    return json(res, 400, { error: 'Nao foi possivel localizar o usuario no Auth' })
  }

  const profilePayload = await upsertProfile(adminClient, {
    userId: userRecord.id,
    nome,
    email,
    isAdmin,
    areasAtuacao,
    comercialProdutos,
  })

  return json(res, 200, {
    ok: true,
    user: {
      id: userRecord.id,
      email: userRecord.email || email,
    },
    profile: profilePayload,
  })
}
