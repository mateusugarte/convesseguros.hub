import { NavLink, Outlet } from 'react-router-dom'
import { DataCard, EmptyState } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { BarChart3, Coins, LayoutDashboard, ReceiptText, ShieldCheck } from 'lucide-react'

const TABS = [
  { to: '/financeiro', label: 'Visão geral', hint: 'Resumo executivo', icon: LayoutDashboard, end: true },
  { to: '/financeiro/producao', label: 'Produção', hint: 'Prêmios e comissões', icon: BarChart3 },
  { to: '/financeiro/faturas', label: 'Faturas', hint: 'Conferência e pagamentos', icon: ReceiptText },
]

export default function Financeiro() {
  const { profile } = useAuth()

  if (!profile?.is_admin) {
    return (
      <DataCard title="Acesso restrito">
        <EmptyState
          title="Área financeira restrita"
          description="Somente perfis marcados como admin conseguem visualizar comissões e produção."
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </DataCard>
    )
  }

  return (
    <div className="financeiro-hub space-y-5 animate-fade-in">
      <nav className="financeiro-nav" aria-label="Navegação financeira">
        <div className="financeiro-nav-brand">
          <span className="financeiro-nav-brand-icon"><Coins /></span>
          <span><strong>Centro financeiro</strong><small>Seguro Fiança</small></span>
        </div>
        <div className="financeiro-nav-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `financeiro-nav-item${isActive ? ' is-active' : ''}`}
            >
              <tab.icon />
              <span><strong>{tab.label}</strong><small>{tab.hint}</small></span>
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  )
}
