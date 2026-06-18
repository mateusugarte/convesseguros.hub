import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BadgeDollarSign, Car, CheckCircle2, ClipboardList, Search, Save, Users } from 'lucide-react'
import { DataCard, EmptyState, FilterBar, MetricCard, PageHeader } from '../../components/ui'
import { atualizarApoliceAuto, getAutoCarteiraClientes } from '../../lib/auto'
import { formatDateBR } from './autoShared'

function clientKey(item) {
  return item.cliente_id || item.cpf_cliente || item.nome_cliente || item.emissoes_auto?.cliente_id || item.id
}

function clientName(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return (
    item.nome_cliente ||
    c.nome_cliente ||
    c.nome_interessado ||
    item.cpf_cliente ||
    c.cpf_cliente ||
    'Cliente sem nome'
  )
}

function clientCpf(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return item.cpf_cliente || c.cpf_cliente || ''
}

function emissionDate(item) {
  return item.vigencia_inicio || item.created_at || null
}

function ApoliceEditor({ apolice, onSave, saving }) {
  const [draft, setDraft] = useState(apolice.numero_apolice || '')

  useEffect(() => {
    setDraft(apolice.numero_apolice || '')
  }, [apolice.id, apolice.numero_apolice])

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
          Numero da apolice
        </label>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Digite o numero da apolice"
          className="input text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => onSave(draft)}
        disabled={saving}
        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-secondary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

function EmissionRow({ apolice, onSaveNumero, savingId, onOpen }) {
  const lead = apolice.emissoes_auto?.cotacoes_auto || {}
  const vigInicio = apolice.vigencia_inicio ? formatDateBR(apolice.vigencia_inicio) : 'Sem início'
  const vigFim = apolice.vigencia_fim ? formatDateBR(apolice.vigencia_fim) : 'Sem fim'
  const isSaving = savingId === apolice.id

  return (
    <div className="rounded-3xl border border-dark-border/70 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-dark-text">
              {lead.nome_cliente || apolice.nome_cliente || 'Cliente sem nome'}
            </p>
            <span className="badge badge-info">{apolice.seguradora || 'Sem seguradora'}</span>
            {apolice.numero_apolice ? (
              <span className="badge badge-success">{apolice.numero_apolice}</span>
            ) : (
              <span className="badge badge-warning">Sem numero</span>
            )}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-dark-muted sm:grid-cols-2 xl:grid-cols-4">
            <span><strong className="text-dark-text">Vigência:</strong> {vigInicio} - {vigFim}</span>
            <span><strong className="text-dark-text">CPF:</strong> {lead.cpf_cliente || apolice.cpf_cliente || '—'}</span>
            <span><strong className="text-dark-text">Veículo:</strong> {lead.modelo_veiculo || '—'}</span>
            <span><strong className="text-dark-text">Placa:</strong> {lead.placa || '—'}</span>
          </div>
          <div className="mt-2 text-xs text-dark-muted">
            {lead.origem_lead ? `Origem: ${lead.origem_lead}` : 'Origem não informada'}
            {lead.condutor_nome ? ` · Condutor: ${lead.condutor_nome}` : ''}
          </div>
        </div>

        {apolice.emissoes_auto?.cotacao_id && (
          <button
            type="button"
            onClick={() => onOpen(apolice.emissoes_auto.cotacao_id)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
          >
            Abrir cotação
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-4">
        <ApoliceEditor
          apolice={apolice}
          onSave={numero => onSaveNumero(apolice.id, numero)}
          saving={isSaving}
        />
      </div>
    </div>
  )
}

export default function AutoClientes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [seguradora, setSeguradora] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const { data: apolices = [], isLoading } = useQuery({
    queryKey: ['auto-clientes-carteira', search, seguradora, inicio, fim],
    queryFn: () => getAutoCarteiraClientes({
      search,
      seguradora: seguradora || undefined,
      inicio: inicio || undefined,
      fim: fim || undefined,
    }),
  })

  const { mutateAsync: salvarNumero, isPending, variables } = useMutation({
    mutationFn: ({ id, numero }) => atualizarApoliceAuto(id, { numero_apolice: numero.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    },
  })

  const grouped = useMemo(() => {
    const map = new Map()

    apolices.forEach(item => {
      const key = clientKey(item)
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: clientName(item),
          cpf: clientCpf(item),
          items: [],
        })
      }
      map.get(key).items.push(item)
    })

    return Array.from(map.values())
      .map(group => {
        const sortedItems = [...group.items].sort((a, b) => {
          const da = new Date(emissionDate(a) || 0).getTime()
          const db = new Date(emissionDate(b) || 0).getTime()
          return db - da
        })

        return {
          ...group,
          items: sortedItems,
          latest: sortedItems[0],
        }
      })
      .sort((a, b) => {
        const da = new Date(emissionDate(a.latest) || 0).getTime()
        const db = new Date(emissionDate(b.latest) || 0).getTime()
        return db - da
      })
  }, [apolices])

  const metrics = useMemo(() => {
    const totalClientes = grouped.length
    const totalApolices = apolices.length
    const comNumero = apolices.filter(item => Boolean(item.numero_apolice?.trim())).length
    const multiEmissao = grouped.filter(group => group.items.length > 1).length
    return { totalClientes, totalApolices, comNumero, multiEmissao }
  }, [apolices, grouped])

  const seguradorasDisponiveis = useMemo(() => {
    const set = new Set()
    apolices.forEach(item => {
      if (item.seguradora) set.add(item.seguradora)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [apolices])

  const savingId = isPending ? variables?.id : null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Clientes e emissões"
        description="Área consolidada da carteira Auto. Veja os clientes, as emissões e as apólices em ordem de vigência, do mais recente ao mais antigo."
        actions={(
          <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">
            Voltar ao kanban
          </button>
        )}
        stats={(
          <>
            <MetricCard label="Clientes" value={metrics.totalClientes} hint="clientes distintos" tone="accent" icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Emissões" value={metrics.totalApolices} hint="registros na carteira" tone="secondary" icon={<ClipboardList className="h-4 w-4" />} />
            <MetricCard label="Com número" value={metrics.comNumero} hint="apólices preenchidas" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <MetricCard label="Mais de uma" value={metrics.multiEmissao} hint="clientes recorrentes" tone="warning" icon={<BadgeDollarSign className="h-4 w-4" />} />
          </>
        )}
      />

      <FilterBar>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.5fr_0.5fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente, veículo, placa, apólice..."
              className="input pl-10"
            />
          </div>

          <select
            value={seguradora}
            onChange={e => setSeguradora(e.target.value)}
            className="select"
          >
            <option value="">Todas as seguradoras</option>
            {seguradorasDisponiveis.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <input
            type="date"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
            className="input"
          />

          <input
            type="date"
            value={fim}
            onChange={e => setFim(e.target.value)}
            className="input"
          />
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-dark-muted">Carregando carteira...</div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<Car className="h-5 w-5" />}
          title="Nenhuma emissão encontrada"
          description="Tente outro período, seguradora ou termo de busca."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <DataCard
              key={group.key}
              title={group.name}
              subtitle={`${group.items.length} emissão(ões)`}
              actions={group.cpf ? <span className="badge badge-muted">{group.cpf}</span> : null}
            >
              <div className="space-y-3">
                {group.items.map(item => (
                  <EmissionRow
                    key={item.id}
                    apolice={item}
                    onSaveNumero={async (id, numero) => {
                      await salvarNumero({ id, numero })
                    }}
                    savingId={savingId}
                    onOpen={cotacaoId => navigate(`/auto/cotacoes/${cotacaoId}`)}
                  />
                ))}
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  )
}
