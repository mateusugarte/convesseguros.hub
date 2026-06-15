import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, CheckCircle2, FileText, RefreshCw, Search, X } from 'lucide-react'
import { getEmissoesAuto, moverEmissaoColuna, emitirApoliceAuto, getEmissaoColuna, getApolicesAuto } from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, FilterBar, EmptyState } from '../../components/ui'
import { formatDateBR, formatMoney } from './autoShared'

const COLUNAS = [
  { id: 'pendentes', label: 'Cotacoes pendentes', hint: 'chegam vazias do formulario', tone: 'warning' },
  { id: 'cotacao_feita', label: 'Cotacao feita', hint: 'primeiro corte operacional', tone: 'secondary' },
  { id: 'negociando', label: 'Negociando', hint: 'em tratativa com cliente', tone: 'accent' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria', hint: 'dependem de validacao', tone: 'warning' },
  { id: 'emitida', label: 'Emitida', hint: 'prontas para apolice', tone: 'success' },
]

const FORM_VAZIO = {
  seguradora: '',
  numero_apolice: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  premio_liquido: '',
  pct_comissao: '',
  forma_pagamento: '',
  parcelamento: '',
  tipo_producao: 'equipe',
  responsavel: '',
  eh_renovacao: false,
  tem_repasse: false,
  pct_repasse: '',
  nome_repasse: '',
}

function CardEmissao({ emissao, onDragStart }) {
  const coluna = getEmissaoColuna(emissao)
  const tipo = emissao.cotacoes_auto?.tipo || emissao.tipo
  const isRenovacao = tipo === 'renovacao'
  const isPendente = coluna === 'pendentes'
  const accent = isPendente ? 'from-status-warning to-brand-gold' : isRenovacao ? 'from-status-success to-brand-secondary' : 'from-brand-secondary to-brand-accent'

  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(emissao)}
      className={`group relative w-full overflow-hidden rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 ${
        isPendente
          ? 'border-status-warning/20 bg-status-warning/5'
          : isRenovacao
            ? 'border-status-success/20 bg-status-success/5'
            : 'border-brand-secondary/20 bg-brand-secondary/5'
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-dark-text">
            {emissao.clientes_auto?.nome_completo || '-'}
          </p>
          <p className="mt-1 truncate text-xs text-dark-muted">
            {emissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado'}
          </p>
          <p className="mt-2 text-[11px] text-dark-muted">
            {emissao.cotacoes_auto?.placa ? `Placa ${emissao.cotacoes_auto.placa}` : 'Sem placa informada ainda'}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            isPendente
              ? 'bg-status-warning/10 text-status-warning'
              : isRenovacao
                ? 'bg-status-success/10 text-status-success'
                : 'bg-brand-secondary/10 text-brand-secondary'
          }`}
        >
          {isPendente ? 'Pendente' : isRenovacao ? 'Renovacao' : 'Novo'}
        </span>
      </div>
    </button>
  )
}

