import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Car, CheckCircle2, FileText, RefreshCw, Search, X, Plus } from 'lucide-react'
import { format, startOfMonth, startOfWeek } from 'date-fns'
import {
  getEmissoesAuto, moverEmissaoColuna, emitirApoliceAuto,
  salvarResultadoCotacao, getEmissaoColuna, getApolicesAuto,
} from '../../lib/auto'
import { PageHeader, MetricCard, DataCard, FilterBar, EmptyState } from '../../components/ui'
import { formatDateBR, formatMoney } from './autoShared'

const COLUNAS = [
  { id: 'pendentes', label: 'Cotacoes pendentes', hint: 'entradas novas do n8n e itens sem andamento', tone: 'warning' },
  { id: 'cotacao_feita', label: 'Cotacao feita', hint: 'resultado registrado da cotacao', tone: 'secondary' },
  { id: 'negociando', label: 'Negociando', hint: 'em tratativa com cliente', tone: 'accent' },
  { id: 'aguardando_vistoria', label: 'Aguardando vistoria', hint: 'dependem de validacao', tone: 'warning' },
  { id: 'emitida', label: 'Emitida', hint: 'prontas para apolice', tone: 'success' },
]

const PERIOD_OPTIONS = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'custom', label: 'Personalizado' },
]

const FORM_EMISSAO_VAZIO = {
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

const NOVA_SEGURADORA = {
  nome: '',
  valor_total: '',
  premio_liquido: '',
  pct_comissao: '',
  parcelamentos: '',
  forma_pagamento: '',
}

function toDateInput(value) {
  return format(value, 'yyyy-MM-dd')
}

function getPeriodoRange(tipo) {
  const now = new Date()
  if (tipo === 'dia') {
    const today = toDateInput(now)
    return { inicio: today, fim: today }
  }
  if (tipo === 'semana') {
    return { inicio: toDateInput(startOfWeek(now, { weekStartsOn: 1 })), fim: toDateInput(now) }
  }
  if (tipo === 'mes') {
    return { inicio: toDateInput(startOfMonth(now)), fim: toDateInput(now) }
  }
  return { inicio: '', fim: '' }
}

function nomeEmissao(emissao) {
  const c = emissao.cotacoes_auto || {}
  return c.nome_cliente || c.condutor_nome || '—'
}

// ─── Card ───────────────────────────────────────────────────────────────────

function CardEmissao({ emissao, onDragStart, onClick }) {
  const coluna = getEmissaoColuna(emissao)
  const tipo = emissao.cotacoes_auto?.tipo || emissao.tipo
  const isRenovacao = tipo === 'renovacao'
  const isRecusada = emissao.resultado === 'recusada'
  const isAprovada = emissao.resultado === 'aprovada'

  let borderClass, bgClass, accentGradient, shadowClass
  if (isRecusada) {
    borderClass = 'border-red-200'
    bgClass = 'bg-red-50'
    accentGradient = 'from-red-400 to-red-500'
    shadowClass = ''
  } else if (isRenovacao) {
    borderClass = 'border-status-success/20'
    bgClass = 'bg-status-success/5'
    accentGradient = 'from-status-success to-brand-secondary'
    shadowClass = ''
  } else {
    borderClass = 'border-brand-secondary/25'
    bgClass = 'bg-brand-secondary/5'
    accentGradient = coluna === 'pendentes'
      ? 'from-brand-accent to-brand-secondary'
      : 'from-brand-secondary to-brand-accent'
    shadowClass = coluna === 'pendentes' ? 'shadow-[0_8px_24px_rgba(202,138,4,0.08)]' : ''
  }

  const nome = nomeEmissao(emissao)
  const veiculo = emissao.cotacoes_auto?.modelo_veiculo || 'Modelo nao informado'
  const placa = emissao.cotacoes_auto?.placa

  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(emissao)}
      onClick={() => onClick(emissao)}
      title="Abrir detalhes da cotacao"
      className={`group relative w-full cursor-pointer overflow-hidden rounded-[28px] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 ${borderClass} ${bgClass} ${shadowClass}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentGradient} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-dark-text">{nome}</p>
          <p className="mt-1 truncate text-xs text-dark-muted">{veiculo}</p>
          <p className="mt-2 text-[11px] text-dark-muted">
            {placa ? `Placa ${placa}` : 'Sem placa'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isRecusada && (
            <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-600">Recusada</span>
          )}
          {isAprovada && (
            <span className="rounded-full bg-status-success/10 px-2 py-1 text-[10px] font-semibold text-status-success">Aprovada</span>
          )}
          {!emissao.resultado && (
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
              coluna === 'pendentes'
                ? 'bg-status-warning/10 text-status-warning'
                : 'bg-dark-surface2/75 text-dark-muted'
            }`}>
              {coluna === 'pendentes' ? 'Pendente' : 'Em andamento'}
            </span>
          )}
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            isRenovacao
              ? 'bg-status-success/10 text-status-success'
              : 'bg-brand-secondary/10 text-brand-secondary'
          }`}>
            {isRenovacao ? 'Renovacao' : 'Novo'}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── InfoRow + BoolRow (usados nos detalhes) ────────────────────────────────

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">{label}</p>
      <p className="mt-1 text-sm text-dark-text">{value}</p>
    </div>
  )
}

function BoolRow({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <div className="flex items-center justify-between py-1">
      <p className="text-sm text-dark-muted">{label}</p>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        value ? 'bg-status-success/10 text-status-success' : 'bg-dark-border/60 text-dark-muted'
      }`}>
        {value ? 'Sim' : 'Nao'}
      </span>
    </div>
  )
}

