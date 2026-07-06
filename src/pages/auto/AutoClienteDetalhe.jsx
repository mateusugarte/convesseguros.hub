import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Car, ClipboardList, DollarSign, FileText, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { DataCard, EmptyState, MetricCard, PageHeader } from '../../components/ui'
import { getClienteAutoDetalhe } from '../../lib/auto'
import { formatDateBR, formatDateTimeBR, formatMoney } from './autoShared'

function RowLink({ label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-2xl border border-dark-border/70 bg-dark-surface/60 px-4 py-3 text-left text-sm transition-colors hover:border-brand-secondary/30 hover:bg-brand-secondary/5">
      <span className="font-medium text-dark-text">{label}</span>
      <span className="text-dark-muted">{value}</span>
    </button>
  )
}

export default function AutoClienteDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['auto-cliente-detalhe', id], queryFn: () => getClienteAutoDetalhe(decodeURIComponent(id || '')), enabled: Boolean(id) })

  if (isLoading) return <div className="py-16 text-center text-sm text-dark-muted">Carregando cliente...</div>
  if (!data) return <EmptyState title="Cliente não encontrado" description="O perfil pode ter sido removido ou ainda não existe vínculo suficiente para montar a área detalhada." />

  const { cliente, apolices, cotacoes, emissoes, renovacoes, metricas, statusAtual, destaque } = data

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Seguro Auto"
        title={cliente?.nome_completo || 'Cliente Auto'}
        description="Perfil completo do cliente Auto com dados cadastrais, relacionamento, apólices, renovações, cotações e histórico financeiro disponível."
        actions={(
          <button onClick={() => navigate('/auto/clientes')} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</button>
        )}
        stats={(
          <>
            <MetricCard label="Apólices emitidas" value={metricas.apolicesEmitidas} hint="histórico consolidado" tone="accent" icon={<ShieldCheck className="h-4 w-4" />} />
            <MetricCard label="Renovações" value={metricas.renovacoes} hint="vínculos da carteira" tone="warning" icon={<RefreshCw className="h-4 w-4" />} />
            <MetricCard label="Cotações" value={metricas.cotacoes} hint="movimento comercial" tone="secondary" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Comissão acumulada" value={formatMoney(metricas.comissaoTotal)} hint="base financeira" tone="success" icon={<DollarSign className="h-4 w-4" />} />
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DataCard title="Dados cadastrais">
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Nome</p><p className="mt-1 text-dark-text">{cliente?.nome_completo || '—'}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">CPF</p><p className="mt-1 text-dark-text">{cliente?.cpf || '—'}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Celular</p><p className="mt-1 text-dark-text">{cliente?.celular || cliente?.telefone || '—'}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Email</p><p className="mt-1 text-dark-text">{cliente?.email || '—'}</p></div>
          </div>
        </DataCard>

        <DataCard title="Status atual">
          <div className="space-y-3 text-sm text-dark-muted">
            <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">{statusAtual}</div>
            <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">Apólice ativa: <span className="font-semibold text-dark-text">{destaque.apoliceAtiva?.numero_apolice || 'Não'}</span></div>
            <div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">Renovação em andamento: <span className="font-semibold text-dark-text">{destaque.emRenovacao?.vigencia_fim ? formatDateBR(destaque.emRenovacao.vigencia_fim) : 'Não'}</span></div>
          </div>
        </DataCard>
      </div>

      <DataCard title="Relacionamento com a corretora" subtitle="Leitura rápida do vínculo operacional e financeiro do cliente.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Última apólice</p><p className="mt-2 text-lg font-semibold text-dark-text">{destaque.latestApolice?.numero_apolice || '—'}</p><p className="mt-1 text-xs text-dark-muted">{destaque.latestApolice?.seguradora || 'Sem seguradora'}</p></div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Última emissão</p><p className="mt-2 text-lg font-semibold text-dark-text">{formatDateTimeBR(destaque.latestEmissao?.created_at)}</p><p className="mt-1 text-xs text-dark-muted">{destaque.latestEmissao?.seguradora || 'Sem seguradora'}</p></div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Prêmio acumulado</p><p className="mt-2 text-lg font-semibold text-dark-text">{formatMoney(metricas.premioTotal)}</p><p className="mt-1 text-xs text-dark-muted">base das apólices emitidas</p></div>
          <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/70 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Observações</p><p className="mt-2 text-lg font-semibold text-dark-text">{cotacoes[0]?.origem_lead || 'Sem observações'}</p><p className="mt-1 text-xs text-dark-muted">informação mais recente registrada</p></div>
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Apólices vinculadas" subtitle="Clique para abrir a área interna da apólice.">
          {apolices.length === 0 ? <EmptyState icon={<Car className="h-5 w-5" />} title="Sem apólices" description="Nenhuma apólice vinculada a este cliente." /> : <div className="space-y-3">{apolices.map(item => <RowLink key={item.id} label={`${item.numero_apolice || 'Sem número'} · ${item.seguradora || 'Sem seguradora'}`} value={`${formatDateBR(item.vigencia_inicio)} até ${formatDateBR(item.vigencia_fim)}`} onClick={() => navigate(`/auto/apolices/${item.id}`)} />)}</div>}
        </DataCard>

        <DataCard title="Renovações vinculadas" subtitle="Acompanhamento de vencimentos e status da carteira.">
          {renovacoes.length === 0 ? <EmptyState icon={<RefreshCw className="h-5 w-5" />} title="Sem renovações" description="Nenhuma renovação vinculada a este cliente." /> : <div className="space-y-3">{renovacoes.map(item => <RowLink key={item.id} label={`${item.apolices_auto?.numero_apolice || 'Sem apólice'} · ${item.seguradora || 'Sem seguradora'}`} value={`${formatDateBR(item.vigencia_fim)} · ${item.status_renovacao || 'pendente'}`} onClick={() => (item.apolices_auto?.id ? navigate(`/auto/apolices/${item.apolices_auto.id}`) : null)} />)}</div>}
        </DataCard>

        <DataCard title="Histórico de cotações" subtitle="Volume comercial gerado para este cliente.">
          {cotacoes.length === 0 ? <EmptyState icon={<FileText className="h-5 w-5" />} title="Sem cotações" description="Nenhuma cotação registrada para este cliente." /> : <div className="space-y-3">{cotacoes.map(item => <RowLink key={item.id} label={`${item.modelo_veiculo || 'Veículo não informado'} · ${item.status || 'pendente'}`} value={formatDateTimeBR(item.created_at)} onClick={() => navigate(`/auto/cotacoes/${item.id}`)} />)}</div>}
        </DataCard>

        <DataCard title="Histórico financeiro" subtitle="Base financeira disponível nas apólices emitidas.">
          {apolices.length === 0 ? <EmptyState icon={<DollarSign className="h-5 w-5" />} title="Sem histórico financeiro" description="Nenhuma apólice emitida para gerar valores financeiros." /> : <div className="space-y-3">{apolices.map(item => <RowLink key={item.id} label={`${item.numero_apolice || 'Sem número'} · prêmio ${formatMoney(item.premio_liquido || 0)}`} value={`comissão ${formatMoney(item.valor_comissao || 0)}`} onClick={() => navigate(`/auto/apolices/${item.id}`)} />)}</div>}
        </DataCard>
      </div>

      <DataCard title="Emissões relacionadas" subtitle="Linha do tempo operacional mais recente.">
        {emissoes.length === 0 ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Sem emissões" description="Nenhuma emissão encontrada para este cliente." /> : <div className="space-y-3">{emissoes.map(item => <RowLink key={item.id} label={`${item.seguradora || 'Sem seguradora'} · ${item.coluna || 'apolice_emitida'}`} value={formatDateTimeBR(item.created_at)} onClick={() => navigate(item.apolices_auto?.[0]?.id ? `/auto/apolices/${item.apolices_auto[0].id}` : `/auto/emissoes/${item.id}`)} />)}</div>}
      </DataCard>
    </div>
  )
}
