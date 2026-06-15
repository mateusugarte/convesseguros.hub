import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import { initComercialStore } from '../lib/comercial'
import CommandPalette from './CommandPalette'
import { PageTransition } from './PageTransition'
import {
  LayoutDashboard, FileText, User, FileCheck,
  Building2, BarChart2, Settings, Search,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu,
  Sun, Moon, Shield, TrendingUp,
  ChevronDown, FolderOpen, Calendar, RefreshCw, Car,
} from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

const NAV_GROUPS = [
  {
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/fichas', icon: FileText, label: 'Fichas' },
      { to: '/minhas-fichas', icon: User, label: 'Minhas Fichas' },
    ],
  },
  {
    label: 'Gestao',
    items: [
      {
        to: '/apolices',
        icon: FileCheck,
        label: 'Apolices',
        subitems: [
          { to: '/apolices', label: 'Dashboard', end: true },
          { to: '/apolices/gestao', label: 'Gestao' },
          { to: '/apolices/lista', label: 'Pesquisa' },
        ],
      },
      { to: '/imobiliarias', icon: Building2, label: 'Imobiliarias' },
      { to: '/seguradoras', icon: Shield, label: 'Seguradoras' },
      { to: '/relatorio', icon: BarChart2, label: 'Relatorios' },
    ],
  },
  {
    label: 'Auto',
    items: [
      {
        to: '/auto',
        icon: Car,
        label: 'Seguro Auto',
        subitems: [
          { to: '/auto',            label: 'Dashboard', end: true },
          { to: '/auto/renovacoes', label: 'Renovacoes' },
          { to: '/auto/emissoes',   label: 'Emissoes' },
          { to: '/auto/cotacoes',   label: 'Cotacoes' },
          { to: '/auto/sinistros',  label: 'Sinistros' },
        ],
      },
    ],
  },
  {
    label: 'Area Comercial',
    items: [
      {
        to: '/comercial',
        icon: TrendingUp,
        label: 'Comercial',
        subitems: [
          { to: '/comercial', label: 'Dashboard', end: true },
          { to: '/comercial/pipeline', label: 'Pipeline' },
          { to: '/comercial/leads', label: 'Base de Leads' },
          { to: '/comercial/vendas', label: 'Vendas' },
          { to: '/comercial/calendario', label: 'Calendario' },
          { to: '/comercial/jornadas', label: 'Jornadas' },
        ],
      },
      { to: '/renovacoes', icon: RefreshCw, label: 'Renovacoes', soon: true },
      { to: '/calendario', icon: Calendar, label: 'Calendario', soon: true },
      { to: '/materiais', icon: FolderOpen, label: 'Materiais', soon: true },
    ],
  },
  {
    items: [
      { to: '/configuracoes', icon: Settings, label: 'Configuracoes' },
    ],
  },
]

