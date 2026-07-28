import { createPortal } from 'react-dom'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Car,
  Command,
  FilePlus2,
  FileSearch,
  Gauge,
  History,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { buscarAutoGlobal } from '../../lib/auto'

const NAV_ITEMS = [
  { to: '/auto', label: 'Visão geral', icon: Gauge, end: true },
  { to: '/auto/renovacoes', label: 'Renovações', icon: RefreshCw },
  { to: '/auto/gestao', label: 'Pipeline', icon: Layers3 },
  { to: '/auto/cotacoes', label: 'Cotações', icon: FileSearch },
  { to: '/auto/clientes', label: 'Clientes', icon: Users },
  { to: '/auto/emissoes', label: 'Apólices', icon: ShieldCheck },
]

const QUICK_ACTIONS = [
  {
    label: 'Seguro novo',
    description: 'Iniciar uma cotação do zero',
    to: '/auto/cotacoes?modo=novo',
    icon: Plus,
    tone: 'blue',
  },
  {
    label: 'Renovação',
    description: 'Localizar carteira e recotar',
    to: '/auto/cotacoes?modo=renovacao',
    icon: RefreshCw,
    tone: 'teal',
  },
  {
    label: 'Endosso',
    description: 'Alterar uma apólice existente',
    to: '/auto/cotacoes?modo=endosso',
    icon: FilePlus2,
    tone: 'coral',
  },
]

