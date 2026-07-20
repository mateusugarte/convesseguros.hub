import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BadgeDollarSign, Car, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, Save, Search, Users } from 'lucide-react'
import { DataCard, EmptyState, FilterBar, MetricCard, PageHeader } from '../../components/ui'
import { atualizarApoliceAuto, getAutoCarteiraClientes } from '../../lib/auto'
import { formatDateBR, formatMonthYearBR, getClienteStatusAuto } from './autoShared'

const PAGE_SIZE = 50

function clientKey(item) {
  return item.cliente_id || item.cpf_cliente || item.nome_cliente || item.emissoes_auto?.cliente_id || item.id
}

function clientName(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return item.nome_cliente || c.nome_cliente || c.nome_interessado || item.cpf_cliente || c.cpf_cliente || 'Cliente sem nome'
}

function clientCpf(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return item.cpf_cliente || c.cpf_cliente || ''
}

function emissionDate(item) {
  return item.vigencia_inicio || item.created_at || null
}

function firstLetterOf(name) {
  const clean = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
  const match = clean.match(/[A-Z]/)
  return match ? match[0] : '#'
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
          Número da apólice
        </label>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Digite o número da apólice" className="input text-sm" />
      </div>
      <button type="button" onClick={() => onSave(draft)} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

function EmissionRow({ apolice, onSaveNumero, savingId, onOpenCotacao, onOpenApolice }) {
  const lead = apolice.emissoes_auto?.cotacoes_auto || {}
  const vigInicio = apolice.vigencia_inicio ? formatDateBR(apolice.vigencia_inicio) : 'Sem início'
  const vigFim = apolice.vigencia_fim ? formatDateBR(apolice.vigencia_fim) : 'Sem fim'
  const isSaving = savingId === apolice.id

  return (
    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-dark-text">{lead.nome_cliente || apolice.nome_cliente || 'Cliente sem nome'}</p>
            <span className="badge badge-info">{apolice.seguradora || 'Sem seguradora'}</span>
            {apolice.numero_apolice ? <span className="badge badge-success">{apolice.numero_apolice}</span> : <span className="badge badge-warning">Sem número</span>}
            {apolice.origem_pre_sistema && <span className="badge badge-warning">Emitida antes do sistema</span>}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-dark-muted sm:grid-cols-2 xl:grid-cols-4">
            <span><strong className="text-dark-text">Vigência:</strong> {vigInicio} - {vigFim}</span>
            <span><strong className="text-dark-text">CPF:</strong> {lead.cpf_cliente || apolice.cpf_cliente || '—'}</span>
            <span><strong className="text-dark-text">Veículo:</strong> {lead.modelo_veiculo || apolice.modelo_veiculo || '—'}</span>
            <span><strong className="text-dark-text">Placa:</strong> {lead.placa || apolice.placa || '—'}</span>
          </div>
          <div className="mt-2 text-xs text-dark-muted">
            {lead.origem_lead ? `Origem: ${lead.origem_lead}` : 'Origem não informada'}
            {lead.condutor_nome ? ` · Condutor: ${lead.condutor_nome}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenApolice(apolice.id)} className="inline-flex items-center gap-1.5 rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-2 text-xs font-semibold text-status-info">
            Abrir apólice
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {apolice.emissoes_auto?.cotacao_id && (
            <button type="button" onClick={() => onOpenCotacao(apolice.emissoes_auto.cotacao_id)} className="inline-flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text">
              Abrir cotação
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ApoliceEditor apolice={apolice} onSave={numero => onSaveNumero(apolice.id, numero)} saving={isSaving} />
      </div>
    </div>
  )
}

function LetterFilterBar({ value, onChange, availableLetters }) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${value === '' ? 'bg-brand-secondary text-white' : 'bg-dark-surface/70 text-dark-muted hover:text-dark-text'}`}
      >
        Todos
      </button>
      {letters.map(letter => {
        const has = availableLetters.has(letter)
        return (
          <button
            key={letter}
            type="button"
            disabled={!has}
            onClick={() => onChange(letter)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              value === letter
                ? 'bg-brand-secondary text-white'
                : has
                  ? 'bg-dark-surface/70 text-dark-muted hover:text-dark-text'
                  : 'cursor-not-allowed bg-dark-surface/30 text-dark-muted/30'
            }`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" /> Anterior
      </button>
      <span className="text-xs font-medium text-dark-muted">Página {page} de {totalPages}</span>
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40">
        Próxima <ChevronRight className="h-4 w-4" />
      </button>
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
  const [letraFiltro, setLetraFiltro] = useState('')
  const [sortBy, setSortBy] = useState('nome')
  const [page, setPage] = useState(1)

  const { data: apolices = [], isLoading } = useQuery({
    queryKey: ['auto-clientes-carteira', search, seguradora, inicio, fim],
    queryFn: () => getAutoCarteiraClientes({ search, seguradora: seguradora || undefined, inicio: inicio || undefined, fim: fim || undefined }),
  })

  const { mutateAsync: salvarNumero, isPending, variables } = useMutation({
    mutationFn: ({ id, numero }) => atualizarApoliceAuto(id, { numero_apolice: numero.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    },
  })

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const grouped = useMemo(() => {
    const map = new Map()
    apolices.forEach(item => {
      const key = clientKey(item)
      if (!map.has(key)) {
        map.set(key, { key, name: clientName(item), cpf: clientCpf(item), items: [] })
      }
      map.get(key).items.push(item)
    })

    return Array.from(map.values()).map(group => {
      const sortedItems = [...group.items].sort((a, b) => new Date(emissionDate(b) || 0).getTime() - new Date(emissionDate(a) || 0).getTime())
      const clienteDesde = sortedItems.reduce((min, item) => {
        if (!item.vigencia_inicio) return min
        return !min || item.vigencia_inicio < min ? item.vigencia_inicio : min
      }, null)
      const status = getClienteStatusAuto(sortedItems, hoje)
      return { ...group, items: sortedItems, latest: sortedItems[0], clienteDesde, status }
    })
  }, [apolices, hoje])

  const metrics = useMemo(() => {
    const totalClientes = grouped.length
    const totalApolices = apolices.length
    const comNumero = apolices.filter(item => Boolean(item.numero_apolice?.trim())).length
    const multiEmissao = grouped.filter(group => group.items.length > 1).length
    return { totalClientes, totalApolices, comNumero, multiEmissao }
  }, [apolices, grouped])

  const seguradorasDisponiveis = useMemo(() => {
    const set = new Set()
    apolices.forEach(item => { if (item.seguradora) set.add(item.seguradora) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [apolices])

  const availableLetters = useMemo(() => {
    const set = new Set()
    grouped.forEach(group => set.add(firstLetterOf(group.name)))
    return set
  }, [grouped])

  const filteredByLetter = useMemo(() => {
    if (!letraFiltro) return grouped
    return grouped.filter(group => firstLetterOf(group.name) === letraFiltro)
  }, [grouped, letraFiltro])

  const sortedGrouped = useMemo(() => {
    const list = [...filteredByLetter]
    list.sort((a, b) => {
      if (sortBy === 'quantidade') return b.items.length - a.items.length
      if (sortBy === 'antigo') return (a.clienteDesde || '9999-99-99').localeCompare(b.clienteDesde || '9999-99-99')
      if (sortBy === 'recente') return (emissionDate(b.latest) || '').localeCompare(emissionDate(a.latest) || '')
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
    return list
  }, [filteredByLetter, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedGrouped.length / PAGE_SIZE))

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedGrouped.slice(start, start + PAGE_SIZE)
  }, [sortedGrouped, page])

  useEffect(() => {
    setPage(1)
  }, [search, seguradora, inicio, fim, letraFiltro, sortBy])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const savingId = isPending ? variables?.id : null

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Clientes e carteira"
        description="Área consolidada da carteira Auto. Abra cada cliente como um perfil completo e navegue pelas apólices emitidas e histórico operacional."
        actions={(<button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Voltar às emissões</button>)}
        stats={(
          <>
            <MetricCard label="Clientes" value={metrics.totalClientes} hint="clientes distintos" tone="accent" icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={metrics.totalApolices} hint="registros na carteira" tone="secondary" icon={<ClipboardList className="h-4 w-4" />} />
            <MetricCard label="Com número" value={metrics.comNumero} hint="apólices preenchidas" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <MetricCard label="Recorrentes" value={metrics.multiEmissao} hint="mais de uma emissão" tone="warning" icon={<BadgeDollarSign className="h-4 w-4" />} />
          </>
        )}
      />

      <FilterBar>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.5fr_0.5fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, veículo, placa, apólice..." className="input pl-10" />
          </div>
          <select value={seguradora} onChange={e => setSeguradora(e.target.value)} className="select">
            <option value="">Todas as seguradoras</option>
            {seguradorasDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="input" />
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="input" />
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <LetterFilterBar value={letraFiltro} onChange={setLetraFiltro} availableLetters={availableLetters} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select lg:w-64">
            <option value="nome">Ordem alfabética</option>
            <option value="recente">Mais recentes primeiro</option>
            <option value="quantidade">Mais apólices primeiro</option>
            <option value="antigo">Clientes mais antigos</option>
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-dark-muted">Carregando carteira...</div>
      ) : sortedGrouped.length === 0 ? (
        <EmptyState icon={<Car className="h-5 w-5" />} title="Nenhuma emissão encontrada" description="Tente outro período, seguradora, letra ou termo de busca." />
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map(group => (
              <DataCard
                key={group.key}
                title={group.name}
                subtitle={`${group.items.length} apólice(s)${group.clienteDesde ? ` · cliente desde ${formatMonthYearBR(group.clienteDesde)}` : ''}`}
                actions={(
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {group.status && (
                      <span className={`badge ${group.status === 'ativo' ? 'badge-success' : 'badge-muted'}`}>
                        {group.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                    {group.cpf && <span className="badge badge-muted">{group.cpf}</span>}
                  </div>
                )}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/auto/clientes/${encodeURIComponent(group.key)}`)}
                  className="mb-4 flex w-full items-center justify-between rounded-[28px] border border-brand-secondary/15 bg-gradient-to-r from-brand-secondary/8 via-dark-surface/40 to-brand-accent/8 px-4 py-4 text-left transition-colors hover:border-brand-secondary/30"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Perfil do cliente</p>
                    <p className="mt-1 text-base font-semibold text-dark-text">Abrir área completa com histórico, renovações e vínculo com a corretora</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-secondary/20 bg-dark-surface/80 px-3 py-2 text-xs font-semibold text-status-info">
                    <Eye className="h-4 w-4" />
                    Abrir perfil
                  </span>
                </button>

                <div className="space-y-3">
                  {group.items.map(item => (
                    <EmissionRow
                      key={item.id}
                      apolice={item}
                      onSaveNumero={async (id, numero) => { await salvarNumero({ id, numero }) }}
                      savingId={savingId}
                      onOpenCotacao={cotacaoId => navigate(`/auto/cotacoes/${cotacaoId}`)}
                      onOpenApolice={apoliceId => navigate(`/auto/apolices/${apoliceId}`)}
                    />
                  ))}
                </div>
              </DataCard>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
