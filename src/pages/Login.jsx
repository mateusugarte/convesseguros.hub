import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

export default function Login() {
  const { signIn } = useAuth()
  const { theme }  = useTheme()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const isDark = theme === 'dark'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError('Email ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0A0F1E 0%, #0f1a35 50%, #0A0F1E 100%)'
          : 'linear-gradient(135deg, #F0F4FF 0%, #E0EAFF 50%, #F0F4FF 100%)',
      }}
    >
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(74,144,217,0.4)' : 'rgba(43,91,168,0.25)'} 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
           style={{ background: 'radial-gradient(circle, #2B5BA8, transparent)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
           style={{ background: 'radial-gradient(circle, #4A90D9, transparent)' }} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm animate-fade-in">
        <div
          className="rounded-2xl border border-dark-border/60 p-8 space-y-6 shadow-2xl transition-colors duration-300"
          style={{
            background:    isDark ? 'rgba(17,24,39,0.85)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo + title */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 rounded-2xl overflow-hidden border border-dark-border/60 shadow-glow">
              <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-dark-text">Conves Seguros</h1>
              <p className="text-sm text-dark-muted mt-0.5">Sistema de Gestão de Fichas</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-muted mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: loading ? 'rgba(43,91,168,0.5)' : 'linear-gradient(135deg, #2B5BA8, #4A90D9)' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-dark-muted/50 text-xs mt-5">
          Acesso restrito — contate o administrador
        </p>
      </div>
    </div>
  )
}
