import { PageHeader, DataCard } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { Moon, SunMedium, MonitorCog, Layers3 } from 'lucide-react'

const options = [
  {
    key: 'light',
    title: 'Tema claro',
    description: 'Base visual branca do shell operacional.',
    icon: SunMedium,
  },
  {
    key: 'dark',
    title: 'Tema escuro',
    description: 'Preferencia manual para uso prolongado.',
    icon: Moon,
  },
]

export default function Configuracoes() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configuracoes"
        description="Ajustes globais de experiencia e preferencia visual do usuario."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DataCard
          title="Aparencia"
          subtitle="Escolha o tema que sera usado no shell"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {options.map(option => {
              const Icon = option.icon
              const active = theme === option.key
              return (
                <button
                  key={option.key}
                  onClick={() => setTheme(option.key)}
                  className={`rounded-3xl border p-5 text-left transition-all ${
                    active
                      ? 'border-brand-accent bg-brand-accent/10 shadow-sm'
                      : 'border-dark-border hover:border-brand-accent/40 hover:bg-dark-surface2/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-brand-accent/15 text-brand-accent' : 'bg-dark-surface2 text-dark-muted'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-dark-text">{option.title}</p>
                        <p className="mt-1 text-sm text-dark-muted">{option.description}</p>
                      </div>
                    </div>
                    {active && <span className="badge badge-success">Ativo</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </DataCard>

        <DataCard
          title="Resumo"
          subtitle="Contexto atual do workspace"
        >
          <div className="space-y-3 text-sm text-dark-muted">
            <div className="rounded-2xl border border-dark-border/70 p-4">
              <div className="flex items-center gap-2 text-dark-text">
                <Layers3 className="h-4 w-4 text-brand-accent" />
                Shell operacional
              </div>
              <p className="mt-2 text-sm text-dark-muted">
                O sistema opera com design premium e separacao de workspaces.
              </p>
            </div>
            <div className="rounded-2xl border border-dark-border/70 p-4">
              <div className="flex items-center gap-2 text-dark-text">
                <MonitorCog className="h-4 w-4 text-brand-secondary" />
                Preferencia salva
              </div>
              <p className="mt-2 text-sm text-dark-muted">
                A escolha de tema fica registrada localmente para a sessao do usuario.
              </p>
            </div>
          </div>
        </DataCard>
      </div>
    </div>
  )
}
