import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

export default function Login() {
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError('Email ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — identidade ─────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 w-[42%] flex-shrink-0 relative overflow-hidden"
        style={{ background: '#0f172a' }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(74,144,217,0.12), transparent 70%)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/10">
            <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Conves</p>
            <p className="text-[10px] text-white/40">Corretora de Seguros</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative space-y-4">
          <h1 className="text-3xl font-bold text-white leading-tight">
            Gestão de fichas<br />
            <span className="text-brand-accent">simplificada</span>
          </h1>
          <p className="text-sm text-white/50 leading-relaxed max-w-xs">
            Substitui planilhas por um sistema estruturado. Acompanhe cotações, emissões e a jornada de cada cliente.
          </p>

          {/* Feature list */}
          <div className="space-y-2.5 pt-2">
            {[
              'Pipeline comercial com Kanban',
              'Gestão de apólices em tempo real',
              'Relatórios e métricas por período',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-accent/15 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3 h-3 text-brand-accent" />
                </div>
                <span className="text-xs text-white/60">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-[10px] text-white/20">
          Acesso restrito — Conves Corretora © {new Date().getFullYear()}
        </p>
      </div>

      {/* ── Painel direito — formulário ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-dark-bg">
        <div className="w-full max-w-sm animate-fade-in">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-dark-border">
              <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-dark-text">Conves</p>
              <p className="text-[10px] text-dark-muted">Sistema de Fichas</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-dark-text mb-1">Entrar</h2>
          <p className="text-sm text-dark-muted mb-7">Use suas credenciais de acesso</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-dark-muted uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="input pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-dark-muted uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-1 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-dark-muted/40 text-[11px] mt-8">
            Contate o administrador para recuperar seu acesso
          </p>
        </div>
      </div>
    </div>
  )
}
