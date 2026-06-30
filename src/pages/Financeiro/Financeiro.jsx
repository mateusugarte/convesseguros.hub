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
      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))] p-2 shadow-[0_18px_46px_-36px_rgba(16,185,129,0.55)]">
        {TABS.map(tab => tab.disabled ? (
          <span
            key={tab.label}
            title="Em breve"
            className="cursor-not-allowed rounded-2xl px-3 py-2 text-xs font-medium text-dark-muted/50"
          >
            {tab.label} · em breve
          </span>
        ) : (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-2xl px-4 py-2 text-xs font-semibold transition-colors ${
                isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-dark-muted hover:bg-dark-surface/80 hover:text-emerald-700'
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
