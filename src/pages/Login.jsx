import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, signIn, signUp, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl border border-dark-border bg-dark-surface/80 px-6 py-5 text-sm text-dark-muted shadow-lg">
          Carregando autenticacao...
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    if (mode === 'register') {
      const trimmedName = nome.trim()
      if (!trimmedName) {
        setError('Informe seu nome para criar o perfil')
        setSubmitting(false)
        return
      }

      const result = await signUp({ nome: trimmedName, email: email.trim(), password })
      if (result?.error) {
        setError(result.error.message || 'Nao foi possivel criar a conta')
        setSubmitting(false)
        return
      }

      if (!result?.data?.session) {
        setError('Conta criada. Verifique seu email para confirmar o acesso.')
        setSubmitting(false)
        return
      }

      navigate('/', { replace: true })
      return
    }

    const authError = await signIn(email.trim(), password)
    if (authError) {
      setError(authError.message || 'Nao foi possivel entrar')
      setSubmitting(false)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="login-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="login-shell grid w-full max-w-5xl gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="login-intro dashboard-hero flex flex-col justify-between p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-status-info/20 bg-status-info/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-status-info">
              <Sparkles className="h-3.5 w-3.5" />
              Conves Hub
            </div>
            <h1 className="title-display text-dark-text">Acesso operacional</h1>
            <p className="max-w-xl text-sm leading-relaxed text-dark-muted">
              Entre para usar a mesa operacional, o CRM comercial e o módulo Seguro Auto em um único sistema.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="dashboard-hero-chip rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Mesa</p>
              <p className="mt-1 text-sm font-semibold text-dark-text">Fichas e apólices</p>
            </div>
            <div className="dashboard-hero-chip rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comercial</p>
              <p className="mt-1 text-sm font-semibold text-dark-text">Pipeline e jornadas</p>
            </div>
            <div className="dashboard-hero-chip rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Auto</p>
              <p className="mt-1 text-sm font-semibold text-dark-text">Renovações e emissões</p>
            </div>
          </div>
        </section>

        <section className="login-card glass-modal p-8">
          <div className="mb-6">
            <p className="eyebrow">Login</p>
            <h2 className="title-section mt-2">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-dark-muted">Use sua conta do Supabase Auth para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="input"
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Senha</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-status-danger/20 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? (mode === 'register' ? 'Criando...' : 'Entrando...') : (mode === 'register' ? 'Criar conta' : 'Entrar')}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
              }}
              className="w-full rounded-2xl border border-dark-border px-4 py-3 text-sm font-medium text-dark-muted transition-colors hover:text-dark-text hover:border-status-info/40"
            >
              {mode === 'login' ? 'Quero me cadastrar' : 'Já tenho conta'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
