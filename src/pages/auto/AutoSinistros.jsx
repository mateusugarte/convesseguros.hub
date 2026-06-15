import { ShieldAlert } from 'lucide-react'
import { PageHeader, DataCard, EmptyState } from '../../components/ui'

export default function AutoSinistros() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Sinistros Auto"
        description="Area reservada para controle de sinistros, acompanhamento de acionamentos e leitura de pendencias futuras."
      />

      <DataCard
        title="Operacao em preparacao"
        subtitle="A estrutura visual do modulo ja esta pronta para receber o fluxo funcional"
      >
        <EmptyState
          icon={<ShieldAlert className="w-6 h-6" />}
          title="Sinistros entram na proxima etapa"
          description="Quando o fluxo de sinistros for conectado, esta area vai concentrar entradas, status e resolucao da carteira Auto."
        />
      </DataCard>
    </div>
  )
}
