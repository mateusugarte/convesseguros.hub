import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import { canManageCommercial, initComercialStore } from '../lib/comercial'
import { Avatar } from './ui'
import CommandPalette from './CommandPalette'
import { PageTransition } from './PageTransition'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  LayoutDashboard, FileText, User, FileCheck,
  Building2, BarChart2, Settings, Search,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu,
  Sun, Moon, Shield, TrendingUp,
  ChevronDown, FolderOpen, Calendar, RefreshCw, Car, Coins,
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
      { to: '/financeiro', icon: Coins, label: 'Financeiro', adminOnly: true },
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
          { to: '/auto/gestao',          label: 'Gestao AUTO' },
          { to: '/auto/cotacoes',        label: 'Cotacoes' },
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
          { to: '/comercial/gestao', label: 'Gestao Comercial', managerOnly: true },
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
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [hideWorkspaceTopbar, setHideWorkspaceTopbar] = useState(false)
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

  const profileAreas = Array.isArray(profile?.areas_atuacao) ? profile.areas_atuacao : []
  const hasArea = area => profileAreas.includes(area)

  function pushNotification(notification) {
    setNotifications(prev => {
      const next = [{
        id: notification.id || `${Date.now()}-${Math.random()}`,
        created_at: notification.created_at || new Date().toISOString(),
        type: notification.type || 'info',
        title: notification.title || '',
        message: notification.message || '',
        href: notification.href || null,
      }, ...prev]
      return next.slice(0, 20)
    })
  }

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
    if (!user?.id) {
      setNotifications([])
      return
    }

    try {
      const raw = localStorage.getItem(`layout-notifications-${user.id}`)
      const parsed = raw ? JSON.parse(raw) : []
      setNotifications(Array.isArray(parsed) ? parsed : [])
    } catch {
      setNotifications([])
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`layout-notifications-${user.id}`, JSON.stringify(notifications.slice(0, 20)))
    } catch {}
  }, [notifications, user?.id])

  useEffect(() => {
    if (!user?.id) return undefined

    const ch = supabase.channel(`layout-notificacoes-${user.id}`)

    if (hasArea('orcamentista')) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fichas' }, p => {
        const prodLabel = PRODUTO_LABELS[p.new.produto] || p.new.produto || ''
        setAbertasCount(n => n + 1)
        pushNotification({
          id: `ficha-${p.new.id}`,
          created_at: p.new.created_at,
          type: 'ficha',
          title: prodLabel || 'Nova ficha',
          message: `${p.new.imobiliaria || ''} · ${p.new.nome_interessado || 'Sem nome'}`,
          href: `/fichas/${p.new.id}`,
        })
        toast({
          type: 'ficha',
          title: prodLabel || 'Nova ficha',
          message: `${p.new.imobiliaria || ''} · ${p.new.nome_interessado || 'Sem nome'}`,
          action: { label: 'Ver ficha', onClick: () => navigate(`/fichas/${p.new.id}`) },
          duration: 10000,
        })
      })
    }

    if (hasArea('auto')) {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cotacoes_auto' }, p => {
        const cliente = p.new.nome_cliente || p.new.nome_completo || p.new.cpf_cliente || 'Novo seguro auto'
        pushNotification({
          id: `auto-${p.new.id}`,
          created_at: p.new.created_at,
          type: 'auto',
          title: 'Novo seguro auto',
          message: `${cliente}${p.new.modelo_veiculo ? ` · ${p.new.modelo_veiculo}` : ''}`,
          href: `/auto/cotacoes/${p.new.id}`,
        })
        toast({
          type: 'auto',
          title: 'Novo seguro auto',
          message: `${cliente}${p.new.modelo_veiculo ? ` · ${p.new.modelo_veiculo}` : ''}`,
          action: { label: 'Abrir cotação', onClick: () => navigate(`/auto/cotacoes/${p.new.id}`) },
          duration: 10000,
        })
      })
    }

    ch.subscribe()
    return () => supabase.removeChannel(ch)
  }, [toast, navigate, user?.id, profileAreas.join('|')])

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
    function onToggleShell(event) {
      setHideWorkspaceTopbar(Boolean(event?.detail?.hidden))
    }

    window.addEventListener('workspace-shell-toggle', onToggleShell)
    return () => window.removeEventListener('workspace-shell-toggle', onToggleShell)
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
    <div className={`relative flex h-[100dvh] min-h-[100dvh] overflow-hidden ${shellClassName} ${!isMobile ? 'lg:gap-4' : ''}`}>
      {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-[300]"
            style={{
              background: 'rgba(248, 250, 255, 0.97)',
              backdropFilter: 'blur(96px) saturate(110%)',
              WebkitBackdropFilter: 'blur(96px) saturate(110%)',
            }}
            onClick={() => setSidebarOpen(false)}
          />
      )}

      <aside
        className={`shell-sidebar ${isMobile
          ? `fixed left-0 top-0 h-full z-[400] transition-[width,transform] duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'sticky top-0 z-[200] h-[100dvh] shrink-0 transition-[width,box-shadow,transform] duration-300'
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
                if (item.adminOnly && !profile?.is_admin) return null
                if (item.managerOnly && !canManageCommercial(profile)) return null
                const Icon = item.icon

                if (item.subitems) {
                  const isExpanded = expandedItems.has(item.to)
                  const isActive = location.pathname.startsWith(item.to)
                  return (
                    <div key={item.to}>
                      <button
                        onClick={() => toggleExpand(item.to)}
                        title={(!sidebarOpen && !isMobile) ? item.label : undefined}
                        className={`shell-nav-item w-full flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-250 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-dark-text pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 px-3'} ${(!sidebarOpen && !isMobile) ? 'justify-center px-3' : ''}`}
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
                          {item.subitems.map(sub => {
                            if (sub.managerOnly && !canManageCommercial(profile)) return null
                            return (
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
                            )
                          })}
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
                      `shell-nav-item flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-250 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-dark-text pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 hover:translate-x-0.5 px-3'} ${(!sidebarOpen && !isMobile) ? 'justify-center px-3' : ''}`
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

      <div className="flex min-w-0 min-h-0 flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        {!hideWorkspaceTopbar && (
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

            <div className="relative">
            <button
              onClick={() => { setNotificationsOpen(o => !o); setUserMenuOpen(false) }}
              className="btn-ghost p-2 relative rounded-lg cursor-pointer"
              aria-label="Notificacoes"
              aria-expanded={notificationsOpen}
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-warning px-1 text-[9px] font-bold text-white">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-[399]" onClick={() => setNotificationsOpen(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 w-[360px] z-[400] overflow-hidden rounded-2xl border py-1 animate-slide-up"
                    style={{
                      background: 'var(--shell-panel-bg)',
                      backdropFilter: 'blur(18px) saturate(170%)',
                      WebkitBackdropFilter: 'blur(18px) saturate(170%)',
                      border: '1px solid var(--shell-panel-border)',
                      boxShadow: 'var(--shadow-float)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-dark-border px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-text">Notificações</p>
                        <p className="text-xs text-dark-muted">Últimos eventos recebidos</p>
                      </div>
                      {notifications.length > 0 && (
                        <span className="badge badge-info">{notifications.length}</span>
                      )}
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {notifications.length ? (
                        notifications.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false)
                              if (item.href) navigate(item.href)
                            }}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-dark-surface2/60 transition-colors"
                          >
                            <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ${
                              item.type === 'auto'
                                ? 'border-brand-accent/20 bg-brand-accent/10 text-brand-accent'
                                : 'border-status-success/20 bg-status-success/10 text-status-success'
                            }`}>
                              <Bell className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-dark-text truncate">{item.title}</p>
                                <span className="text-[10px] text-dark-muted whitespace-nowrap">
                                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                              <p
                                className="mt-1 text-xs text-dark-muted"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {item.message}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <p className="text-sm font-medium text-dark-text">Sem notificações</p>
                          <p className="mt-1 text-xs text-dark-muted">Os eventos recentes aparecem aqui.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

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
        )}

        <main className={`flex-1 min-h-0 overflow-y-auto overscroll-contain bg-transparent ${hideWorkspaceTopbar ? 'pt-0' : 'pt-4'}`}>
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
        onOpenApolice={id => { navigate(`/apolices/${id}`); setCmdOpen(false) }}
      />
    </div>
  )
}