function initials(nome) {
  if (!nome) return '??'
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function stringColor(str) {
  const colors = ['#4A90D9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#2B5BA8']
  let h = 0
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

export default function Layout() {
  const { profile, signOut, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sidebar-open') !== 'false' } catch { return true }
  })
  const [isMobile, setIsMobile] = useState(false)
  const [abertasCount, setAbertasCount] = useState(0)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState(() => {
    const initial = new Set()
    if (location.pathname.startsWith('/apolices')) initial.add('/apolices')
    if (location.pathname.startsWith('/comercial')) initial.add('/comercial')
    if (location.pathname.startsWith('/auto')) initial.add('/auto')
    return initial
  })

  const avatarColor = profile?.avatar_url || stringColor(profile?.nome || '')
  const isCommercialRoute = location.pathname.startsWith('/comercial')
  const shellClassName = isCommercialRoute ? 'crm-shell' : 'ops-shell'
  const workspaceLabel = isCommercialRoute ? 'CRM comercial' : 'Core ops'
  const workspaceTitle = isCommercialRoute ? 'Painel comercial em operacao.' : 'Central operacional premium.'
  const workspaceLead = isCommercialRoute
    ? 'Leads, vendas e jornadas no mesmo workspace.'
    : 'Fichas, apolices e operacao em uma unica mesa de controle.'

  useEffect(() => {
    try { localStorage.setItem('sidebar-open', String(sidebarOpen)) } catch {}
  }, [sidebarOpen])

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!user) return
    fetchContagemAbertaOrcamentista(user.id).then(setAbertasCount)
    initComercialStore(user.id)
  }, [user])

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
  }, [toast, navigate])

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (location.pathname.startsWith('/apolices')) next.add('/apolices')
      if (location.pathname.startsWith('/comercial')) next.add('/comercial')
      if (location.pathname.startsWith('/auto')) next.add('/auto')
      return next
    })
  }, [location.pathname])

  function toggleExpand(to) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(to)) next.delete(to)
      else next.add(to)
      return next
    })
  }

  const sidebarWidth = isMobile ? 'w-72' : sidebarOpen ? 'w-[272px]' : 'w-[84px]'
  const contentMargin = isMobile ? 'ml-0' : sidebarOpen ? 'ml-[272px]' : 'ml-[84px]'
  const shellSidebarStyle = {
    background: 'var(--shell-sidebar-bg)',
    borderRight: '1px solid var(--shell-sidebar-border)',
    boxShadow: 'var(--shell-sidebar-shadow)',
  }
  const shellTopbarStyle = {
    background: 'var(--shell-topbar-bg)',
    borderBottom: '1px solid var(--shell-topbar-border)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  }

  return (
    <div className={`flex h-screen overflow-hidden ${shellClassName}`}>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/35 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`shell-sidebar fixed left-0 top-0 h-full flex flex-col transition-[width,transform] duration-200 z-[400] ${sidebarWidth} ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''}`}
        style={shellSidebarStyle}
      >
        <div
          className={`flex items-center h-16 px-4 border-b flex-shrink-0 ${!sidebarOpen && !isMobile ? 'justify-center' : 'gap-3'}`}
          style={{ borderColor: 'var(--shell-panel-border)' }}
        >
          <div className="w-9 h-9 rounded-2xl overflow-hidden flex-shrink-0 ring-1 ring-black/5 shadow-sm">
            <img src={LOGO} alt="Conves" className="w-full h-full object-cover" width="32" height="32" loading="eager" />
          </div>
          {(sidebarOpen || isMobile) && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold leading-none text-dark-text" style={{ fontFamily: 'var(--font-heading)' }}>Conves</p>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0 opacity-80" />
              </div>
              <p className="text-[10px] mt-0.5 truncate tracking-[0.18em] uppercase text-dark-muted">{workspaceLabel}</p>
            </div>
          )}
        </div>

        {(sidebarOpen || isMobile) && (
          <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--shell-panel-border)' }}>
            <div className="shell-sidebar-card rounded-3xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dark-muted mb-1">{workspaceTitle}</p>
                  <p className="text-sm font-semibold text-dark-text leading-tight">{workspaceLead}</p>
                </div>
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--brand-primary-rgb) / 0.14), rgb(var(--brand-gold-rgb) / 0.22))' }}
                >
                  <TrendingUp className="w-4 h-4 text-brand-secondary" />
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden bg-dark-border/40">
                <div
                  className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-accent via-brand-secondary to-brand-gold"
                  style={{ boxShadow: '0 0 18px rgb(var(--brand-primary-rgb) / 0.26)' }}
                />
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5 scrollbar-none">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="my-2 border-t border-dark-border/30" />}
              {group.label && (sidebarOpen || isMobile) && (
                <p className="px-3 pt-1 pb-2 text-[9px] font-bold text-dark-muted uppercase tracking-[0.16em]">
                  {group.label}
                </p>
              )}

              {group.items.map(item => {
                const Icon = item.icon

                if (item.subitems) {
                  const isExpanded = expandedItems.has(item.to)
                  const isActive = location.pathname.startsWith(item.to)
                  return (
                    <div key={item.to}>
                      <button
                        onClick={() => toggleExpand(item.to)}
                        title={(!sidebarOpen && !isMobile) ? item.label : undefined}
                        className={`shell-nav-item w-full flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-dark-text pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 px-3'} ${(!sidebarOpen && !isMobile) ? 'justify-center px-3' : ''}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {(sidebarOpen || isMobile) && (
                          <>
                            <span className="flex-1 text-left truncate">{item.label}</span>
                            <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 text-dark-muted ${isExpanded ? 'rotate-180' : ''}`} />
                          </>
                        )}
                      </button>

                      {(sidebarOpen || isMobile) && isExpanded && (
                        <div className="ml-3 mt-1 border-l border-dark-border/40 pl-3 space-y-1">
                          {item.subitems.map(sub => (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              end={sub.end}
                              className={({ isActive }) =>
                                `shell-subnav-item flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${isActive ? 'shell-subnav-item-active text-brand-secondary' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60'}`
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
                      title={(!sidebarOpen && !isMobile) ? item.label : undefined}
                      className={`shell-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed min-h-[42px] text-dark-muted ${(!sidebarOpen && !isMobile) ? 'justify-center' : ''}`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {(sidebarOpen || isMobile) && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25">Em breve</span>
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
                    title={(!sidebarOpen && !isMobile) ? item.label : undefined}
                    className={({ isActive }) =>
                      `shell-nav-item flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-dark-text pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 hover:translate-x-0.5 px-3'} ${(!sidebarOpen && !isMobile) ? 'justify-center px-3' : ''}`
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {(sidebarOpen || isMobile) && <span className="flex-1 truncate">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div
          className={`shell-user-card border-t px-3 py-3 flex-shrink-0 ${(!sidebarOpen && !isMobile) ? 'flex justify-center' : 'flex items-center gap-2.5'}`}
          style={{ borderColor: 'var(--shell-panel-border)' }}
        >
          <div
            className="w-8 h-8 rounded-2xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ring-1 ring-white/20 shadow-sm"
            style={{ background: avatarColor }}
          >
            {initials(profile?.nome)}
          </div>
          {(sidebarOpen || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-dark-text truncate">{profile?.nome}</p>
              {abertasCount > 0 && (
                <p className="text-[10px] mt-0.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-brand-secondary font-semibold"
                    style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)' }}
                  >
                    {abertasCount} em cotacao
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="absolute -right-3 top-[72px] w-7 h-7 rounded-full flex items-center justify-center transition-all z-50 cursor-pointer"
            style={{
              background: 'var(--shell-panel-bg)',
              border: '1px solid var(--shell-panel-border)',
              boxShadow: 'var(--shell-panel-shadow)',
            }}
          >
            {sidebarOpen
              ? <ChevronLeft className="w-3.5 h-3.5 text-dark-muted" />
              : <ChevronRight className="w-3.5 h-3.5 text-dark-muted" />
            }
          </button>
        )}
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${contentMargin}`}>
        <header className="shell-topbar sticky top-0 z-[300] h-16 flex items-center justify-between px-5 flex-shrink-0 topbar-glass" style={shellTopbarStyle}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="btn-ghost shell-toolbar-button p-2 cursor-pointer"
              aria-label="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="shell-search-pill hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl border text-dark-muted transition-all cursor-pointer shadow-sm"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs">Buscar no workspace...</span>
              <kbd className="ml-3 text-[10px] border rounded px-1.5 py-0.5 text-dark-muted/70" style={{ borderColor: 'var(--shell-panel-border)' }}>
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setCmdOpen(true)} className="md:hidden btn-ghost p-2 cursor-pointer">
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg cursor-pointer"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4 text-brand-gold" />
                : <Moon className="w-4 h-4 text-brand-accent" />
              }
            </button>

            <button className="btn-ghost p-2 relative rounded-lg cursor-pointer" aria-label="Notificacoes">
              <Bell className="w-4 h-4" />
              {abertasCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-status-warning" />
              )}
            </button>

            <div className="relative ml-1">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="shell-user-button flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-2xl border transition-all cursor-pointer shadow-sm"
                style={{ borderColor: 'var(--shell-panel-border)' }}
              >
                <div
                  className="w-6 h-6 rounded-2xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor }}
                >
                  {initials(profile?.nome)}
                </div>
                <span className="hidden sm:block text-xs font-medium text-dark-text">{profile?.nome?.split(' ')[0]}</span>
                <ChevronDown className={`w-3 h-3 text-dark-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[399]" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 w-56 z-[400] py-1 animate-slide-up rounded-2xl overflow-hidden"
                    style={{
                      background: 'var(--shell-panel-bg)',
                      backdropFilter: 'blur(18px) saturate(170%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(170%)',
                      border: '1px solid var(--shell-panel-border)',
                      boxShadow: 'var(--shadow-float)',
                    }}
                  >
                    <div className="px-4 py-3 border-b border-dark-border">
                      <p className="text-xs font-semibold text-dark-text truncate">{profile?.nome}</p>
                      {abertasCount > 0 && (
                        <p className="text-[10px] text-status-warning mt-0.5">{abertasCount} fichas em aberto</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/minhas-fichas') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-dark-text hover:bg-dark-surface2 transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-dark-muted" />
                      Minhas Fichas
                    </button>
                    <div className="border-t border-dark-border my-1" />
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-status-danger hover:bg-dark-surface2 transition-colors cursor-pointer"
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

        <main className="flex-1 overflow-y-auto bg-dark-bg">
          <div className="w-full min-w-0 p-6 pb-20">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
