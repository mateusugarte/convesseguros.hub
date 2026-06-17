import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import { initComercialStore } from '../lib/comercial'
import { Avatar } from './ui'
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
      {
        to: '/fichas',
        icon: FileText,
        label: 'Fichas',
        subitems: [
          { to: '/fichas', label: 'Geral', end: true },
          { to: '/fichas/residencial', label: 'Residencial' },
          { to: '/fichas/comercial-pf', label: 'Comercial PF' },
          { to: '/fichas/pessoa-juridica', label: 'Pessoa Jurídica' },
        ],
      },
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
          { to: '/auto',                 label: 'Dashboard', end: true },
          { to: '/auto/renovacoes',      label: 'Renovacoes' },
          { to: '/auto/emissoes',        label: 'Emissoes' },
          { to: '/auto/clientes',        label: 'Clientes' },
          { to: '/auto/sinistros',       label: 'Sinistros' },
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
    if (location.pathname.startsWith('/fichas')) initial.add('/fichas')
    if (location.pathname.startsWith('/apolices')) initial.add('/apolices')
    if (location.pathname.startsWith('/comercial')) initial.add('/comercial')
    if (location.pathname.startsWith('/auto')) initial.add('/auto')
    return initial
  })

  const isCommercialRoute = location.pathname.startsWith('/comercial')
  const isJornadasRoute = location.pathname.startsWith('/comercial/jornadas')
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
      if (location.pathname.startsWith('/fichas')) next.add('/fichas')
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

  const sidebarWidth = isMobile ? 'w-72' : sidebarOpen ? 'w-[284px]' : 'w-[92px]'
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
    <div className={`relative flex h-screen overflow-hidden ${shellClassName} ${!isMobile ? 'lg:gap-4' : ''}`}>
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/35 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`shell-sidebar ${isMobile
          ? `fixed left-0 top-0 h-full z-[400] transition-[width,transform] duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'relative z-[200] h-full shrink-0 transition-[width] duration-200'
        } flex flex-col ${sidebarWidth}`}
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
            <div className="shell-sidebar-card rounded-[28px] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dark-muted mb-1">{workspaceLabel}</p>
                  <p className="text-sm font-semibold text-dark-text leading-tight">{workspaceTitle}</p>
                </div>
                <span className="badge badge-info shrink-0">Live</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-dark-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                <span className="truncate">{workspaceLead}</span>
                <span className="ml-auto shrink-0 rounded-full border border-dark-border/70 px-2 py-0.5 text-[10px] font-semibold text-dark-muted">
                  {abertasCount} em cotação
                </span>
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
          <Avatar
            name={profile?.nome}
            src={profile?.avatar_url || ''}
            size="md"
            className="ring-1 ring-white/20 shadow-sm"
          />
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

      <div className="flex min-w-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <header className="shell-topbar sticky top-3 z-[300] h-16 flex items-center justify-between px-5 flex-shrink-0 topbar-glass rounded-[28px]" style={shellTopbarStyle}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="btn-ghost shell-toolbar-button p-2 cursor-pointer"
              aria-label="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {!isJornadasRoute && (
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
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isJornadasRoute && (
              <button onClick={() => setCmdOpen(true)} className="md:hidden btn-ghost p-2 cursor-pointer">
                <Search className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="btn-ghost p-2 rounded-lg cursor-pointer"
              title={theme === 'dark' ? 'Voltar para o tema claro' : 'Ativar tema escuro'}
              aria-label={theme === 'dark' ? 'Voltar para o tema claro' : 'Ativar tema escuro'}
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
                <Avatar
                  name={profile?.nome}
                  src={profile?.avatar_url || ''}
                  size="sm"
                  className="ring-1 ring-white/20 shadow-sm"
                />
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

        <main className="flex-1 overflow-y-auto bg-transparent pt-4">
          <div className="mx-auto w-full min-w-0 max-w-[1720px] pb-20">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onOpenFicha={id => { navigate(`/fichas/${id}`); setCmdOpen(false) }}
      />
    </div>
  )
}
