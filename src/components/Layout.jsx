import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import CommandPalette from './CommandPalette'
import {
  LayoutDashboard, FileText, User, FileCheck,
  Building2, BarChart2, Settings, Search,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu,
  Sun, Moon,
} from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',          end: true },
  { to: '/fichas',       icon: FileText,        label: 'Fichas' },
  { to: '/minhas-fichas',icon: User,            label: 'Minhas Fichas' },
  { to: '/emissoes',     icon: FileCheck,       label: 'Gestão de Emissões', soon: true },
  { to: '/imobiliarias', icon: Building2,       label: 'Imobiliárias',       soon: true },
  { to: '/relatorios',   icon: BarChart2,       label: 'Relatórios',         soon: true },
  { to: '/configuracoes',icon: Settings,        label: 'Configurações',      soon: true },
]

function initials(nome) {
  if (!nome) return '??'
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function stringColor(str) {
  const colors = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

export default function Layout() {
  const { profile, signOut, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen,   setSidebarOpen]   = useState(true)
  const [abertasCount,  setAbertasCount]  = useState(0)
  const [cmdOpen,       setCmdOpen]       = useState(false)
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)
  const [fichaDetalhe,  setFichaDetalhe]  = useState(null)

  useEffect(() => {
    if (user) fetchContagemAbertaOrcamentista(user.id).then(setAbertasCount)
  }, [user])

  // Supabase realtime — new ficha toast
  useEffect(() => {
    const ch = supabase.channel('layout-fichas-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas' }, p => {
        const prodLabel = PRODUTO_LABELS[p.new.produto] || p.new.produto || ''
        setAbertasCount(n => n + 1)
        toast({
          type: 'info',
          title: `Nova ficha — ${prodLabel}`,
          message: `${p.new.imobiliaria || ''} · ${p.new.nome_interessado || 'Sem nome'}`,
          action: { label: 'Ver ficha', onClick: () => setFichaDetalhe(p.new.id) },
          duration: 8000,
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [toast])

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const avatarColor = stringColor(profile?.nome || '')

  return (
    <div className="flex h-screen bg-dark-bg overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col bg-dark-surface border-r border-dark-border transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-dark-border ${!sidebarOpen && 'justify-center px-2'}`}>
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 border border-dark-border shadow-glow-sm">
            <img src={LOGO} alt="Conves" className="w-full h-full object-cover" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-dark-text leading-none">Conves</p>
              <p className="text-[10px] text-dark-muted">Seguros</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon
            if (item.soon) {
              return (
                <div
                  key={item.to}
                  className={`nav-item nav-item-disabled ${!sidebarOpen && 'justify-center px-0'}`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-sm truncate">{item.label}</span>
                      <span className="badge-soon">Em Breve</span>
                    </>
                  )}
                </div>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={!sidebarOpen ? item.label : undefined}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'} ${!sidebarOpen ? 'justify-center px-0' : ''}`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="flex-1 text-sm truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User footer */}
        <div className={`border-t border-dark-border px-3 py-3 ${!sidebarOpen ? 'flex justify-center' : 'flex items-center gap-2.5'}`}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: avatarColor }}
          >
            {initials(profile?.nome)}
          </div>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-dark-text truncate">{profile?.nome}</p>
              {abertasCount > 0 && (
                <p className="text-[10px] text-status-warning">{abertasCount} em cotação</p>
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-dark-surface2 border border-dark-border flex items-center justify-center text-dark-muted hover:text-dark-text hover:border-brand-accent transition-all z-50 shadow-md"
        >
          {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-16'}`}>

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-5 border-b border-dark-border bg-dark-surface/90 backdrop-blur-xl">

          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className="btn-ghost p-2">
              <Menu className="w-4 h-4" />
            </button>

            {/* Search trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dark-border bg-dark-surface2 text-dark-muted text-sm hover:border-brand-accent/50 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Buscar fichas...</span>
              <kbd className="ml-4 text-[10px] border border-dark-border rounded px-1.5 py-0.5 text-dark-muted/60">Ctrl K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile search */}
            <button onClick={() => setCmdOpen(true)} className="md:hidden btn-ghost p-2">
              <Search className="w-4 h-4" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2"
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-brand-gold" />
                : <Moon className="w-4 h-4 text-brand-accent" />
              }
            </button>

            {/* Notifications bell */}
            <button className="btn-ghost p-2 relative">
              <Bell className="w-4 h-4" />
              {abertasCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-status-warning" />
              )}
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg border border-dark-border bg-dark-surface2 hover:border-brand-accent/50 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor }}
                >
                  {initials(profile?.nome)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-dark-text leading-none">{profile?.nome}</p>
                  {abertasCount > 0 && (
                    <p className="text-[10px] text-status-warning mt-0.5">{abertasCount} em aberto</p>
                  )}
                </div>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-dark-surface border border-dark-border rounded-xl shadow-2xl z-50 py-1 animate-slide-up">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/minhas-fichas') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-text hover:bg-dark-surface2 transition-colors"
                    >
                      <User className="w-4 h-4 text-dark-muted" />
                      Minhas Fichas
                    </button>
                    <div className="border-t border-dark-border my-1" />
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-status-danger hover:bg-dark-surface2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenFicha={id => { setCmdOpen(false); setFichaDetalhe(id) }}
      />

      {/* Ficha detail from cmd palette */}
      {fichaDetalhe && (
        <LazyDetalhesFicha id={fichaDetalhe} onClose={() => setFichaDetalhe(null)} />
      )}
    </div>
  )
}

function LazyDetalhesFicha({ id, onClose }) {
  const [Comp, setComp] = useState(null)
  useEffect(() => {
    import('./DetalhesFicha').then(m => setComp(() => m.default))
  }, [])
  if (!Comp) return null
  return <Comp id={id} onClose={onClose} onEdit={() => onClose()} onDelete={async () => { onClose() }} />
}
