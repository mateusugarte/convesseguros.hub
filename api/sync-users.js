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

function normalizeProducts(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

async function listAllAuthUsers(adminClient) {
  const users = []
  let page = 1
  const perPage = 100
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
    page += 1
  }
  return users
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
    return json(res, 403, { error: 'Only admins can sync users' })
  }

  try {
    const authUsers = await listAllAuthUsers(adminClient)

    const results = []
    for (const authUser of authUsers) {
      const nomeBase = String(authUser.user_metadata?.nome || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')?.[0] || 'Usuario').trim()
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id, avatar_url, is_admin, areas_atuacao, comercial_produtos')
        .eq('id', authUser.id)
        .maybeSingle()

      const profilePayload = {
        id: authUser.id,
        nome: nomeBase,
        orcamentista_label: buildOrcamentistaLabel(nomeBase, authUser.email),
        avatar_url: existingProfile?.avatar_url || null,
        is_admin: Boolean(existingProfile?.is_admin),
        areas_atuacao: normalizeAreas(existingProfile?.areas_atuacao),
        comercial_produtos: normalizeProducts(existingProfile?.comercial_produtos),
      }

      const { error } = await adminClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' })

      if (error) {
        results.push({ email: authUser.email, ok: false, error: error.message })
      } else {
        results.push({ email: authUser.email, ok: true })
      }
    }

    return json(res, 200, {
      ok: true,
      synced: results.filter(r => r.ok).length,
      total: results.length,
      results,
    })
  } catch (error) {
    return json(res, 500, { error: error.message })
  }
}
