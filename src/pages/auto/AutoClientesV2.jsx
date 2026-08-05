import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeDollarSign,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Save,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  AutoBadge,
  AutoListRow,
  AutoLoading,
  AutoPageHeader,
  AutoPanel,
  AutoStatStrip,
} from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { atualizarApoliceAuto, getAutoCarteiraClientes } from '../../lib/auto'
import { formatDateBR, formatMonthYearBR, getClienteStatusAuto } from './autoShared'

const PAGE_SIZE = 50
const CLIENT_FILTERS_KEY = 'auto-clientes-workspace-filters-v1'

function readClientFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENT_FILTERS_KEY) || '{}')
    return {
      search: typeof saved.search === 'string' ? saved.search : '',
      seguradora: typeof saved.seguradora === 'string' ? saved.seguradora : '',
      inicio: typeof saved.inicio === 'string' ? saved.inicio : '',
      fim: typeof saved.fim === 'string' ? saved.fim : '',
      letra: typeof saved.letra === 'string' ? saved.letra : '',
      sort: ['nome', 'recente', 'quantidade', 'antigo'].includes(saved.sort) ? saved.sort : 'nome',
      status: ['todos', 'ativo', 'inativo'].includes(saved.status) ? saved.status : 'todos',
    }
  } catch {
    return { search: '', seguradora: '', inicio: '', fim: '', letra: '', sort: 'nome', status: 'todos' }
  }
}

function clientKey(item) {
  return item.cliente_id || item.cpf_cliente || item.nome_cliente || item.emissoes_auto?.cliente_id || item.id
}

function clientName(item) {
  const cotacao = item.emissoes_auto?.cotacoes_auto || {}
  return item.nome_cliente || cotacao.nome_cliente || cotacao.nome_interessado || item.cpf_cliente || cotacao.cpf_cliente || 'Cliente sem nome'
}

function clientCpf(item) {
  const cotacao = item.emissoes_auto?.cotacoes_auto || {}
  return item.cpf_cliente || cotacao.cpf_cliente || ''
}

function emissionDate(item) {
  return item.vigencia_inicio || item.created_at || null
}

function firstLetterOf(name) {
  const clean = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
  const match = clean.match(/[A-Z]/)
  return match ? match[0] : '#'
}

function PolicyNumberEditor({ apolice, onSave, saving }) {
  const [draft, setDraft] = useState(apolice.numero_apolice || '')

  useEffect(() => {
    setDraft(apolice.numero_apolice || '')
  }, [apolice.id, apolice.numero_apolice])

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        value={draft}
        onChange={event => setDraft(event.target.value)}
        placeholder="Número da apólice"
        className="input min-w-0 text-sm"
        aria-label="Número da apólice"
      />
      <button
        type="button"
        title="Salvar número"
        onClick={() => onSave(draft)}
        disabled={saving}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-primary text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function LetterFilter({ value, onChange, availableLetters }) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Filtrar por letra">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold ${
          value === '' ? 'bg-brand-secondary text-white' : 'border border-dark-border text-dark-muted'
        }`}
      >
        Todos
      </button>
      {letters.map(letter => {
        const available = availableLetters.has(letter)
        return (
          <button
            key={letter}
            type="button"
            disabled={!available}
            onClick={() => onChange(letter)}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-semibold ${
              value === letter
                ? 'bg-brand-secondary text-white'
                : available
                  ? 'border border-dark-border text-dark-muted hover:text-dark-text'
                  : 'border border-transparent text-dark-muted/25'
            }`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}

