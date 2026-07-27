import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Car,
  ClipboardList,
  DollarSign,
  FileText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react'
import {
  AutoBadge,
  AutoInfoGrid,
  AutoListRow,
  AutoLoading,
  AutoPageHeader,
  AutoPanel,
  AutoStatStrip,
  AutoTabs,
} from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { getClienteAutoDetalhe } from '../../lib/auto'
import {
  formatDateBR,
  formatDateTimeBR,
  formatMoney,
  formatMonthYearBR,
  getClienteStatusAuto,
} from './autoShared'

const TAB_DEFINITIONS = [
  { value: 'visao-geral', label: 'Visão geral', icon: UserRound },
  { value: 'apolices', label: 'Apólices', icon: ShieldCheck },
  { value: 'renovacoes', label: 'Renovações', icon: RefreshCw },
  { value: 'cotacoes', label: 'Cotações', icon: FileText },
  { value: 'financeiro', label: 'Financeiro', icon: WalletCards },
  { value: 'atividade', label: 'Atividade', icon: Activity },
]

export default function AutoClienteDetalheV2() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState('visao-geral')

  const { data, isLoading } = useQuery({
    queryKey: ['auto-cliente-detalhe', id],
    queryFn: () => getClienteAutoDetalhe(decodeURIComponent(id || '')),
    enabled: Boolean(id),
  })

  const tabs = useMemo(() => {
    if (!data) return TAB_DEFINITIONS
    const counts = {
      apolices: data.apolices.length,
      renovacoes: data.renovacoes.length,
      cotacoes: data.cotacoes.length,
      atividade: data.emissoes.length,
    }
    return TAB_DEFINITIONS.map(item => (
      counts[item.value] === undefined ? item : { ...item, count: counts[item.value] }
    ))
  }, [data])

  if (isLoading) {
    return (
      <div className="auto-page auto-v2-page">
        <AutoLoading label="Carregando cliente..." />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        description="O perfil pode ter sido removido ou ainda não possui vínculos suficientes."
      />
    )
  }

  const {
    cliente,
    apolices,
    cotacoes,
    emissoes,
    renovacoes,
    metricas,
    statusAtual,
    destaque,
    clienteDesde,
  } = data
  const clienteStatus = getClienteStatusAuto(apolices)

  return (
    <div className="auto-page auto-v2-page">
      <AutoPageHeader
        context="Cliente Auto"
        title={cliente?.nome_completo || 'Cliente Auto'}
        description="Carteira, próximas ações e histórico reunidos em um único perfil."
        onBack={() => navigate('/auto/clientes')}
        backLabel="Clientes"
        meta={(
          <>
            <AutoBadge tone={clienteStatus === 'ativo' ? 'success' : 'neutral'}>
              {clienteStatus === 'ativo' ? 'Cliente ativo' : 'Cliente inativo'}
            </AutoBadge>
            <AutoBadge tone="info">Cliente desde {formatMonthYearBR(clienteDesde)}</AutoBadge>
          </>
        )}
        actions={(
          <button
            type="button"
            onClick={() => navigate('/auto/cotacoes?tab=novo')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Nova cotação
          </button>
        )}
      />

      <AutoStatStrip
        items={[
          {
            label: 'Apólices emitidas',
            value: metricas.apolicesEmitidas,
            hint: 'histórico consolidado',
            icon: ShieldCheck,
            tone: 'new',
          },
          {
            label: 'Renovações',
            value: metricas.renovacoes,
            hint: 'vínculos da carteira',
            icon: RefreshCw,
            tone: 'renewal',
          },
          {
            label: 'Cotações',
            value: metricas.cotacoes,
            hint: 'movimento comercial',
            icon: FileText,
            tone: 'info',
          },
          {
            label: 'Comissão acumulada',
            value: formatMoney(metricas.comissaoTotal),
            hint: 'base financeira',
            icon: DollarSign,
            tone: 'success',
          },
        ]}
      />

      <AutoTabs items={tabs} value={tab} onChange={setTab} ariaLabel="Áreas do cliente" />

      {tab === 'visao-geral' && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <AutoPanel title="Dados cadastrais">
            <AutoInfoGrid
              items={[
                { label: 'Nome', value: cliente?.nome_completo },
                { label: 'CPF', value: cliente?.cpf },
                { label: 'Celular', value: cliente?.celular || cliente?.telefone },
                { label: 'Email', value: cliente?.email },
                { label: 'Cliente desde', value: formatMonthYearBR(clienteDesde) },
                { label: 'Situação', value: statusAtual },
              ]}
            />
          </AutoPanel>

          <AutoPanel title="Próxima ação" description="Leitura rápida da situação da carteira.">
            <div className="space-y-2">
              <AutoListRow
                title="Apólice ativa"
                subtitle={destaque.apoliceAtiva?.seguradora || 'Nenhuma seguradora vinculada'}
                meta={destaque.apoliceAtiva?.numero_apolice || 'Não'}
                leading={<ShieldCheck />}
                onClick={destaque.apoliceAtiva?.id
                  ? () => navigate(`/auto/apolices/${destaque.apoliceAtiva.id}`)
                  : undefined}
              />
              <AutoListRow
                title="Renovação em andamento"
                subtitle={destaque.emRenovacao?.status_renovacao || 'Nenhuma renovação em andamento'}
                meta={destaque.emRenovacao?.vigencia_fim
                  ? formatDateBR(destaque.emRenovacao.vigencia_fim)
                  : 'Não'}
                leading={<RefreshCw />}
                onClick={destaque.emRenovacao?.apolices_auto?.id
                  ? () => navigate(`/auto/apolices/${destaque.emRenovacao.apolices_auto.id}`)
                  : undefined}
              />
            </div>
          </AutoPanel>

          <AutoPanel
            className="xl:col-span-2"
            title="Relacionamento com a corretora"
            description="Dados consolidados sem repetir as listas completas."
          >
            <AutoInfoGrid
              items={[
                {
                  label: 'Última apólice',
                  value: destaque.latestApolice?.numero_apolice,
                  hint: destaque.latestApolice?.seguradora || 'Sem seguradora',
                },
                {
                  label: 'Última emissão',
                  value: formatDateTimeBR(destaque.latestEmissao?.created_at),
                  hint: destaque.latestEmissao?.seguradora || 'Sem seguradora',
                },
                {
                  label: 'Prêmio acumulado',
                  value: formatMoney(metricas.premioTotal),
                  hint: 'apólices emitidas',
                },
                {
                  label: 'Origem mais recente',
                  value: cotacoes[0]?.origem_lead || 'Sem informação',
                },
              ]}
            />
          </AutoPanel>
        </div>
      )}

      {tab === 'apolices' && (
        <AutoPanel title="Apólices vinculadas" description="Abra uma apólice para consultar ou editar seus dados.">
          {apolices.length === 0 ? (
            <EmptyState icon={<Car className="h-5 w-5" />} title="Sem apólices" description="Nenhuma apólice vinculada a este cliente." />
          ) : (
            <div className="auto-v2-stagger space-y-2">
              {apolices.map(item => (
                <AutoListRow
                  key={item.id}
                  title={item.numero_apolice || 'Sem número'}
                  subtitle={`${item.seguradora || 'Sem seguradora'} · ${item.modelo_veiculo || 'Veículo não informado'}`}
                  meta={`${formatDateBR(item.vigencia_inicio)} até ${formatDateBR(item.vigencia_fim)}`}
                  leading={<ShieldCheck />}
                  badges={item.origem_pre_sistema ? <AutoBadge tone="warning">Anterior ao sistema</AutoBadge> : null}
                  onClick={() => navigate(`/auto/apolices/${item.id}`)}
                />
              ))}
            </div>
          )}
        </AutoPanel>
      )}

      {tab === 'renovacoes' && (
        <AutoPanel title="Renovações vinculadas" description="Vencimentos e andamento da carteira.">
          {renovacoes.length === 0 ? (
            <EmptyState icon={<RefreshCw className="h-5 w-5" />} title="Sem renovações" description="Nenhuma renovação vinculada a este cliente." />
          ) : (
            <div className="auto-v2-stagger space-y-2">
              {renovacoes.map(item => (
                <AutoListRow
                  key={item.id}
                  title={item.apolices_auto?.numero_apolice || 'Sem apólice'}
                  subtitle={item.seguradora || 'Sem seguradora'}
                  meta={formatDateBR(item.vigencia_fim)}
                  leading={<RefreshCw />}
                  badges={<AutoBadge tone="renewal">{item.status_renovacao || 'Pendente'}</AutoBadge>}
                  onClick={item.apolices_auto?.id
                    ? () => navigate(`/auto/apolices/${item.apolices_auto.id}`)
                    : undefined}
                />
              ))}
            </div>
          )}
        </AutoPanel>
      )}

      {tab === 'cotacoes' && (
        <AutoPanel title="Histórico de cotações" description="Movimento comercial gerado para o cliente.">
          {cotacoes.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="Sem cotações" description="Nenhuma cotação registrada para este cliente." />
          ) : (
            <div className="auto-v2-stagger space-y-2">
              {cotacoes.map(item => (
                <AutoListRow
                  key={item.id}
                  title={item.modelo_veiculo || 'Veículo não informado'}
                  subtitle={item.origem_lead || 'Origem não informada'}
                  meta={formatDateTimeBR(item.created_at)}
                  leading={<FileText />}
                  badges={<AutoBadge tone="info">{item.status || 'Pendente'}</AutoBadge>}
                  onClick={() => navigate(`/auto/cotacoes/${item.id}`)}
                />
              ))}
            </div>
          )}
        </AutoPanel>
      )}

      {tab === 'financeiro' && (
        <AutoPanel title="Histórico financeiro" description="Prêmio e comissão registrados por apólice.">
          {apolices.length === 0 ? (
            <EmptyState icon={<DollarSign className="h-5 w-5" />} title="Sem histórico financeiro" description="Nenhuma apólice emitida para gerar valores." />
          ) : (
            <div className="auto-v2-stagger space-y-2">
              {apolices.map(item => (
                <AutoListRow
                  key={item.id}
                  title={item.numero_apolice || 'Sem número'}
                  subtitle={`Prêmio ${formatMoney(item.premio_liquido || 0)}`}
                  meta={`Comissão ${formatMoney(item.valor_comissao || 0)}`}
                  leading={<DollarSign />}
                  onClick={() => navigate(`/auto/apolices/${item.id}`)}
                />
              ))}
            </div>
          )}
        </AutoPanel>
      )}

      {tab === 'atividade' && (
        <AutoPanel title="Atividade recente" description="Emissões relacionadas em ordem cronológica.">
          {emissoes.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Sem emissões" description="Nenhuma emissão encontrada para este cliente." />
          ) : (
            <div className="auto-v2-stagger space-y-2">
              {emissoes.map(item => (
                <AutoListRow
                  key={item.id}
                  title={item.seguradora || 'Sem seguradora'}
                  subtitle={item.coluna || 'Apólice emitida'}
                  meta={formatDateTimeBR(item.created_at)}
                  leading={<ClipboardList />}
                  onClick={() => navigate(item.apolices_auto?.[0]?.id
                    ? `/auto/apolices/${item.apolices_auto[0].id}`
                    : `/auto/emissoes/${item.id}`)}
                />
              ))}
            </div>
          )}
        </AutoPanel>
      )}
    </div>
  )
}
