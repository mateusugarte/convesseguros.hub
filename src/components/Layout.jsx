import { lazy, Suspense, useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { fetchContagemAbertaOrcamentista, PRODUTO_LABELS } from '../lib/fichas'
import { canManageCommercial, initComercialStore } from '../lib/comercial'
import { Avatar } from './ui'
import { PageTransition } from './PageTransition'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  LayoutDashboard, FileText, User, FileCheck,
  Building2, BarChart2, Settings, Search,
  Bell, LogOut, ChevronLeft, ChevronRight, Menu,
  Sun, Moon, Shield, TrendingUp,
  ChevronDown, FolderOpen, Calendar, RefreshCw, Car, Coins,
  GraduationCap, ClipboardList,
} from 'lucide-react'

const AutoWorkspaceBar = lazy(() => import('./auto/AutoWorkspaceBar'))
const FiancaWorkspaceBar = lazy(() => import('./fianca/FiancaWorkspaceBar'))
const CommandPalette = lazy(() => import('./CommandPalette'))

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

const FIANCA_ROUTE_PREFIXES = [
  '/fichas',
  '/emissoes',
  '/minhas-fichas',
  '/relatorio',
  '/imobiliarias',
  '/seguradoras',
  '/financeiro',
  '/apolices',
]

function isFiancaPath(pathname) {
  return pathname === '/' || FIANCA_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

const NAV_GROUPS = [
  {
    label: 'Fiança',
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
      { to: '/relatorio', icon: BarChart2, label: 'Relatórios' },
      {
        to: '/apolices',
        icon: FileCheck,
        label: 'Apolices',
        subitems: [
          { to: '/apolices', label: 'Dashboard', end: true },
          { to: '/apolices/gestao', label: 'Gestão' },
          { to: '/apolices/lista', label: 'Pesquisa' },
        ],
      },
      { to: '/financeiro', icon: Coins, label: 'Financeiro', adminOnly: true },
      { to: '/imobiliarias', icon: Building2, label: 'Imobiliarias' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/seguradoras', icon: Shield, label: 'Seguradoras' },
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
          { to: '/auto',                 label: 'Visão geral', end: true },
          { to: '/auto/renovacoes',      label: 'Renovações' },
          { to: '/auto/gestao',          label: 'Pipeline' },
          { to: '/auto/cotacoes',        label: 'Cotações' },
          { to: '/auto/clientes',        label: 'Clientes' },
          { to: '/auto/emissoes',        label: 'Apólices e emissões' },
          { to: '/auto/sinistros',       label: 'Sinistros' },
          { to: '/auto/etiquetas',       label: 'Configurar etiquetas' },
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
          { to: '/comercial/calendario', label: 'Calendário' },
          { to: '/comercial/jornadas', label: 'Jornadas' },
        ],
      },
      { to: '/renovacoes', icon: RefreshCw, label: 'Renovacoes', soon: true },
      { to: '/calendario', icon: Calendar, label: 'Calendário', soon: true },
      { to: '/materiais', icon: FolderOpen, label: 'Materiais', soon: true },
    ],
  },
  {
    label: 'Treinamentos',
    items: [
      { to: '/treinamentos', icon: GraduationCap, label: 'Treinamentos', end: true },
      { to: '/treinamentos/admin', icon: ClipboardList, label: 'Gerenciar Quiz', adminOnly: true },
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
    try {
      const stored = localStorage.getItem('sidebar-open')
      if (stored !== null) return stored !== 'false'
    } catch {}
    // Sem preferência salva: em notebooks (largura < 1440px) a sidebar de
    // 284px consome espaço demais — abre já recolhida (rail de 92px) por padrão.
    if (typeof window !== 'undefined' && window.innerWidth < 1440) return false
    return true
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
  const isAutoRoute = location.pathname.startsWith('/auto')
  const isFiancaRoute = isFiancaPath(location.pathname)
  const isDashboardRoute = location.pathname === '/'
  const isJornadasRoute = location.pathname.startsWith('/comercial/jornadas')
  const shellClassName = isCommercialRoute ? 'crm-shell' : isAutoRoute ? 'auto-shell' : 'ops-shell'
  const workspaceLabel = isCommercialRoute ? 'CRM comercial' : isAutoRoute ? 'Operação Auto' : 'Core ops'
  const workspaceTitle = isCommercialRoute
    ? 'Painel comercial em operação.'
    : isAutoRoute
      ? 'Mesa de seguros em movimento.'
      : 'Central operacional premium.'
  const workspaceLead = isCommercialRoute
    ? 'Leads, vendas e jornadas no mesmo workspace.'
    : isAutoRoute
      ? 'Cotações, renovações e emissões no mesmo fluxo.'
      : 'Fichas, apólices e operação em uma única mesa de controle.'
  const workspaceCounter = isAutoRoute
    ? '8 etapas'
    : isCommercialRoute
      ? 'CRM ativo'
      : `${abertasCount} em cotação`

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
    const workspace = isFiancaRoute ? 'fianca' : isAutoRoute ? 'auto' : isCommercialRoute ? 'comercial' : 'core'
    document.documentElement.dataset.workspace = workspace
    return () => {
      if (document.documentElement.dataset.workspace === workspace) {
        delete document.documentElement.dataset.workspace
      }
    }
  }, [isFiancaRoute, isAutoRoute, isCommercialRoute])

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
  }, [user])

  // O store comercial carrega 5 tabelas inteiras (leads, vendas, eventos,
  // jornadas, scripts) sem paginação — só vale a pena buscar quando o
  // usuário de fato entra em alguma tela do módulo Comercial, não em toda
  // navegação do sistema.
  useEffect(() => {
    if (!user || !isCommercialRoute) return
    initComercialStore(user.id)
  }, [user, isCommercialRoute])

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(o => !o)
      }
      if (isFiancaRoute && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        navigate('/fichas?novo=1')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFiancaRoute, navigate])

  useEffect(() => {
    function onToggleShell(event) {
      setHideWorkspaceTopbar(Boolean(event?.detail?.hidden))
    }

    window.addEventListener('workspace-shell-toggle', onToggleShell)
    return () => window.removeEventListener('workspace-shell-toggle', onToggleShell)
  }, [])

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [location.pathname, isMobile])

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
    const shouldOpenSidebar = !sidebarOpen && !isMobile
    if (shouldOpenSidebar) setSidebarOpen(true)
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (shouldOpenSidebar) {
        next.add(to)
        return next
      }
      if (next.has(to)) next.delete(to)
      else next.add(to)
      return next
    })
  }

  const showSidebarDetails = sidebarOpen || isMobile
  const sidebarWidth = isMobile ? 'w-[min(88vw,320px)]' : 'w-full'
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
  const shellFloatingStyle = {
    background: 'var(--shell-panel-bg)',
    border: '1px solid var(--shell-panel-border)',
    boxShadow: 'var(--shadow-float)',
    backdropFilter: 'blur(18px) saturate(170%)',
    WebkitBackdropFilter: 'blur(18px) saturate(170%)',
  }

  const shellGridStyle = !isMobile
    ? { gridTemplateColumns: sidebarOpen ? '292px minmax(0, 1fr)' : '78px minmax(0, 1fr)' }
    : undefined

  return (
    <div
      className={`app-shell-root relative overflow-hidden ${isMobile ? 'block is-mobile-shell' : 'grid'} ${sidebarOpen ? 'is-sidebar-open' : 'is-sidebar-compact'} ${shellClassName}`}
      style={shellGridStyle}
    >
      {isMobile && sidebarOpen && (
          <div
            className="shell-sidebar-scrim fixed inset-0 z-[300]"
            onClick={() => setSidebarOpen(false)}
          />
      )}

      {isMobile && !sidebarOpen && (
        <button
          type="button"
          className="shell-mobile-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir navegação principal"
          aria-expanded="false"
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
        </button>
      )}

      <aside
        aria-label="Navegação principal"
        className={`shell-sidebar ${isMobile
          ? `fixed left-0 top-0 h-full z-[400] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0 is-mobile-open' : '-translate-x-full is-mobile-closed'}`
          : 'relative z-[200] h-full min-h-0'
        } flex flex-col ${sidebarWidth} ${(!sidebarOpen && !isMobile) ? 'is-collapsed' : 'is-expanded'}`}
        style={shellSidebarStyle}
      >
        <div
          className="shell-sidebar-brand flex items-center h-16 gap-3 border-b px-4 flex-shrink-0"
          style={{ borderColor: 'var(--shell-panel-border)' }}
        >
          <div className="shell-sidebar-logo w-9 h-9 rounded-2xl overflow-hidden flex-shrink-0 ring-1 ring-black/5 shadow-sm">
            <img src={LOGO} alt="Conves" className="w-full h-full object-cover" width="32" height="32" loading="eager" />
          </div>
          <div className="shell-sidebar-detail shell-sidebar-brand-copy min-w-0" aria-hidden={!showSidebarDetails}>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold leading-none text-dark-text" style={{ fontFamily: 'var(--font-heading)' }}>Conves</p>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-gold flex-shrink-0 opacity-80" />
              </div>
              <p className="text-[10px] mt-0.5 truncate tracking-[0.18em] uppercase text-dark-muted">{workspaceLabel}</p>
          </div>

          <button
            onClick={() => isMobile ? setSidebarOpen(false) : setSidebarOpen(open => !open)}
            className="shell-sidebar-toggle ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
            style={{
              background: 'var(--shell-panel-bg)',
              border: '1px solid var(--shell-panel-border)',
              boxShadow: 'var(--shell-panel-shadow)',
            }}
            title={isMobile ? 'Fechar menu' : sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            aria-label={isMobile ? 'Fechar menu' : sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={sidebarOpen}
          >
            {(isMobile || sidebarOpen)
              ? <ChevronLeft className="w-3.5 h-3.5 text-dark-muted" />
              : <ChevronRight className="w-3.5 h-3.5 text-dark-muted" />
            }
          </button>
        </div>

        <div className="shell-workspace-summary shell-sidebar-detail px-3 py-3 border-b" aria-hidden={!showSidebarDetails} style={{ borderColor: 'var(--shell-panel-border)' }}>
            <div className="shell-sidebar-card rounded-[28px] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dark-muted mb-1">{workspaceLabel}</p>
                  <p className="text-sm font-semibold text-dark-text leading-tight">{workspaceTitle}</p>
                </div>
                <span className="badge badge-info shrink-0">Ativo</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-dark-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgb(var(--brand-primary-rgb))' }} />
                <span className="truncate">{workspaceLead}</span>
                <span className="ml-auto shrink-0 rounded-full border border-dark-border/70 px-2 py-0.5 text-[10px] font-semibold text-dark-muted">
                  {workspaceCounter}
                </span>
              </div>
            </div>
        </div>

        <div className="shell-sidebar-tools">
          <button
            type="button"
            className="shell-sidebar-command"
            onClick={() => setCmdOpen(true)}
            data-label="Busca universal"
            aria-label="Abrir busca universal"
          >
            <Search aria-hidden="true" />
            <span className="shell-sidebar-detail" aria-hidden={!showSidebarDetails}>
              <strong>Busca universal</strong>
              <small>Fichas, apólices e clientes</small>
            </span>
            <kbd className="shell-sidebar-detail" aria-hidden={!showSidebarDetails}>Ctrl K</kbd>
          </button>
        </div>

        <nav aria-label="Áreas do sistema" className="shell-sidebar-nav flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="shell-nav-group">
              {gi > 0 && <div className="my-2 border-t border-dark-border/30" />}
              {group.label && (
                <p className="shell-sidebar-detail shell-nav-group-label px-3 pt-1 pb-2 text-[9px] font-bold text-dark-muted uppercase tracking-[0.16em]" aria-hidden={!showSidebarDetails}>
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
                        data-label={item.label}
                        className={`shell-nav-item w-full flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-250 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-white pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 px-3'} ${(!sidebarOpen && !isMobile) ? 'justify-center px-3' : ''}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="shell-sidebar-detail flex-1 text-left truncate" aria-hidden={!showSidebarDetails}>{item.label}</span>
                        <span className="shell-sidebar-detail" aria-hidden={!showSidebarDetails}>
                          <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 text-dark-muted ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="shell-subnav-list ml-3 mt-1 border-l border-dark-border/40 pl-3 space-y-1">
                          {item.subitems.map(sub => {
                            if (sub.managerOnly && !canManageCommercial(profile)) return null
                            return (
                            <NavLink
                              key={sub.to}
                              to={sub.to}
                              end={sub.end}
                              className={({ isActive }) =>
                                `shell-subnav-item flex items-center px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${isActive ? 'shell-subnav-item-active text-white' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60'}`
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
                        data-label={item.label}
                      className="shell-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-50 cursor-not-allowed min-h-[42px] text-dark-muted"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="shell-sidebar-detail flex-1 truncate" aria-hidden={!showSidebarDetails}>{item.label}</span>
                      <span className="shell-sidebar-detail text-[9px] font-semibold px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25" aria-hidden={!showSidebarDetails}>Em breve</span>
                    </div>
                  )
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={(!sidebarOpen && !isMobile) ? item.label : undefined}
                    data-label={item.label}
                    className={({ isActive }) =>
                      `shell-nav-item flex items-center gap-3 py-2.5 text-sm font-medium transition-all duration-250 cursor-pointer min-h-[42px] ${isActive ? 'shell-nav-item-active text-white pl-[calc(0.8rem-2px)] pr-3' : 'text-dark-muted hover:text-dark-text hover:bg-dark-surface2/60 hover:translate-x-0.5 px-3'}`
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="shell-sidebar-detail flex-1 truncate" aria-hidden={!showSidebarDetails}>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div
          className="shell-user-card flex items-center gap-2.5 border-t px-3 py-3 flex-shrink-0"
          data-label={profile?.nome || 'Perfil'}
          title={!showSidebarDetails ? (profile?.nome || 'Perfil') : undefined}
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
                              <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-dark-text truncate flex-1">{profile?.nome}</p>
                  <button
                    onClick={() => { setNotificationsOpen(o => !o); setUserMenuOpen(false) }}
                    className="relative inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-dark-border/70 bg-dark-surface/70 text-dark-muted transition-colors hover:text-dark-text hover:border-brand-accent/50"
                    aria-label="Notificações"
                    aria-expanded={notificationsOpen}
                  >
                    <Bell className="h-4 w-4" />
                    {notifications.length > 0 && (
                      <span className="shell-notification-dot absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-warning px-1 text-[9px] font-bold text-white">
                        {notifications.length > 9 ? '9+' : notifications.length}
                      </span>
                    )}
                  </button>
                </div>
              {isFiancaRoute && abertasCount > 0 && (
                <p className="text-[10px] mt-0.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-white font-semibold"
                    style={{ background: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    {abertasCount} em cotacao
                  </span>
                </p>
              )}
              <div className="shell-user-actions">
                <button type="button" className="shell-user-action" onClick={toggleTheme}>
                  {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                  <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
                </button>
                <button type="button" className="shell-user-action is-danger" onClick={signOut}>
                  <LogOut aria-hidden="true" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </aside>

      <div className="shell-main flex h-full min-w-0 min-h-0 w-full flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        {!hideWorkspaceTopbar && isDashboardRoute && !isFiancaRoute && (
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
                : <Moon className="w-4 h-4 text-status-info" />
              }
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
                      {isFiancaRoute && abertasCount > 0 && (
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

        <main className={`flex h-full min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-transparent ${hideWorkspaceTopbar ? 'pt-0' : isDashboardRoute ? 'pt-4' : 'pt-2'}`}>
          {/* uw:max-w conta a largura em monitores ultrawide/4K (>=2200px) para
              tabelas/textos não esticarem até a borda; não afeta notebooks/1920px. */}
          <div className="flex h-full min-h-full w-full min-w-0 flex-1 flex-col uw:max-w-[1900px] uw:mx-auto">
            {isAutoRoute && (
              <Suspense fallback={<div className="auto-workspace-loading" aria-hidden="true"><span /><span /><span /></div>}>
                <AutoWorkspaceBar />
              </Suspense>
            )}
            {isFiancaRoute && (
              <Suspense fallback={<div className="fianca-workspace-loading" aria-hidden="true"><span /><span /><span /></div>}>
                <FiancaWorkspaceBar
                  onSearch={() => setCmdOpen(true)}
                  onNewFicha={() => navigate('/fichas?novo=1')}
                  openCount={abertasCount}
                  isAdmin={Boolean(profile?.is_admin)}
                />
              </Suspense>
            )}
            <PageTransition className={isFiancaRoute ? 'fianca-page-scope' : ''}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {cmdOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={cmdOpen}
            onClose={() => setCmdOpen(false)}
            onOpenFicha={id => { navigate(`/fichas/${id}`); setCmdOpen(false) }}
            onOpenApolice={id => { navigate(`/apolices/${id}`); setCmdOpen(false) }}
            onNewFicha={() => { navigate('/fichas?novo=1'); setCmdOpen(false) }}
            onOpenQueue={() => { navigate('/minhas-fichas'); setCmdOpen(false) }}
            onOpenPolicies={() => { navigate('/apolices'); setCmdOpen(false) }}
          />
        </Suspense>
      )}
    </div>
  )
}