export default function AutoClientesV2() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const savedFilters = useMemo(readClientFilters, [])
  const [search, setSearch] = useState(savedFilters.search)
  const [debouncedSearch, setDebouncedSearch] = useState(savedFilters.search)
  const [seguradora, setSeguradora] = useState(savedFilters.seguradora)
  const [inicio, setInicio] = useState(savedFilters.inicio)
  const [fim, setFim] = useState(savedFilters.fim)
  const [letraFiltro, setLetraFiltro] = useState(savedFilters.letra)
  const [sortBy, setSortBy] = useState(savedFilters.sort)
  const [statusFilter, setStatusFilter] = useState(savedFilters.status)
  const [page, setPage] = useState(1)
  const [expandedKey, setExpandedKey] = useState(null)

  const { data: apolices = [], isLoading, isError, error } = useQuery({
    queryKey: ['auto-clientes-carteira', debouncedSearch, seguradora, inicio, fim],
    queryFn: () => getAutoCarteiraClientes({
      search: debouncedSearch,
      seguradora: seguradora || undefined,
      inicio: inicio || undefined,
      fim: fim || undefined,
    }),
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 280)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    try {
      localStorage.setItem(CLIENT_FILTERS_KEY, JSON.stringify({
        search,
        seguradora,
        inicio,
        fim,
        letra: letraFiltro,
        sort: sortBy,
        status: statusFilter,
      }))
    } catch {}
  }, [search, seguradora, inicio, fim, letraFiltro, sortBy, statusFilter])

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
      const sortedItems = [...group.items].sort(
        (a, b) => new Date(emissionDate(b) || 0).getTime() - new Date(emissionDate(a) || 0).getTime(),
      )
      const clienteDesde = sortedItems.reduce((min, item) => {
        if (!item.vigencia_inicio) return min
        return !min || item.vigencia_inicio < min ? item.vigencia_inicio : min
      }, null)
      return {
        ...group,
        items: sortedItems,
        latest: sortedItems[0],
        clienteDesde,
        status: getClienteStatusAuto(sortedItems, hoje),
      }
    })
  }, [apolices, hoje])

  const metrics = useMemo(() => ({
    totalClientes: grouped.length,
    totalApolices: apolices.length,
    comNumero: apolices.filter(item => Boolean(item.numero_apolice?.trim())).length,
    multiEmissao: grouped.filter(group => group.items.length > 1).length,
  }), [apolices, grouped])

  const seguradorasDisponiveis = useMemo(() => (
    Array.from(new Set(apolices.map(item => item.seguradora).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
  ), [apolices])

  const availableLetters = useMemo(() => (
    new Set(grouped.map(group => firstLetterOf(group.name)))
  ), [grouped])

  const sortedGrouped = useMemo(() => {
    let filtered = letraFiltro
      ? grouped.filter(group => firstLetterOf(group.name) === letraFiltro)
      : [...grouped]
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(group => group.status === statusFilter)
    }
    filtered.sort((a, b) => {
      if (sortBy === 'quantidade') return b.items.length - a.items.length
      if (sortBy === 'antigo') return (a.clienteDesde || '9999-99-99').localeCompare(b.clienteDesde || '9999-99-99')
      if (sortBy === 'recente') return (emissionDate(b.latest) || '').localeCompare(emissionDate(a.latest) || '')
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
    return filtered
  }, [grouped, letraFiltro, sortBy, statusFilter])

  const totalPages = Math.max(1, Math.ceil(sortedGrouped.length / PAGE_SIZE))
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedGrouped.slice(start, start + PAGE_SIZE)
  }, [sortedGrouped, page])

  useEffect(() => {
    setPage(1)
    setExpandedKey(null)
  }, [search, seguradora, inicio, fim, letraFiltro, sortBy, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const savingId = isPending ? variables?.id : null
  const hasActiveFilters = Boolean(search || seguradora || inicio || fim || letraFiltro || sortBy !== 'nome' || statusFilter !== 'todos')

  function resetFilters() {
    setSearch('')
    setDebouncedSearch('')
    setSeguradora('')
    setInicio('')
    setFim('')
    setLetraFiltro('')
    setSortBy('nome')
    setStatusFilter('todos')
  }

  return (
    <div className="auto-page auto-v2-page auto-clients-workspace">
      <AutoPageHeader
        context="Carteira Auto"
        title="Clientes"
        description="Encontre clientes, apólices e veículos sem abrir blocos extensos."
        actions={(
          <button
            type="button"
            onClick={() => navigate('/auto/cotacoes?modo=novo')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Nova cotação
          </button>
        )}
      />

      <AutoStatStrip
        items={[
          { label: 'Clientes', value: metrics.totalClientes, hint: 'clientes distintos', icon: Users, tone: 'new' },
          { label: 'Apólices', value: metrics.totalApolices, hint: 'registros na carteira', icon: ClipboardList, tone: 'info' },
          { label: 'Com número', value: metrics.comNumero, hint: 'apólices preenchidas', icon: CheckCircle2, tone: 'success' },
          { label: 'Recorrentes', value: metrics.multiEmissao, hint: 'mais de uma apólice', icon: BadgeDollarSign, tone: 'renewal' },
        ]}
      />

      <AutoPanel
        title="Buscar e filtrar"
        description={`${sortedGrouped.length} cliente(s) no recorte atual. Os filtros ficam salvos neste dispositivo.`}
        actions={hasActiveFilters ? <button type="button" onClick={resetFilters} className="auto-filter-reset">Limpar filtros</button> : null}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.2fr)_minmax(170px,0.8fr)_145px_145px_170px_190px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cliente, CPF, veículo, placa ou apólice"
              className="input pl-10"
            />
          </div>
          <select value={seguradora} onChange={event => setSeguradora(event.target.value)} className="select">
            <option value="">Todas as seguradoras</option>
            {seguradorasDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="date" value={inicio} onChange={event => setInicio(event.target.value)} className="input" aria-label="Data inicial" />
          <input type="date" value={fim} onChange={event => setFim(event.target.value)} className="input" aria-label="Data final" />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="select">
            <option value="todos">Todos os clientes</option>
            <option value="ativo">Somente ativos</option>
            <option value="inativo">Somente inativos</option>
          </select>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)} className="select">
            <option value="nome">Ordem alfabética</option>
            <option value="recente">Mais recentes</option>
            <option value="quantidade">Mais apólices</option>
            <option value="antigo">Clientes mais antigos</option>
          </select>
        </div>
        <div className="mt-4">
          <LetterFilter value={letraFiltro} onChange={setLetraFiltro} availableLetters={availableLetters} />
        </div>
      </AutoPanel>

      <AutoPanel
        title="Carteira"
        description="Expanda uma linha para consultar e ajustar as apólices vinculadas."
        bodyClassName="p-0"
      >
        {isLoading ? (
          <AutoLoading label="Carregando carteira..." />
        ) : isError ? (
          <EmptyState
            icon={<Car className="h-5 w-5" />}
            title="Não foi possível carregar a carteira"
            description={error?.message || 'Tente novamente em alguns instantes.'}
          />
        ) : sortedGrouped.length === 0 ? (
          <EmptyState
            icon={<Car className="h-5 w-5" />}
            title="Nenhum cliente encontrado"
            description="Ajuste os filtros ou a busca para ampliar o resultado."
          />
        ) : (
          <div className="divide-y divide-dark-border/70">
            {paginated.map(group => {
              const expanded = expandedKey === group.key
              return (
                <section key={group.key} className="auto-v2-enter">
                  <div className="grid items-center gap-3 py-3 md:grid-cols-[minmax(0,1fr)_130px_150px_auto]">
                    <button
                      type="button"
                      onClick={() => setExpandedKey(current => current === group.key ? null : group.key)}
                      className="flex min-w-0 items-center gap-3 text-left"
                      aria-expanded={expanded}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-dark-border text-status-info">
                        <Users className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm text-dark-text">{group.name}</strong>
                        <span className="mt-0.5 block truncate text-xs text-dark-muted">
                          {group.cpf || 'CPF não informado'} · cliente desde {formatMonthYearBR(group.clienteDesde)}
                        </span>
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <AutoBadge tone={group.status === 'ativo' ? 'success' : 'neutral'}>
                        {group.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </AutoBadge>
                    </div>

                    <div className="text-xs text-dark-muted">
                      <strong className="block text-sm text-dark-text">{group.items.length}</strong>
                      apólice(s)
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Abrir perfil"
                        onClick={() => navigate(`/auto/clientes/${encodeURIComponent(group.key)}`)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-dark-border text-dark-muted hover:text-status-info"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title={expanded ? 'Recolher apólices' : 'Expandir apólices'}
                        onClick={() => setExpandedKey(current => current === group.key ? null : group.key)}
                        className="grid h-9 w-9 place-items-center rounded-md border border-dark-border text-dark-muted"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="auto-v2-enter space-y-2 border-t border-dark-border/60 bg-dark-surface2/35 px-3 py-3">
                      {group.items.map(apolice => {
                        const cotacao = apolice.emissoes_auto?.cotacoes_auto || {}
                        return (
                          <div key={apolice.id} className="grid items-center gap-3 rounded-lg border border-dark-border bg-dark-surface/80 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)_auto]">
                            <AutoListRow
                              title={apolice.seguradora || 'Sem seguradora'}
                              subtitle={`${cotacao.modelo_veiculo || apolice.modelo_veiculo || 'Veículo não informado'} · ${cotacao.placa || apolice.placa || 'Sem placa'}`}
                              meta={`${formatDateBR(apolice.vigencia_inicio)} até ${formatDateBR(apolice.vigencia_fim)}`}
                              leading={<ShieldCheck />}
                              badges={apolice.origem_pre_sistema ? <AutoBadge tone="warning">Anterior ao sistema</AutoBadge> : null}
                              onClick={() => navigate(`/auto/apolices/${apolice.id}`)}
                            />
                            <PolicyNumberEditor
                              apolice={apolice}
                              saving={savingId === apolice.id}
                              onSave={numero => salvarNumero({ id: apolice.id, numero })}
                            />
                            <button
                              type="button"
                              onClick={() => navigate(`/auto/apolices/${apolice.id}`)}
                              className="btn-secondary inline-flex items-center justify-center gap-1.5"
                            >
                              Abrir
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-dark-border/70 pt-4">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </button>
            <span className="text-xs font-medium text-dark-muted">Página {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </AutoPanel>
    </div>
  )
}