function ResultSection({ title, icon: Icon, items, renderTitle, renderMeta, onOpen }) {
  if (!items?.length) return null
  return (
    <section className="auto-command-results-section">
      <header>
        <span><Icon aria-hidden="true" />{title}</span>
        <small>{items.length}</small>
      </header>
      <div>
        {items.map(item => (
          <button type="button" key={item.id} onClick={() => onOpen(item)}>
            <span className="auto-command-result-icon"><Icon aria-hidden="true" /></span>
            <span className="auto-command-result-copy">
              <strong>{renderTitle(item)}</strong>
              <small>{renderMeta(item)}</small>
            </span>
            <ArrowRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  )
}

function AutoCommandCenter({ open, onClose }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim())

  const { data = { clientes: [], apolices: [], cotacoes: [] }, isFetching, isError } = useQuery({
    queryKey: ['auto-global-search', deferredQuery],
    queryFn: () => buscarAutoGlobal(deferredQuery),
    enabled: open && deferredQuery.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!open) {
      setQuery('')
      return undefined
    }
    const timeout = setTimeout(() => inputRef.current?.focus(), 60)
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  function openRoute(to) {
    navigate(to)
    onClose()
  }

  if (!open) return null

  const hasResults = data.clientes.length || data.apolices.length || data.cotacoes.length

  return createPortal(
    <div className="auto-command-overlay" role="dialog" aria-modal="true" aria-label="Central de comando do Auto">
      <button type="button" className="auto-command-backdrop" onClick={onClose} aria-label="Fechar central de comando" />
      <div className="auto-command-modal">
        <header className="auto-command-modal-head">
          <span className="auto-command-brand"><Car aria-hidden="true" /></span>
          <div>
            <small>Workspace Auto</small>
            <strong>Central de comando</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button>
        </header>

        <label className="auto-command-search">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Busque cliente, CPF, placa, veículo ou apólice..."
            autoComplete="off"
          />
          {isFetching ? <span className="auto-command-spinner" /> : <kbd>ESC</kbd>}
        </label>

        <div className="auto-command-body" aria-live="polite" aria-busy={isFetching}>
          {deferredQuery.length < 2 ? (
            <>
              <section className="auto-command-quick-section">
                <div className="auto-command-section-title">
                  <span><Sparkles aria-hidden="true" />Criar agora</span>
                  <small>Fluxos rápidos</small>
                </div>
                <div className="auto-command-quick-grid">
                  {QUICK_ACTIONS.map(action => {
                    const Icon = action.icon
                    return (
                      <button type="button" key={action.to} className={`is-${action.tone}`} onClick={() => openRoute(action.to)}>
                        <span><Icon aria-hidden="true" /></span>
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="auto-command-shortcuts">
                <button type="button" onClick={() => openRoute('/auto/gestao')}>
                  <Layers3 aria-hidden="true" /><span><strong>Abrir Pipeline</strong><small>Continuar negócios em andamento</small></span><ArrowRight aria-hidden="true" />
                </button>
                <button type="button" onClick={() => openRoute('/auto/emissoes')}>
                  <History aria-hidden="true" /><span><strong>Consultar apólices</strong><small>Histórico, documentos e vigências</small></span><ArrowRight aria-hidden="true" />
                </button>
              </section>
            </>
          ) : isError ? (
            <div className="auto-command-state is-error">
              <Search aria-hidden="true" />
              <strong>Não foi possível buscar agora</strong>
              <span>Tente novamente em alguns instantes.</span>
            </div>
          ) : !isFetching && !hasResults ? (
            <div className="auto-command-state">
              <Search aria-hidden="true" />
              <strong>Nenhum resultado encontrado</strong>
              <span>Confira o nome, CPF, placa ou número informado.</span>
            </div>
          ) : (
            <div className="auto-command-results">
              <ResultSection
                title="Clientes"
                icon={UserRound}
                items={data.clientes}
                renderTitle={item => item.nome_completo || 'Cliente sem nome'}
                renderMeta={item => [item.cpf, item.celular].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
                onOpen={item => openRoute(`/auto/clientes/${item.id}`)}
              />
              <ResultSection
                title="Apólices"
                icon={ShieldCheck}
                items={data.apolices}
                renderTitle={item => item.nome_cliente || item.numero_apolice || 'Apólice'}
                renderMeta={item => [item.numero_apolice, item.seguradora, item.placa].filter(Boolean).join(' · ') || 'Dados em atualização'}
                onOpen={item => openRoute(`/auto/apolices/${item.id}`)}
              />
              <ResultSection
                title="Cotações"
                icon={FileSearch}
                items={data.cotacoes}
                renderTitle={item => item.nome_cliente || item.modelo_veiculo || 'Cotação'}
                renderMeta={item => [item.tipo === 'renovacao' ? 'Renovação' : item.tipo === 'endosso' ? 'Endosso' : 'Seguro novo', item.status, item.placa].filter(Boolean).join(' · ')}
                onOpen={item => openRoute(`/auto/cotacoes/${item.id}`)}
              />
            </div>
          )}
        </div>

        <footer className="auto-command-footer">
          <span><kbd>Ctrl</kbd><kbd>J</kbd> abrir de qualquer tela do Auto</span>
          <small>Busca segura na sua carteira</small>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

export default function AutoWorkspaceBar() {
  const location = useLocation()
  const [commandOpen, setCommandOpen] = useState(false)
  const isAutoRoute = location.pathname.startsWith('/auto')

  const activeLabel = useMemo(() => {
    if (location.pathname.startsWith('/auto/apolices')) return 'Apólices'
    const item = [...NAV_ITEMS].reverse().find(nav => nav.end
      ? location.pathname === nav.to
      : location.pathname.startsWith(nav.to))
    return item?.label || 'Auto'
  }, [location.pathname])

  useEffect(() => {
    setCommandOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isAutoRoute) return undefined
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [isAutoRoute])

  if (!isAutoRoute) return null

  return (
    <>
      <div className="auto-workspace-bar auto-v2-enter">
        <div className="auto-workspace-identity">
          <span><Car aria-hidden="true" /></span>
          <div><small>Workspace</small><strong>AUTO</strong></div>
        </div>
        <nav aria-label="Navegação do setor Auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const detailActive = item.to === '/auto/emissoes' && location.pathname.startsWith('/auto/apolices')
            return (
              <NavLink key={item.to} to={item.to} end={item.end} title={item.label}>
                {({ isActive }) => (
                  <span className={isActive || detailActive ? 'is-active' : ''}>
                    <Icon aria-hidden="true" />
                    <b>{item.label}</b>
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <button type="button" className="auto-workspace-command" onClick={() => setCommandOpen(true)}>
          <Search aria-hidden="true" />
          <span><small>Busca universal</small><strong>{activeLabel}</strong></span>
          <kbd><Command aria-hidden="true" />J</kbd>
        </button>
      </div>
      <AutoCommandCenter open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}