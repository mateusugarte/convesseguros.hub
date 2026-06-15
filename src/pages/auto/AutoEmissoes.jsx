import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, CheckCircle2, FileText, RefreshCw } from 'lucide-react'
import { getEmissoesAuto, moverEmissaoColuna, emitirApoliceAuto } from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'

const COLUNAS = [
  { id: 'cotacao_feita', label: 'Cotacao feita' },
  { id: 'negociando', label: 'Negociando' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria' },
  { id: 'emitida', label: 'Emitida' },
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
  const tipo = emissao.cotacoes_auto?.tipo || emissao.tipo
  const isRenovacao = tipo === 'renovacao'

  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(emissao)}
      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 ${
        isRenovacao
          ? 'border-status-success/20 bg-status-success/5'
          : 'border-brand-secondary/20 bg-brand-secondary/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-dark-text">
            {emissao.clientes_auto?.nome_completo || '-'}
          </p>
          <p className="mt-1 truncate text-xs text-dark-muted">
            {emissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado'}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
          isRenovacao
            ? 'bg-status-success/10 text-status-success'
            : 'bg-brand-secondary/10 text-brand-secondary'
        }`}>
          {isRenovacao ? 'Renovacao' : 'Novo'}
        </span>
      </div>
    </button>
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

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes'],
    queryFn: getEmissoesAuto,
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
      mover({ id: dragging.id, coluna: colunaDestino })
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
    renovacoes: emissoes.filter(item => (item.cotacoes_auto?.tipo || item.tipo) === 'renovacao').length,
    emitidas: emissoes.filter(item => item.coluna === 'emitida').length,
  }), [emissoes])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Gestao de Emissoes"
        description="Kanban operacional para conduzir cotacao, negociacao, vistoria e emissao da carteira Auto."
        stats={(
          <>
            <MetricCard label="Em fila" value={metricas.total} hint="registros no kanban" icon={<FileText className="w-5 h-5" />} />
            <MetricCard label="Renovacoes" value={metricas.renovacoes} hint="itens de carteira" tone="success" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Emitidas" value={metricas.emitidas} hint="fechadas no fluxo" tone="accent" icon={<CheckCircle2 className="w-5 h-5" />} />
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {COLUNAS.map(coluna => {
          const cards = emissoes.filter(item => item.coluna === coluna.id)

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
                    title="Coluna vazia"
                    description="Arraste um item para continuar o fluxo."
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
          <div className="glass-modal w-full max-w-3xl overflow-y-auto rounded-[28px] p-6">
            <div className="mb-5">
              <h2 className="title-section text-dark-text">Emitir apolice</h2>
              <p className="mt-1 text-sm text-dark-muted">{modalEmissao.clientes_auto?.nome_completo || '-'}</p>
            </div>

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

            {premioLiquido > 0 && pctComissao > 0 && (
              <div className="mt-4 rounded-2xl border border-status-success/20 bg-status-success/10 px-4 py-3 text-sm font-medium text-status-success">
                Comissao calculada: R$ {valorComissao.toFixed(2)}
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo de producao</label>
                <select
                  value={form.tipo_producao}
                  onChange={e => setField('tipo_producao', e.target.value)}
                  className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
                >
                  <option value="equipe">Equipe</option>
                  <option value="individual">Individual</option>
                </select>
              </div>

              {form.tipo_producao === 'individual' && (
                <CampoTexto label="Responsavel" campo="responsavel" value={form.responsavel} onChange={setField} />
              )}
            </div>

            <div className="mt-4 space-y-3">
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
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <CampoTexto label="% Repasse" campo="pct_repasse" value={form.pct_repasse} onChange={setField} type="number" />
                <CampoTexto label="Nome do repasse" campo="nome_repasse" value={form.nome_repasse} onChange={setField} />
                {valorRepasse > 0 && (
                  <div className="md:col-span-2 rounded-2xl border border-brand-secondary/20 bg-brand-secondary/10 px-4 py-3 text-sm font-medium text-brand-secondary">
                    Repasse calculado: R$ {valorRepasse.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
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
      )}
    </div>
  )
}