// ─── Modal Detalhe ──────────────────────────────────────────────────────────

function ModalDetalhe({ emissao, onClose, onRegistrarResultado, onEmitirApolice }) {
  const c = emissao.cotacoes_auto || {}
  const nome = nomeEmissao(emissao)
  const tipo = (c.tipo || emissao.tipo) === 'renovacao' ? 'Renovacao' : 'Novo'
  const seguradoras = Array.isArray(emissao.seguradoras_cotadas) ? emissao.seguradoras_cotadas : []
  const etapaAtual = emissao.resultado
    ? (emissao.resultado === 'aprovada' ? 'Cotacao aprovada' : 'Cotacao recusada')
    : 'Aguardando resultado'
  const colunaAtual = getEmissaoColuna(emissao)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-8 backdrop-blur-sm overflow-y-auto">
      <div className="glass-modal w-full max-w-6xl rounded-[32px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">Detalhe do cliente</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                (c.tipo || emissao.tipo) === 'renovacao'
                  ? 'bg-status-success/10 text-status-success'
                  : 'bg-brand-secondary/10 text-brand-secondary'
              }`}>{tipo}</span>
              {emissao.resultado && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  emissao.resultado === 'aprovada'
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-red-100 text-red-600'
                }`}>{emissao.resultado === 'aprovada' ? 'Aprovada' : 'Recusada'}</span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-dark-text">{nome}</h2>
            <p className="mt-1 text-sm text-dark-muted">
              {c.modelo_veiculo || 'Veiculo nao informado'}
              {c.placa ? ` · Placa ${c.placa}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-dark-border/40 transition-colors shrink-0">
            <X className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            {/* Cliente */}
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Dados do cliente</p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <InfoRow label="Nome" value={c.nome_cliente} />
                <InfoRow label="CPF" value={c.cpf_cliente} />
                <InfoRow label="Celular" value={c.celular_cliente} />
                <InfoRow label="Email" value={c.email_cliente} />
                <InfoRow label="Estado civil" value={c.estado_civil_cliente} />
                <InfoRow label="Profissao" value={c.profissao_cliente} />
              </div>
            </div>

            {/* Veiculo */}
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Veiculo</p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <InfoRow label="Modelo" value={c.modelo_veiculo} />
                <InfoRow label="Placa" value={c.placa} />
                <InfoRow label="Uso" value={c.uso_veiculo} />
                <InfoRow label="CEP pernoite" value={c.cep_pernoite} />
              </div>
            </div>

            {/* Condutor */}
            {(c.condutor_nome || c.condutor_cpf) && (
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Condutor principal</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <InfoRow label="Nome" value={c.condutor_nome} />
                  <InfoRow label="CPF" value={c.condutor_cpf} />
                  <InfoRow label="Estado civil" value={c.estado_civil_condutor} />
                </div>
              </div>
            )}

            {/* Caracteristicas */}
            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Caracteristicas e riscos</p>
              <div className="divide-y divide-dark-border/40">
                <BoolRow label="Jovens de 18 a 26 anos" value={c.jovens_18_26} />
                <BoolRow label="Veiculo financiado" value={c.veiculo_financiado} />
                <BoolRow label="Kit gas" value={c.possui_kit_gas} />
                <BoolRow label="Blindagem" value={c.possui_blindagem} />
                <BoolRow label="Isento de imposto" value={c.isento_imposto} />
                <BoolRow label="Garagem na residencia" value={c.garagem_residencia} />
                <BoolRow label="Garagem no trabalho" value={c.garagem_trabalho} />
                <BoolRow label="Garagem no estudo" value={c.garagem_estudo} />
              </div>
            </div>

            {/* Seguradoras cotadas */}
            {seguradoras.length > 0 && (
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradoras cotadas</p>
                <div className="space-y-3">
                  {seguradoras.map((seg, idx) => (
                    <div key={idx} className="rounded-2xl border border-dark-border/60 bg-white/60 p-3">
                      <p className="font-semibold text-sm text-dark-text">{seg.nome || `Seguradora ${idx + 1}`}</p>
                      <div className="mt-2 grid gap-x-4 gap-y-1 grid-cols-2 text-xs text-dark-muted">
                        {seg.valor_total > 0 && <span>Valor total: {formatMoney(seg.valor_total)}</span>}
                        {seg.premio_liquido > 0 && <span>Premio liq.: {formatMoney(seg.premio_liquido)}</span>}
                        {seg.valor_comissao > 0 && (
                          <span className="text-status-success font-medium">
                            Comissao: {formatMoney(seg.valor_comissao)} ({seg.pct_comissao}%)
                          </span>
                        )}
                        {seg.parcelamentos && <span>Parcelas: {seg.parcelamentos}</span>}
                        {seg.forma_pagamento && <span>Pagamento: {seg.forma_pagamento}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-brand-secondary/15 bg-brand-secondary/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-secondary">Resumo da cotacao</p>
              <p className="mt-2 text-lg font-semibold text-dark-text">{etapaAtual}</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Coluna atual</p>
                  <p className="mt-1 text-sm font-medium text-dark-text">{colunaAtual}</p>
                </div>
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Tipo</p>
                  <p className="mt-1 text-sm font-medium text-dark-text">{tipo}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Proximos passos</p>
              <p className="mt-2 text-sm text-dark-muted">
                Use esta area para registrar o resultado da cotacao e seguir para a emissao.
              </p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => onRegistrarResultado?.(emissao)}
                  className="w-full rounded-2xl border border-brand-secondary/20 bg-white/75 px-4 py-3 text-left transition-colors hover:border-brand-secondary/40 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-dark-text">Registrar resultado da cotacao</p>
                  <p className="mt-1 text-xs text-dark-muted">Seleciona aprovacao ou recusa e salva as seguradoras cotadas.</p>
                </button>
                <button
                  type="button"
                  onClick={() => onEmitirApolice?.(emissao)}
                  className="w-full rounded-2xl border border-status-success/20 bg-status-success/5 px-4 py-3 text-left transition-colors hover:border-status-success/40 hover:bg-status-success/10"
                >
                  <p className="text-sm font-semibold text-dark-text">Seguir para emissao</p>
                  <p className="mt-1 text-xs text-dark-muted">Abre o formulario com cliente, veiculo e campos da apolice.</p>
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Campos de pos-cotacao</p>
              <ul className="mt-3 space-y-2 text-sm text-dark-muted">
                <li>Resultado da cotacao</li>
                <li>Seguradoras cotadas</li>
                <li>Numero da apolice</li>
                <li>Vigencia</li>
                <li>Premio e comissao</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── FormSeguradora ──────────────────────────────────────────────────────────

function FormSeguradora({ seg, idx, onChange, onRemove, showRemove }) {
  const valorComissao = (parseFloat(seg.premio_liquido) || 0) * (parseFloat(seg.pct_comissao) || 0) / 100

  return (
    <div className="rounded-3xl border border-brand-secondary/20 bg-brand-secondary/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-brand-secondary">Seguradora {idx + 1}</p>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-dark-muted hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Nome da seguradora</label>
          <input
            value={seg.nome}
            onChange={e => onChange('nome', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="Porto Seguro, Bradesco, Suhai..."
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Valor total</label>
          <input
            type="number"
            step="0.01"
            value={seg.valor_total}
            onChange={e => onChange('valor_total', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Premio liquido</label>
          <input
            type="number"
            step="0.01"
            value={seg.premio_liquido}
            onChange={e => onChange('premio_liquido', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">% Comissao</label>
          <input
            type="number"
            step="0.1"
            value={seg.pct_comissao}
            onChange={e => onChange('pct_comissao', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="0"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Comissao (calculada)</label>
          <div className={`w-full rounded-2xl border px-3 py-2 text-sm font-medium ${
            valorComissao > 0
              ? 'border-status-success/30 bg-status-success/10 text-status-success'
              : 'border-dark-border/40 bg-dark-surface2/40 text-dark-muted'
          }`}>
            {valorComissao > 0 ? formatMoney(valorComissao) : '—'}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Parcelamentos</label>
          <input
            value={seg.parcelamentos}
            onChange={e => onChange('parcelamentos', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="3x, 6x, 10x sem juros"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Forma de pagamento</label>
          <input
            value={seg.forma_pagamento}
            onChange={e => onChange('forma_pagamento', e.target.value)}
            className="w-full rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-sm text-dark-text outline-none"
            placeholder="Cartao, boleto, pix..."
          />
        </div>
      </div>
    </div>
  )
}

// ─── Modal Resultado da Cotacao ──────────────────────────────────────────────

function ModalResultado({ emissao, onClose, onSave, isSaving }) {
  const [resultado, setResultado] = useState('aprovada')
  const [seguradoras, setSeguradoras] = useState([{ ...NOVA_SEGURADORA }])

  const c = emissao.cotacoes_auto || {}
  const nome = nomeEmissao(emissao)

  const canSave = resultado === 'recusada' || (
    resultado === 'aprovada' &&
    seguradoras.length > 0 &&
    seguradoras.every(s => s.nome.trim() !== '')
  )

  function updateSeg(idx, campo, valor) {
    setSeguradoras(prev => prev.map((s, i) => i === idx ? { ...s, [campo]: valor } : s))
  }

  function addSeg() {
    setSeguradoras(prev => [...prev, { ...NOVA_SEGURADORA }])
  }

  function removeSeg(idx) {
    setSeguradoras(prev => prev.filter((_, i) => i !== idx))
  }

  function handleSave() {
    const seguradasFinal = resultado === 'aprovada'
      ? seguradoras.map(s => ({
          nome: s.nome,
          valor_total: parseFloat(s.valor_total) || 0,
          premio_liquido: parseFloat(s.premio_liquido) || 0,
          pct_comissao: parseFloat(s.pct_comissao) || 0,
          valor_comissao: (parseFloat(s.premio_liquido) || 0) * (parseFloat(s.pct_comissao) || 0) / 100,
          parcelamentos: s.parcelamentos,
          forma_pagamento: s.forma_pagamento,
        }))
      : []
    onSave(emissao.id, { resultado, seguradoras_cotadas: seguradasFinal })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-8 backdrop-blur-sm overflow-y-auto">
      <div className="glass-modal w-full max-w-2xl rounded-[32px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-secondary">Resultado da cotacao</p>
            <h2 className="mt-2 text-xl font-semibold text-dark-text">{nome}</h2>
            <p className="mt-1 text-sm text-dark-muted">
              {c.modelo_veiculo || 'Veiculo nao informado'}
              {c.placa ? ` · ${c.placa}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-dark-border/40 transition-colors shrink-0">
            <X className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        {/* Toggle aprovada/recusada */}
        <div className="mb-5 flex gap-3">
          <button
            type="button"
            onClick={() => setResultado('aprovada')}
            className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition-all ${
              resultado === 'aprovada'
                ? 'border-status-success bg-status-success/10 text-status-success shadow-sm'
                : 'border-dark-border bg-white/60 text-dark-muted hover:border-status-success/40'
            }`}
          >
            Aprovada
          </button>
          <button
            type="button"
            onClick={() => setResultado('recusada')}
            className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition-all ${
              resultado === 'recusada'
                ? 'border-red-300 bg-red-50 text-red-600 shadow-sm'
                : 'border-dark-border bg-white/60 text-dark-muted hover:border-red-200'
            }`}
          >
            Recusada
          </button>
        </div>

        {resultado === 'aprovada' && (
          <div className="space-y-3">
            <p className="text-xs text-dark-muted">
              Adicione ao menos uma seguradora com o resultado da cotacao.
            </p>
            {seguradoras.map((seg, idx) => (
              <FormSeguradora
                key={idx}
                seg={seg}
                idx={idx}
                onChange={(campo, valor) => updateSeg(idx, campo, valor)}
                onRemove={() => removeSeg(idx)}
                showRemove={seguradoras.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addSeg}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-secondary/30 py-2.5 text-sm text-brand-secondary hover:border-brand-secondary/60 hover:bg-brand-secondary/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outra seguradora
            </button>
          </div>
        )}

        {resultado === 'recusada' && (
          <div className="rounded-3xl border border-red-100 bg-red-50/70 p-4 text-sm text-red-500">
            O card ficara vermelho e marcado como recusado. Esta acao pode ser revertida arrastando de volta para outra coluna.
          </div>
        )}

        <div className="mt-5 flex gap-3 border-t border-dark-border/60 pt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Apolices Emitidas ─────────────────────────────────────────────────

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
                    <td className="py-3 pr-4 font-medium text-dark-text">{item.nome_cliente || item.cpf_cliente || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.numero_apolice || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">{item.seguradora || '—'}</td>
                    <td className="py-3 pr-4 text-dark-muted">
                      {item.vigencia_inicio ? formatDateBR(item.vigencia_inicio) : '—'} — {item.vigencia_fim ? formatDateBR(item.vigencia_fim) : '—'}
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

// ─── CampoTexto (formulario de emissao) ─────────────────────────────────────

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

// ─── Pagina principal ────────────────────────────────────────────────────────

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const initialRange = useMemo(() => getPeriodoRange('semana'), [])

  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [modalResultado, setModalResultado] = useState(null)
  const [modalEmissao, setModalEmissao] = useState(null)
  const [form, setForm] = useState(FORM_EMISSAO_VAZIO)
  const [showApolices, setShowApolices] = useState(false)
  const [periodo, setPeriodo] = useState('semana')
  const [filtroInicio, setFiltroInicio] = useState(initialRange.inicio)
  const [filtroFim, setFiltroFim] = useState(initialRange.fim)

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes', periodo, filtroInicio, filtroFim],
    queryFn: () => getEmissoesAuto({ inicio: filtroInicio || undefined, fim: filtroFim || undefined }),
  })

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { mutate: salvarResultado, isPending: isSavingResultado } = useMutation({
    mutationFn: ({ id, payload }) => salvarResultadoCotacao(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      setModalResultado(null)
    },
  })

  const { mutate: emitir, isPending } = useMutation({
    mutationFn: payload => emitirApoliceAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setModalEmissao(null)
      setForm(FORM_EMISSAO_VAZIO)
    },
  })

  function setField(campo, valor) {
    setForm(current => ({ ...current, [campo]: valor }))
  }

  function handlePeriodoChange(value) {
    setPeriodo(value)
    if (value === 'custom') return
    const range = getPeriodoRange(value)
    setFiltroInicio(range.inicio)
    setFiltroFim(range.fim)
  }

  function handleDrop(colunaDestino) {
    if (!dragging) return
    if (colunaDestino === 'cotacao_feita') {
      setModalResultado(dragging)
    } else if (colunaDestino === 'emitida') {
      setModalEmissao(dragging)
    } else {
      mover({ id: dragging.id, coluna: colunaDestino === 'pendentes' ? null : colunaDestino })
    }
    setDragging(null)
    setDragOver(null)
  }

  function abrirDetalhe(item) {
    const cotacaoId = item?.cotacoes_auto?.id || item?.cotacao_id
    if (!cotacaoId) return
    navigate(`/auto/cotacoes/${cotacaoId}`, {
      state: {
        from: '/auto/emissoes',
        fromLabel: 'Gestao de Emissoes',
      },
    })
  }

  const premioLiquido = parseFloat(form.premio_liquido) || 0
  const pctComissao = parseFloat(form.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
  const valorRepasse = form.tem_repasse ? valorComissao * (parseFloat(form.pct_repasse) || 0) : 0

  function handleEmitir() {
    emitir({
      emissao_id: modalEmissao.id,
      cliente_id: modalEmissao.cliente_id,
      nome_cliente: modalEmissao.cotacoes_auto?.nome_cliente || null,
      cpf_cliente: modalEmissao.cotacoes_auto?.cpf_cliente || null,
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

  const modalEmissaoResumo = modalEmissao ? {
    cliente: modalEmissao.cotacoes_auto?.nome_cliente || modalEmissao.cotacoes_auto?.cpf_cliente || '—',
    cpf: modalEmissao.cotacoes_auto?.cpf_cliente || '—',
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
                Clique no card para ver os dados. Arraste para avancar no fluxo.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                Pendentes entram pela coluna inicial. Arraste para <strong>Cotacao feita</strong> para registrar o resultado e as seguradoras. Cards recusados ficam em vermelho.
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
          <span className="text-xs font-medium text-dark-muted">Periodo das emissoes</span>
          <div className="inline-flex flex-wrap rounded-2xl border border-dark-border/60 bg-white/70 p-1 shadow-sm">
            {PERIOD_OPTIONS.map(option => {
              const active = periodo === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePeriodoChange(option.value)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    active ? 'bg-dark-text text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {periodo === 'custom' && (
            <>
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
            </>
          )}
          {periodo !== 'custom' && filtroInicio && filtroFim && (
            <span className="text-xs text-dark-muted">
              {formatDateBR(filtroInicio)} ate {formatDateBR(filtroFim)}
            </span>
          )}
          {(filtroInicio || filtroFim || periodo !== 'semana') && (
            <button
              onClick={() => handlePeriodoChange('semana')}
              className="rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted hover:border-brand-accent/40 hover:text-dark-text"
            >
              Voltar para semana
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
                      ? 'As cotacoes criadas pelo formulario aparecem aqui primeiro.'
                      : 'Arraste um card para avancar no fluxo.'}
                    className="py-8"
                  />
                ) : (
                  cards.map(item => (
                    <CardEmissao
                      key={item.id}
                      emissao={item}
                      onDragStart={setDragging}
                      onClick={abrirDetalhe}
                    />
                  ))
                )}
              </div>
            </DataCard>
          )
        })}
      </div>

      {/* Modal: resultado da cotacao (drag para cotacao_feita) */}
      {modalResultado && (
        <ModalResultado
          emissao={modalResultado}
          onClose={() => setModalResultado(null)}
          onSave={(id, payload) => salvarResultado({ id, payload })}
          isSaving={isSavingResultado}
        />
      )}

      {/* Modal: emitir apolice (drag para emitida) */}
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
                  <p className="mt-2 text-sm leading-6 text-dark-muted">{modalEmissaoResumo?.cliente}</p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Cliente</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalEmissaoResumo?.cliente}</p>
                      <p className="mt-1 text-xs text-dark-muted">CPF {modalEmissaoResumo?.cpf}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Veiculo</p>
                      <p className="mt-2 text-sm font-semibold text-dark-text">{modalEmissaoResumo?.veiculo}</p>
                      <p className="mt-1 text-xs text-dark-muted">{modalEmissaoResumo?.placa}</p>
                    </div>
                    <div className="rounded-3xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Contexto</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="badge badge-info">{modalEmissaoResumo?.tipo}</span>
                        <span className="badge badge-muted">{modalEmissaoResumo?.coluna}</span>
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
                  </div>
                  <button
                    onClick={() => { setModalEmissao(null); setForm(FORM_EMISSAO_VAZIO) }}
                    className="rounded-full p-2 hover:bg-dark-border/40 transition-colors"
                  >
                    <X className="w-5 h-5 text-dark-muted" />
                  </button>
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
                    onClick={() => { setModalEmissao(null); setForm(FORM_EMISSAO_VAZIO) }}
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
