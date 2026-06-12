import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    if (err) setError('Email ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,144,217,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(201,168,76,0.10),transparent_30%)]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5" />
      </div>

      <div className="relative min-h-screen grid lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-[linear-gradient(145deg,rgba(6,11,26,0.98),rgba(10,24,58,0.96)_55%,rgba(8,16,44,0.98))]">
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="absolute -top-24 left-12 w-72 h-72 rounded-full bg-brand-accent/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl" />
          </div>

          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-glow">
              <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Conves</p>
              <p className="text-[10px] tracking-[0.18em] uppercase text-white/40">Sistema operacional</p>
            </div>
          </div>

          <div className="relative space-y-6 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-gold" />
              Operação segura e centralizada
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-white leading-[0.98] tracking-[-0.04em]">
                Gestão de fichas
                <span className="block text-brand-accent">com mais clareza.</span>
              </h1>
              <p className="max-w-lg text-sm leading-6 text-white/62">
                Um painel único para fichas, apólices e comercial. Menos ruído visual, mais foco no que precisa acontecer agora.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Kanban', 'Fluxo visual para operação diária'],
                ['Apólices', 'Acompanhamento sem perder contexto'],
                ['Relatórios', 'Indicadores com leitura rápida'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-white/58">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-between gap-4 border-t border-white/8 pt-6">
            <p className="text-[10px] text-white/28">Acesso restrito • Conves Corretora © {new Date().getFullYear()}</p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-accent shadow-glow-sm" />
              <span className="h-2 w-16 rounded-full bg-gradient-to-r from-brand-accent to-brand-gold" />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl overflow-hidden ring-1 ring-dark-border shadow-sm">
                <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold text-dark-text">Conves</p>
                <p className="text-[10px] text-dark-muted uppercase tracking-[0.16em]">Sistema de Fichas</p>
              </div>
            </div>

            <div className="glass-modal p-6 sm:p-8 shadow-modal">
              <div className="space-y-2 mb-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Acesso ao painel</p>
                <h2 className="text-2xl font-bold text-dark-text">Entrar</h2>
                <p className="text-sm text-dark-muted">Use suas credenciais para continuar.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-dark-muted uppercase tracking-[0.14em]">Email</label>
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

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-dark-muted uppercase tracking-[0.14em]">Senha</label>
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

                {error && (
                  <div className="flex items-center gap-2 text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-xl px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3 mt-1 cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </span>
                  ) : 'Entrar'}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-dark-border bg-dark-surface2/70 px-4 py-3">
                <p className="text-xs text-dark-muted leading-5">
                  Dica: mantenha a sessão limpa ao trocar de dispositivo. Se houver problema de acesso, fale com o administrador.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
