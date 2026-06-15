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
        className="overflow-hidden border-brand-accent/10"
        bodyClassName="p-0"
      >
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/10 via-transparent to-brand-secondary/8 p-6 md:p-8">
            <div className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="relative z-[1]">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                <ShieldAlert className="h-3.5 w-3.5" />
                Area em preparacao
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Sinistros vai nascer com a mesma linguagem do restante do Auto.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                Quando o fluxo entrar, esta area vai concentrar abertura, andamento e encerramento
                com leitura clara da carteira e sem perder a identidade visual do modulo.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  { title: 'Abertura', text: 'registro inicial e documentos' },
                  { title: 'Acompanhamento', text: 'status, prazos e pendencias' },
                  { title: 'Fechamento', text: 'resultado e historico final' },
                ].map(item => (
                  <div key={item.title} className="rounded-3xl border border-white/50 bg-white/75 p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-dark-muted">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-dark-surface2/45 p-6 md:p-8">
            <EmptyState
              icon={<ShieldAlert className="w-6 h-6" />}
              title="Sinistros entram na proxima etapa"
              description="Quando o fluxo de sinistros for conectado, esta area vai concentrar entradas, status e resolucao da carteira Auto."
            />
          </div>
        </div>
      </DataCard>
    </div>
  )
}
