import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeDisplayText } from '../lib/text'

const AuthContext = createContext(null)

const ADMIN_EMAILS = new Set([
  'atendimento2@convesseguros.com',
  'atendimento@convesseguros.com',
])

function resolveAdminFlag(email, profileAdmin) {
  return Boolean(profileAdmin) || ADMIN_EMAILS.has(String(email || '').toLowerCase())
}

function buildOrcamentistaLabel(nome, email) {
  const base = normalizeDisplayText(nome) || normalizeDisplayText(email?.split('@')?.[0]) || 'ORCAMENTISTA'
  return base.toUpperCase()
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, orcamentista_label, avatar_url, is_admin')
      .eq('id', userId)
      .single()

    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!data && currentUser?.id) {
      const nomeBase = normalizeDisplayText(currentUser.user_metadata?.nome || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')?.[0]) || 'Usuario'
      const payload = {
        id: currentUser.id,
        nome: nomeBase,
        orcamentista_label: buildOrcamentistaLabel(nomeBase, currentUser.email),
        avatar_url: null,
        areas_atuacao: [],
        is_admin: resolveAdminFlag(currentUser.email, false),
      }

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert(payload)
        .select('id, nome, orcamentista_label, avatar_url, is_admin')
        .single()

      if (!createError && created) {
        setProfile({ ...created, is_admin: resolveAdminFlag(currentUser.email, created.is_admin) })
        setLoading(false)
        return
      }
    }

    setProfile(data ? { ...data, is_admin: resolveAdminFlag(currentUser?.email, data.is_admin) } : data)
    setLoading(false)
  }

  async function refreshProfile() {
    if (!user?.id) return
    await loadProfile(user.id)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signUp({ nome, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
      },
    })

    if (error) return { error }

    const signedUser = data?.user
    if (signedUser?.id) {
      const nomeBase = normalizeDisplayText(nome) || normalizeDisplayText(email?.split('@')?.[0]) || 'Usuario'
      const payload = {
        id: signedUser.id,
        nome: nomeBase,
        orcamentista_label: buildOrcamentistaLabel(nomeBase, email),
        avatar_url: null,
        areas_atuacao: [],
        is_admin: resolveAdminFlag(email, false),
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })

      if (profileError) return { error: profileError }
    }

    return { data }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