function ModalApolices({ onClose }) {
  const [search, setSearch] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  const { data: apolices = [], isLoading } = useQuery({
    queryKey: ['auto-apolices', search, inicio, fim],
    queryFn: () => getApolicesAuto({ search, inicio: inicio || undefined, fim: fim || undefined }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-8 backdrop-blur-sm overflow-y-auto">
      <div className="glass-modal w-full max-w-5xl rounded-[28px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="title-section text-dark-text">Apolices emitidas</h2>
            <p className="mt-1 text-sm text-dark-muted">Consulte todas as apolices de auto emitidas com filtro por periodo e busca.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-dark-border/40 transition-colors">
            <X className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, apolice ou seguradora"
              className="w-full rounded-2xl border border-dark-border bg-white/80 py-2 pl-10 pr-3 text-sm text-dark-text outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={inicio}
              onChange={e => setInicio(e.target.value)}
              className="rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            />
            <span className="text-xs text-dark-muted">ate</span>
            <input
              type="date"
              value={fim}
              onChange={e => setFim(e.target.value)}
              className="rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            />
            {(inicio || fim) && (
              <button
                onClick={() => { setInicio(''); setFim('') }}
                className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando apolices...</div>
        ) : apolices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="Nenhuma apolice encontrada"
            description="Ajuste os filtros ou emita a primeira apolice pelo kanban de emissoes."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border/60 text-left">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Apolice</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vigencia</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Premio liq.</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Comissao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {apolices.map(item => (
                  <tr key={item.id} className="transition-colors hover:bg-brand-accent/5">
                    <td className="py-3 pr-4 font-medium text-dark-text">{item.clientes_auto?.nome_completo || '-'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.numero_apolice || '-'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.seguradora || '-'}</td>
                    <td className="py-3 pr-4 text-dark-muted">
                      {item.vigencia_inicio ? formatDateBR(item.vigencia_inicio) : '-'} — {item.vigencia_fim ? formatDateBR(item.vigencia_fim) : '-'}
                    </td>
                    <td className="py-3 pr-4 text-dark-muted">{formatMoney(item.premio_liquido)}</td>
                    <td className="py-3 font-medium text-status-success">{formatMoney(item.valor_comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CampoTexto({ label, campo, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(campo, e.target.value)}
        className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
      />
    </div>
  )
}

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [modalEmissao, setModalEmissao] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [showApolices, setShowApolices] = useState(false)
  const [filtroInicio, setFiltroInicio] = useState('')
  const [filtroFim, setFiltroFim] = useState('')

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes', filtroInicio, filtroFim],
    queryFn: () => getEmissoesAuto({ inicio: filtroInicio || undefined, fim: filtroFim || undefined }),
  })

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { mutate: emitir, isPending } = useMutation({
    mutationFn: payload => emitirApoliceAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setModalEmissao(null)
      setForm(FORM_VAZIO)
    },
  })

  function setField(campo, valor) {
    setForm(current => ({ ...current, [campo]: valor }))
  }

  function handleDrop(colunaDestino) {
    if (!dragging) return
    if (colunaDestino === 'emitida') {
      setModalEmissao(dragging)
    } else {
      mover({ id: dragging.id, coluna: colunaDestino === 'pendentes' ? null : colunaDestino })
    }
    setDragging(null)
    setDragOver(null)
  }

  const premioLiquido = parseFloat(form.premio_liquido) || 0
  const pctComissao = parseFloat(form.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
  const valorRepasse = form.tem_repasse ? valorComissao * (parseFloat(form.pct_repasse) || 0) : 0

  function handleEmitir() {
    emitir({
      emissao_id: modalEmissao.id,
      cliente_id: modalEmissao.cliente_id,
      seguradora: form.seguradora,
      numero_apolice: form.numero_apolice,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim,
      premio_liquido: premioLiquido,
      pct_comissao: pctComissao,
      valor_comissao: valorComissao,
      forma_pagamento: form.forma_pagamento,
      parcelamento: form.parcelamento,
      tipo_producao: form.tipo_producao,
      responsavel: form.tipo_producao === 'individual' ? form.responsavel : null,
      eh_renovacao: form.eh_renovacao,
      tem_repasse: form.tem_repasse,
      pct_repasse: form.tem_repasse ? parseFloat(form.pct_repasse) : null,
      nome_repasse: form.tem_repasse ? form.nome_repasse : null,
      valor_repasse: form.tem_repasse ? valorRepasse : null,
    })
    mover({ id: modalEmissao.id, coluna: 'emitida' })
  }

  const metricas = useMemo(() => ({
    total: emissoes.length,
    pendentes: emissoes.filter(item => getEmissaoColuna(item) === 'pendentes').length,
    renovacoes: emissoes.filter(item => (item.cotacoes_auto?.tipo || item.tipo) === 'renovacao').length,
    emitidas: emissoes.filter(item => getEmissaoColuna(item) === 'emitida').length,
  }), [emissoes])
  const boardSummary = [
    { label: 'Pendentes', value: metricas.pendentes, tone: 'warning' },
    { label: 'Em fila', value: metricas.total, tone: 'secondary' },
    { label: 'Renovacoes', value: metricas.renovacoes, tone: 'success' },
    { label: 'Emitidas', value: metricas.emitidas, tone: 'accent' },
  ]
  const modalResumo = modalEmissao ? {
    cliente: modalEmissao.clientes_auto?.nome_completo || '-',
    cpf: modalEmissao.clientes_auto?.cpf || '-',
    veiculo: modalEmissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado',
    placa: modalEmissao.cotacoes_auto?.placa || 'Sem placa',
    tipo: (modalEmissao.cotacoes_auto?.tipo || modalEmissao.tipo) === 'renovacao' ? 'Renovacao' : 'Novo',
    coluna: getEmissaoColuna(modalEmissao),
  } : null

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Gestao de Emissoes"
        description="Kanban operacional para conduzir cotacoes pendentes, negociacao, vistoria e emissao da carteira Auto."
        actions={(
          <button onClick={() => setShowApolices(true)} className="btn-secondary">
            Consultar apolices emitidas
          </button>
        )}
        stats={(
          <>
            <MetricCard label="Pendentes" value={metricas.pendentes} hint="cotacoes sem status" tone="warning" icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Em fila" value={metricas.total} hint="registros no kanban" icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Renovacoes" value={metricas.renovacoes} hint="itens de carteira" tone="success" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Emitidas" value={metricas.emitidas} hint="fechadas no fluxo" tone="accent" icon={<CheckCircle2 className="w-5 h-5" />} />
          </>
        )}
      />

      <DataCard className="overflow-hidden border-brand-secondary/10" bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-secondary/12 via-transparent to-brand-accent/8 p-6 md:p-8">
            <div className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-brand-secondary/10 blur-3xl" />
            <div className="absolute -bottom-4 left-1/3 h-24 w-24 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-secondary/15 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">
                <RefreshCw className="h-3.5 w-3.5" />
                Mesa operacional
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Cotacoes pendentes entram primeiro. Emitidas ficam visiveis sem ruido.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                O kanban agora separa a entrada crua do formulario da movimentacao operacional,
                dando mais clareza para priorizar o que ainda nao recebeu status.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-warning">{metricas.pendentes} pendentes</span>
                <span className="badge badge-info">{metricas.total} registros</span>
                <span className="badge badge-success">{metricas.emitidas} emitidas</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
            {boardSummary.map(item => {
              const barClasses = {
                warning: 'bg-status-warning/15',
                secondary: 'bg-brand-secondary/15',
                success: 'bg-status-success/15',
                accent: 'bg-brand-accent/15',
              }
              return (
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-white/75 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
                <div className={`mt-3 h-1.5 rounded-full ${barClasses[item.tone]}`} />
              </div>
              )
            })}
          </div>
        </div>
      </DataCard>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-dark-muted font-medium">Filtrar por data</span>
          <input
            type="date"
            value={filtroInicio}
            onChange={e => setFiltroInicio(e.target.value)}
            className="rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
          />
          <span className="text-xs text-dark-muted">ate</span>
          <input
            type="date"
            value={filtroFim}
            onChange={e => setFiltroFim(e.target.value)}
            className="rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
          />
          {(filtroInicio || filtroFim) && (
            <button
              onClick={() => { setFiltroInicio(''); setFiltroFim('') }}
              className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text"
            >
              Limpar filtro
            </button>
          )}
        </div>
      </FilterBar>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-5">
        {COLUNAS.map(coluna => {
          const cards = emissoes.filter(item => getEmissaoColuna(item) === coluna.id)

          return (
            <DataCard
              key={coluna.id}
              title={coluna.label}
              subtitle={`${cards.length} item(ns)`}
              className={dragOver === coluna.id ? 'ring-2 ring-brand-accent/20' : ''}
              bodyClassName="pt-4"
            >
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(coluna.id) }}
                onDrop={() => handleDrop(coluna.id)}
                onDragLeave={() => setDragOver(null)}
                className="min-h-[240px] space-y-3"
              >
                {cards.length === 0 ? (
                  <EmptyState
                    icon={<Car className="w-6 h-6" />}
                    title={coluna.id === 'pendentes' ? 'Sem pendencias' : 'Coluna vazia'}
                    description={coluna.id === 'pendentes'
                      ? 'As cotacoes criadas pelo formulario aparecem aqui antes de receberem um status.'
                      : 'Arraste um item para continuar o fluxo.'}
                    className="py-8"
                  />
                ) : (
                  cards.map(item => (
                    <CardEmissao key={item.id} emissao={item} onDragStart={setDragging} />
                  ))
                )}
              </div>
            </DataCard>
          )
        })}
      </div>

      {modalEmissao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="glass-modal w-full max-w-6xl overflow-hidden rounded-[32px]">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="relative overflow-hidden bg-gradient-to-br from-brand-secondary/12 via-dark-surface2/70 to-brand-accent/10 p-6 md:p-7">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/40 blur-3xl" />
                <div className="relative z-[1]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">
                    <FileText className="h-3.5 w-3.5" />
                    Emissao selecionada
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-dark-text">Emitir apolice</h2>
                  <p className="mt-2 text-sm leading-6 text-dark-muted">{modalResumo?.cliente}</p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Cliente</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalResumo?.cliente}</p>
                      <p className="mt-1 text-xs text-dark-muted">CPF {modalResumo?.cpf}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Veiculo</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalResumo?.veiculo}</p>
                      <p className="mt-1 text-xs text-dark-muted">{modalResumo?.placa}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Contexto</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-info">{modalResumo?.tipo}</span>
                        <span className="badge badge-muted">{modalResumo?.coluna}</span>
                      </div>
                    </div>
                  </div>

                  {premioLiquido > 0 && pctComissao > 0 && (
                    <div className="mt-6 rounded-3xl border border-status-success/20 bg-status-success/10 px-4 py-4 text-sm font-medium text-status-success shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-status-success/80">Comissao calculada</p>
                      <p className="mt-2 text-2xl font-semibold">{formatMoney(valorComissao)}</p>
                      <p className="mt-1 text-xs text-status-success/80">baseado no premio liquido informado</p>
                    </div>
                  )}
                </div>
              </aside>

              <div className="overflow-y-auto bg-white/70 p-6 md:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Dados da apolice</p>
                    <h3 className="mt-2 text-xl font-semibold text-dark-text">Preencher e confirmar emissao</h3>
                    <p className="mt-1 text-sm text-dark-muted">Organizei o formulario em blocos menores para leitura e preenchimento mais rapido.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Seguradora" campo="seguradora" value={form.seguradora} onChange={setField} />
                    <CampoTexto label="Numero da apolice" campo="numero_apolice" value={form.numero_apolice} onChange={setField} />
                    <CampoTexto label="Vigencia inicio" campo="vigencia_inicio" value={form.vigencia_inicio} onChange={setField} type="date" />
                    <CampoTexto label="Vigencia fim" campo="vigencia_fim" value={form.vigencia_fim} onChange={setField} type="date" />
                    <CampoTexto label="Premio liquido" campo="premio_liquido" value={form.premio_liquido} onChange={setField} type="number" />
                    <CampoTexto label="% Comissao" campo="pct_comissao" value={form.pct_comissao} onChange={setField} type="number" />
                    <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento} onChange={setField} />
                    <CampoTexto label="Parcelamento" campo="parcelamento" value={form.parcelamento} onChange={setField} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo de producao</label>
                      <select
                        value={form.tipo_producao}
                        onChange={e => setField('tipo_producao', e.target.value)}
                        className="w-full rounded-2xl border border-dark-border bg-white/90 px-3 py-2 text-sm text-dark-text outline-none"
                      >
                        <option value="equipe">Equipe</option>
                        <option value="individual">Individual</option>
                      </select>
                    </div>

                    {form.tipo_producao === 'individual' && (
                      <CampoTexto label="Responsavel" campo="responsavel" value={form.responsavel} onChange={setField} />
                    )}
                  </div>

                  <div className="grid gap-3 rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <label className="flex items-center gap-2 text-sm text-dark-text">
                      <input
                        type="checkbox"
                        checked={form.eh_renovacao}
                        onChange={e => setField('eh_renovacao', e.target.checked)}
                      />
                      E renovacao da carteira?
                    </label>

                    <label className="flex items-center gap-2 text-sm text-dark-text">
                      <input
                        type="checkbox"
                        checked={form.tem_repasse}
                        onChange={e => setField('tem_repasse', e.target.checked)}
                      />
                      Existe repasse?
                    </label>
                  </div>

                  {form.tem_repasse && (
                    <div className="grid gap-4 rounded-3xl border border-brand-secondary/20 bg-brand-secondary/8 p-4 md:grid-cols-2">
                      <CampoTexto label="% Repasse" campo="pct_repasse" value={form.pct_repasse} onChange={setField} type="number" />
                      <CampoTexto label="Nome do repasse" campo="nome_repasse" value={form.nome_repasse} onChange={setField} />
                      {valorRepasse > 0 && (
                        <div className="md:col-span-2 rounded-2xl border border-brand-secondary/20 bg-white/70 px-4 py-3 text-sm font-medium text-brand-secondary">
                          Repasse calculado: {formatMoney(valorRepasse)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3 border-t border-dark-border/60 pt-5">
                  <button
                    onClick={() => { setModalEmissao(null); setForm(FORM_VAZIO) }}
                    className="btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEmitir}
                    disabled={isPending || !form.vigencia_fim}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {isPending ? 'Emitindo...' : 'Confirmar emissao'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApolices && <ModalApolices onClose={() => setShowApolices(false)} />}
    </div>
  )
}
