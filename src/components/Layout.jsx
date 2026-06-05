import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import CommandPalette from './CommandPalette'
import { PageTransition } from './PageTransition'
import {
  LayoutDashboard, FileText, User, FileCheck,
  Building2, BarChart2, Settings, Search,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu,
  Sun, Moon, Shield,
} from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

// Nav items grouped by section
const NAV_GROUPS = [
  {
    items: [
      { to: '/',             icon: LayoutDashboard, label: 'Dashboard',     end: true },
      { to: '/fichas',       icon: FileText,        label: 'Fichas' },
      { to: '/minhas-fichas',icon: User,            label: 'Minhas Fichas' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        to: '/apolices', icon: FileCheck, label: 'Apólices',
        subitems: [
          { to: '/apolices',        label: 'Dashboard', end: true },
          { to: '/apolices/gestao', label: 'Gestão' },
          { to: '/apolices/lista',  label: 'Apólices' },
        ],
      },
      { to: '/imobiliarias', icon: Building2, label: 'Imobiliárias' },
      { to: '/seguradoras',  icon: Shield,    label: 'Seguradoras' },
      { to: '/relatorio',    icon: BarChart2, label: 'Relatório' },
    ],
  },
  {
    items: [
      { to: '/configuracoes', icon: Settings, label: 'Configurações', soon: true },
    ],
  },
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
  const toast    = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen,    setSidebarOpen]    = useState(true)
  const [isMobile,       setIsMobile]       = useState(false)
  const [abertasCount,   setAbertasCount]   = useState(0)
  const [cmdOpen,        setCmdOpen]        = useState(false)
  const [userMenuOpen,   setUserMenuOpen]   = useState(false)
  const [expandedItems,  setExpandedItems]  = useState(() => {
    const s = new Set()
    if (location.pathname.startsWith('/apolices')) s.add('/apolices')
    return s
  })

  // Responsive: drawer on mobile, fixed sidebar on desktop
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      setSidebarOpen(!mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (user) fetchContagemAbertaOrcamentista(user.id).then(setAbertasCount)
  }, [user])

  // Realtime — new ficha toast
  useEffect(() => {
    const ch = supabase.channel('layout-fichas-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas' }, p => {
        const prodLabel = PRODUTO_LABELS[p.new.produto] || p.new.produto || ''
        setAbertasCount(n => n + 1)
        toast({
          type: 'ficha',
          title: prodLabel || 'Novo cliente',
          message: `${p.new.imobiliaria || ''} · ${p.new.nome_interessado || 'Sem nome'}`,
          action: { label: 'Ver ficha', onClick: () => navigate(`/fichas/${p.new.id}`) },
          duration: 10000,
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [toast])

  // Ctrl+K
  useEffect(() => {
    const handler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o) } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const avatarColor = stringColor(profile?.nome || '')

  return (
    <div className="app-root flex h-screen overflow-hidden">

      {/* ── Mobile backdrop ─────────────────────────────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: 'rgba(0,10,40,0.50)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-[width,transform] duration-200 ${
          isMobile
            ? `w-64 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : sidebarOpen ? 'w-60' : 'w-16'
        }`}
        style={{
          background: 'var(--glass-bg-heavy)',
          borderRight: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 h-16 px-4 border-b border-dark-border flex-shrink-0 ${!sidebarOpen && 'justify-center px-3'}`}>
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-dark-border/60">
            <img src={LOGO} alt="Conves" className="w-full h-full object-cover" width="36" height="36" loading="eager" decoding="async" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-dark-text leading-none">Conves</p>
              <p className="text-[10px] text-dark-muted mt-0.5">Sistema de Fichas</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="nav-separator" />}
              {group.label && sidebarOpen && (
                <p className="px-4 pt-1 pb-2 text-[10px] font-semibold text-dark-muted/60 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              {group.items.map(item => {
                const Icon = item.icon

                // Item com subitems (expandível)
                if (item.subitems) {
                  const isExpanded = expandedItems.has(item.to)
                  const isActive   = location.pathname.startsWith(item.to)
                  function toggleExpand() {
                    setExpandedItems(prev => {
                      const next = new Set(prev)
                      if (next.has(item.to)) next.delete(item.to)
                      else next.add(item.to)
                      return next
                    })
                  }
                  return (
                    <div key={item.to}>
                      <button
                        onClick={toggleExpand}
                        title={!sidebarOpen ? item.label : undefined}
                        className={`nav-item w-full ${isActive ? 'nav-item-active' : 'nav-item-inactive'} ${!sidebarOpen ? 'justify-center' : ''}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 text-sm truncate">{item.label}</span>
                            <ChevronRight className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </>
                        )}
                      </button>
                      {sidebarOpen && isExpanded && (
                        <div className="ml-3 mt-0.5 border-l border-dark-border/60 pl-3 space-y-0.5">
                          {item.subitems.map(sub => (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              end={sub.end}
                              className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  isActive ? 'text-brand-accent' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/80'
                                }`
                              }
                            >
                              {sub.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                if (item.soon) {
                  return (
                    <div
                      key={item.to}
                      className={`nav-item nav-item-disabled ${!sidebarOpen && 'justify-center'}`}
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
                      `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'} ${!sidebarOpen ? 'justify-center' : ''}`
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span className="flex-1 text-sm truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className={`border-t border-dark-border px-3 py-3 flex-shrink-0 ${!sidebarOpen ? 'flex justify-center' : 'flex items-center gap-2.5'}`}>
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
                <p className="text-[10px] text-status-warning mt-0.5">{abertasCount} em cotação</p>
              )}
            </div>
          )}
        </div>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="absolute -right-3 top-[72px] w-6 h-6 rounded-full flex items-center justify-center text-dark-muted hover:text-dark-text transition-all z-50"
            style={{
              background: 'var(--glass-bg-heavy)',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${
        isMobile ? 'ml-0' : sidebarOpen ? 'ml-60' : 'ml-16'
      }`}>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-30 h-16 flex items-center justify-between px-5 flex-shrink-0"
          style={{
            background: 'var(--glass-bg-strong)',
            borderBottom: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(o => !o)} className="btn-ghost p-2">
              <Menu className="w-4 h-4" />
            </button>

            {/* Search trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-dark-border bg-dark-surface2 text-dark-muted hover:border-brand-accent/50 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs text-dark-muted">Buscar fichas...</span>
              <kbd className="ml-4 text-[10px] border border-dark-border rounded px-1.5 py-0.5 text-dark-muted/50">Ctrl K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile search */}
            <button onClick={() => setCmdOpen(true)} className="md:hidden btn-ghost p-2">
              <Search className="w-4 h-4" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-brand-gold" />
                : <Moon className="w-4 h-4 text-brand-accent" />
              }
            </button>

            {/* Bell */}
            <button className="btn-ghost p-2 relative rounded-lg">
              <Bell className="w-4 h-4" />
              {abertasCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-status-warning" />
              )}
            </button>

            {/* User menu */}
            <div className="relative ml-1">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg border border-dark-border bg-dark-surface2 hover:border-brand-accent/50 transition-colors"
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
                  <div
                    className="absolute right-0 top-full mt-2 w-48 z-50 py-1 animate-slide-up overflow-hidden rounded-xl"
                    style={{
                      background: 'var(--glass-bg-heavy)',
                      backdropFilter: 'var(--glass-blur-strong)',
                      WebkitBackdropFilter: 'var(--glass-blur-strong)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: 'var(--glass-shadow-deep)',
                    }}
                  >
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
          <div className="p-6 max-w-screen-2xl mx-auto">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenFicha={id => { setCmdOpen(false); navigate(`/fichas/${id}`) }}
      />

    </div>
  )
}
