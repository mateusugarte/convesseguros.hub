import { Link } from 'react-router-dom'
import { ArrowRight, CircleDashed, Lock, Star, ShieldCheck, CalendarDays, BarChart3, Sparkles, BadgeInfo, LayoutGrid, ListChecks, ClipboardList, FileText } from 'lucide-react'
import { PageHeader, MetricCard, DataCard } from '../components/ui'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

const FEATURES = [
  'Listagem completa de apólices emitidas',
  'Controle de vigência e renovação',
  'Integração com seguradoras parceiras',
  'Relatórios de comissão e produtividade',
  'Histórico de emissões por produto',
]

const MODULE_PILLARS = [
  {
    title: 'Entrada',
    text: 'Receber apólices aprovadas, organizar origem e preparar a fila operacional.',
  },
  {
    title: 'Acompanhamento',
    text: 'Vigência, renovação, alertas e pontos de atenção centralizados por apólice.',
  },
  {
    title: 'Resultado',
    text: 'Comissão, produtividade e histórico para leitura rápida da operação.',
  },
]

const SHORTCUTS = [
  {
    to: '/apolices',
    title: 'Dashboard',
    text: 'Acessar a visão geral do módulo para acompanhar a operação.',
    icon: LayoutGrid,
  },
  {
    to: '/apolices/lista',
    title: 'Lista',
    text: 'Abrir a relação operacional das apólices já emitidas.',
    icon: ClipboardList,
  },
  {
    to: '/apolices/gestao',
    title: 'Gestão de apólices',
    text: 'Abrir o kanban operacional de emissão e movimentação.',
    icon: ListChecks,
  },
  {
    to: '/relatorio',
    title: 'Relatórios',
    text: 'Cruzar produção, comissão e leitura consolidada da operação.',
    icon: FileText,
  },
]

export default function GestaoEmissoes() {
  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Gestão de emissões"
        title="Central de apólices emitidas"
        description="Área reservada para a operação de emissão, renovação e acompanhamento das apólices. Nesta etapa ela permanece como lançamento visual, sem lógica ativa."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/apolices"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs font-medium text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
            >
              Voltar às apólices
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/apolices/gestao"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-secondary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
            >
              Abrir gestão
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        stats={(
          <>
            <MetricCard
              label="Status"
              value="Em breve"
              hint="sem operação ativa"
              tone="accent"
              icon={<Lock className="h-4 w-4" />}
            />
            <MetricCard
              label="Escopo"
              value="Emissões"
              hint="vigência e renovação"
              tone="secondary"
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <MetricCard
              label="Foco"
              value="Consolidação"
              hint="central operacional"
              tone="success"
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <MetricCard
              label="Próximo passo"
              value="Definir fluxo"
              hint="quando a fase entrar no roadmap"
              tone="warning"
              icon={<CircleDashed className="h-4 w-4" />}
            />
          </>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <DataCard
          title="Visão do módulo"
          subtitle="Estrutura reservada para a operação de apólices emitidas."
          bodyClassName="space-y-5"
        >
          <div
            className="relative overflow-hidden rounded-2xl border border-dark-border bg-dark-surface2/70 p-6"
            style={{
              background:
                'linear-gradient(135deg, rgba(27,58,107,0.16) 0%, rgba(17,24,39,0.84) 56%, rgba(43,91,168,0.14) 100%)',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img src={LOGO} alt="" className="h-56 w-56 object-contain opacity-[0.04]" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent">
                <Star className="h-3.5 w-3.5" />
                Em desenvolvimento
              </div>
              <div className="space-y-2">
                <p className="text-sm text-dark-muted">
                  A experiência futura deve concentrar emissão, renovação, alertas e histórico em um único fluxo.
                </p>
                <p className="text-sm text-dark-muted">
                  Neste momento a página permanece propositalmente estática para não introduzir regras novas antes do desenho funcional.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-dark-border bg-dark-surface2/70 px-3 py-1 text-[11px] font-medium text-dark-muted">Apólices</span>
                <span className="rounded-full border border-dark-border bg-dark-surface2/70 px-3 py-1 text-[11px] font-medium text-dark-muted">Renovação</span>
                <span className="rounded-full border border-dark-border bg-dark-surface2/70 px-3 py-1 text-[11px] font-medium text-dark-muted">Comissão</span>
                <span className="rounded-full border border-dark-border bg-dark-surface2/70 px-3 py-1 text-[11px] font-medium text-dark-muted">Seguradoras</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {MODULE_PILLARS.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-dark-border bg-dark-surface2/55 p-4"
              >
                <div className="mb-3 flex items-center gap-2 text-brand-accent">
                  {pillar.title === 'Entrada' && <BadgeInfo className="h-4 w-4" />}
                  {pillar.title === 'Acompanhamento' && <Sparkles className="h-4 w-4" />}
                  {pillar.title === 'Resultado' && <BarChart3 className="h-4 w-4" />}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{pillar.title}</p>
                </div>
                <p className="text-sm leading-6 text-dark-muted">{pillar.text}</p>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard
          title="Funcionalidades planejadas"
          subtitle="Lista de capacidades previstas para quando a etapa sair do modo placeholder."
          bodyClassName="space-y-3"
        >
          {FEATURES.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/50 px-4 py-3"
            >
              <div className="mt-0.5 rounded-xl border border-brand-accent/20 bg-brand-secondary/15 p-2 text-brand-accent">
                <Star className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-text">{feature}</p>
              </div>
            </div>
          ))}
        </DataCard>
      </div>

      <DataCard
        title="Fluxo sugerido"
        subtitle="Sequência operacional prevista para a futura gestão de emissões."
        bodyClassName="space-y-3"
      >
        {[
          'Receber apólice aprovada e registrar a origem.',
          'Acompanhar emissão, vigência e renovação.',
          'Monitorar alertas de prazo e exceções.',
          'Fechar a leitura com comissão e produtividade.',
        ].map((step, index) => (
          <div
            key={step}
            className="flex items-start gap-4 rounded-2xl border border-dark-border bg-dark-surface2/55 px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-secondary/15 text-sm font-semibold text-brand-accent">
              {index + 1}
            </div>
            <p className="text-sm leading-6 text-dark-muted">{step}</p>
          </div>
        ))}
      </DataCard>

      <DataCard
        title="Atalhos do módulo"
        subtitle="Entradas rápidas para as páginas já existentes do núcleo de apólices."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SHORTCUTS.map((shortcut) => {
            const Icon = shortcut.icon
            return (
              <Link
                key={shortcut.to}
                to={shortcut.to}
                className="group rounded-2xl border border-dark-border bg-dark-surface2/60 p-4 transition-all hover:border-brand-accent/40 hover:bg-dark-surface2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex rounded-xl border border-brand-accent/15 bg-brand-secondary/10 p-2 text-brand-accent">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dark-text">{shortcut.title}</p>
                      <p className="mt-1 text-sm leading-6 text-dark-muted">{shortcut.text}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-dark-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand-accent" />
                </div>
              </Link>
            )
          })}
        </div>
      </DataCard>
    </div>
  )
}
