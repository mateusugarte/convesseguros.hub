import { NavLink, Outlet } from 'react-router-dom'
import { DataCard, EmptyState } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { ShieldCheck } from 'lucide-react'

const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { to: '/financeiro/producao', label: 'Produção' },
  { to: '/financeiro/faturas', label: 'Faturas' },
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
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-1 border-b border-dark-border pb-2">
        {TABS.map(tab => tab.disabled ? (
          <span
            key={tab.label}
            title="Em breve"
            className="cursor-not-allowed rounded-xl px-3 py-1.5 text-xs font-medium text-dark-muted/50"
          >
            {tab.label} · em breve
          </span>
        ) : (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
