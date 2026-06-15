import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react'
import { getRenovacoesAuto, atualizarStatusRenovacao } from '../../lib/auto'
import { PageHeader, MetricCard, FilterBar, DataCard, EmptyState } from '../../components/ui'

const PERIODOS = [
  { value: 'proximo_mes', label: 'Proximo mes' },
  { value: 'mes_atual', label: 'Mes atual' },
  { value: 'passadas', label: 'Passadas' },
  { value: '', label: 'Todas' },
]

const STATUS_COTACAO = {
  nao_cotada: { label: 'Nao cotada', shell: 'border-status-danger/20 bg-status-danger/10', badge: 'bg-status-danger/10 text-status-danger' },
  cotada_nao_enviada: { label: 'Cotada - nao enviada', shell: 'border-status-warning/20 bg-status-warning/10', badge: 'bg-status-warning/10 text-status-warning' },
  cotada_enviada: { label: 'Cotada e enviada', shell: 'border-status-success/20 bg-status-success/10', badge: 'bg-status-success/10 text-status-success' },
}

function formatarData(str) {
  if (!str) return '-'
  return new Date(`${str}T12:00:00`).toLocaleDateString('pt-BR')
}

export default function AutoRenovacoes() {
  const [periodo, setPeriodo] = useState('proximo_mes')
  const qc = useQueryClient()

  const { data: renovacoes = [], isLoading } = useQuery({
    queryKey: ['auto-renovacoes', periodo],
    queryFn: () => getRenovacoesAuto({ periodo }),
  })

  const { mutate: atualizarStatus } = useMutation({
    mutationFn: ({ id, status_cotacao }) => atualizarStatusRenovacao(id, { status_cotacao }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
  })

  const metricas = useMemo(() => ({
    total: renovacoes.length,
    enviadas: renovacoes.filter(item => item.status_cotacao === 'cotada_enviada').length,
    pendentes: renovacoes.filter(item => item.status_cotacao !== 'cotada_enviada').length,
  }), [renovacoes])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Renovacoes Auto"
        description="Acompanhe vencimentos, situacao da cotacao e o que ainda precisa sair para proteger a carteira."
        stats={(
          <>
            <MetricCard label="Renovacoes" value={metricas.total} hint="itens no recorte ativo" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Cotadas e enviadas" value={metricas.enviadas} hint="prontas para retorno" tone="success" icon={<CheckCircle2 className="w-5 h-5" />} />
            <MetricCard label="Pendentes" value={metricas.pendentes} hint="exigem acao operacional" tone="warning" icon={<CalendarClock className="w-5 h-5" />} />
          </>
        )}
      />

      <FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map(item => (
            <button
              key={item.value}
              onClick={() => setPeriodo(item.value)}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                periodo === item.value
                  ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                  : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </FilterBar>

      <DataCard
        title="Fila de renovacoes"
        subtitle="Ajuste o status de cotacao sem sair da mesa operacional"
      >
        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando renovacoes...</div>
        ) : renovacoes.length === 0 ? (
          <EmptyState
            icon={<RefreshCw className="w-6 h-6" />}
            title="Nenhuma renovacao no recorte"
            description="Quando houver itens no periodo selecionado, eles aparecerao aqui."
          />
        ) : (
          <div className="space-y-3">
            {renovacoes.map(item => {
              const statusInfo = STATUS_COTACAO[item.status_cotacao] || STATUS_COTACAO.nao_cotada

              return (
                <article
                  key={item.id}
                  className={`rounded-3xl border p-4 transition-all ${statusInfo.shell}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-dark-text">
                          {item.clientes_auto?.nome_completo || '-'}
                        </h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusInfo.badge}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-dark-muted">
                        {item.seguradora || 'Seguradora nao informada'} · vence em <strong className="text-dark-text">{formatarData(item.vigencia_fim)}</strong>
                      </p>
                    </div>

                    <select
                      value={item.status_cotacao}
                      onChange={e => atualizarStatus({ id: item.id, status_cotacao: e.target.value })}
                      className="min-w-[220px] rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text shadow-sm outline-none"
                    >
                      <option value="nao_cotada">Nao cotada</option>
                      <option value="cotada_nao_enviada">Cotada - nao enviada</option>
                      <option value="cotada_enviada">Cotada e enviada</option>
                    </select>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </DataCard>
    </div>
  )
}
