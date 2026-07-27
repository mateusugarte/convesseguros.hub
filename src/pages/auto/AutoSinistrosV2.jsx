import { ClipboardCheck, Clock3, FileText, ShieldAlert } from 'lucide-react'
import { AutoBadge, AutoPageHeader, AutoPanel } from '../../components/auto'

const ESCOPO_FUTURO = [
  {
    icon: FileText,
    title: 'Abertura',
    description: 'Registro inicial e documentos do acionamento.',
  },
  {
    icon: Clock3,
    title: 'Acompanhamento',
    description: 'Prazos, responsável e próxima ação.',
  },
  {
    icon: ClipboardCheck,
    title: 'Encerramento',
    description: 'Resultado e histórico final do caso.',
  },
]

export default function AutoSinistrosV2() {
  return (
    <div className="auto-page auto-v2-page">
      <AutoPageHeader
        context="Carteira Auto"
        title="Sinistros"
        description="Esta operação ainda não está disponível no sistema."
        meta={<AutoBadge tone="warning" icon={ShieldAlert}>Planejado</AutoBadge>}
      />

      <AutoPanel title="Módulo ainda não conectado">
        <div className="mx-auto max-w-3xl py-6 md:py-10">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-status-warning/30 bg-status-warning/8 text-status-warning">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-dark-text">Nenhum fluxo de sinistro ativo</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-dark-muted">
              A página permanece reservada até existirem cadastro, acompanhamento e encerramento reais.
            </p>
          </div>

          <div className="mt-8 divide-y divide-dark-border/70 border-y border-dark-border/70">
            {ESCOPO_FUTURO.map(item => {
              const Icon = item.icon
              return (
                <div key={item.title} className="flex items-start gap-3 py-4">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-status-info" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-dark-text">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-dark-muted">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </AutoPanel>
    </div>
  )
}
