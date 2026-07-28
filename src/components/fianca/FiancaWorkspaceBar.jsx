import { useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Command,
  FileCheck2,
  FilePlus2,
  Files,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/fichas', label: 'Fichas', icon: Files },
  { to: '/minhas-fichas', label: 'Minha fila', icon: UserRoundCheck },
  { to: '/apolices', label: 'Apólices', icon: FileCheck2 },
  { to: '/relatorio', label: 'Relatórios', icon: BarChart3 },
  { to: '/imobiliarias', label: 'Parceiros', icon: Building2 },
  { to: '/financeiro', label: 'Financeiro', icon: WalletCards, adminOnly: true },
]

const AREA_LABELS = [
  { match: pathname => pathname === '/', eyebrow: 'Comando geral', title: 'Operação Fiança' },
  { match: pathname => pathname.startsWith('/fichas/'), eyebrow: 'Análise detalhada', title: 'Ficha em foco' },
  { match: pathname => pathname.startsWith('/fichas'), eyebrow: 'Mesa operacional', title: 'Gestão de fichas' },
  { match: pathname => pathname.startsWith('/minhas-fichas'), eyebrow: 'Carteira pessoal', title: 'Minha fila' },
  { match: pathname => pathname.startsWith('/emissoes'), eyebrow: 'Pós-aprovação', title: 'Central de emissões' },
  { match: pathname => pathname.startsWith('/apolices/'), eyebrow: 'Carteira emitida', title: 'Gestão de apólices' },
  { match: pathname => pathname.startsWith('/apolices'), eyebrow: 'Carteira emitida', title: 'Apólices' },
  { match: pathname => pathname.startsWith('/relatorio'), eyebrow: 'Inteligência operacional', title: 'Relatórios' },
  { match: pathname => pathname.startsWith('/imobiliarias'), eyebrow: 'Rede de parceiros', title: 'Imobiliárias' },
  { match: pathname => pathname.startsWith('/seguradoras'), eyebrow: 'Rede de proteção', title: 'Seguradoras' },
  { match: pathname => pathname.startsWith('/financeiro'), eyebrow: 'Performance financeira', title: 'Financeiro' },
]

function isNavActive(pathname, item) {
  if (item.end) return pathname === item.to
  if (item.to === '/apolices') return pathname.startsWith('/apolices') || pathname.startsWith('/emissoes')
  if (item.to === '/imobiliarias') return pathname.startsWith('/imobiliarias') || pathname.startsWith('/seguradoras')
  return pathname.startsWith(item.to)
}

export default function FiancaWorkspaceBar({ onSearch, onNewFicha, openCount = 0, isAdmin = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const area = useMemo(
    () => AREA_LABELS.find(item => item.match(location.pathname)) || AREA_LABELS[0],
    [location.pathname],
  )

  return (
    <section className="fianca-workspace-bar fianca-enter" aria-label="Workspace do setor Fiança">
      <div className="fianca-workspace-identity">
        <span className="fianca-workspace-mark"><ShieldCheck aria-hidden="true" /></span>
        <div>
          <small>{area.eyebrow}</small>
          <strong>{area.title}</strong>
        </div>
      </div>

      <nav aria-label="Navegação rápida do Fiança">
        {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin).map(item => {
          const Icon = item.icon
          const active = isNavActive(location.pathname, item)
          return (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span className={active ? 'is-active' : ''}>
                <Icon aria-hidden="true" />
                <b>{item.label}</b>
              </span>
            </NavLink>
          )
        })}
      </nav>

      <div className="fianca-workspace-actions">
        <button
          type="button"
          className="fianca-workspace-queue"
          onClick={() => navigate('/minhas-fichas')}
          aria-label={`${openCount} fichas em cotação na sua fila`}
        >
          <span>{openCount}</span>
          <small>em cotação</small>
          <ArrowRight aria-hidden="true" />
        </button>
        <button type="button" className="fianca-workspace-search" onClick={onSearch}>
          <Search aria-hidden="true" />
          <span><small>Busca universal</small><strong>Localizar cliente ou apólice</strong></span>
          <kbd><Command aria-hidden="true" />K</kbd>
        </button>
        <button type="button" className="fianca-workspace-create" onClick={onNewFicha} title="Nova ficha · Alt+N">
          <FilePlus2 aria-hidden="true" />
          <span>Nova ficha</span>
        </button>
      </div>
    </section>
  )
}
