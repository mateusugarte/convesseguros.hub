import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApoliceDetalhe, atualizarApolice, excluirApolice, STATUS_EMISSAO_LABELS, FORMA_PAGAMENTO_LABELS } from '../lib/apolices'
import { PRODUTO_LABELS } from '../lib/fichas'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import SeguradoraSelect from '../components/SeguradoraSelect'

function fmtDt(v) {
  if (!v) return null
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}
function fmtData(v) {
  if (!v) return '—'
  try { return format(parseISO(String(v).slice(0,10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) } catch { return v }
}
function calcularMeses(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 30)))
}

// ── Campo read-only ───────────────────────────────────────────────────────────

function ReadField({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-dark-text">{String(value)}</p>
    </div>
  )
}

// ── Campo editável ────────────────────────────────────────────────────────────

function EditField({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">
        {label}{required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input text-sm"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">
        {label}{required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="select text-sm">
        <option value="">Selecione...</option>
        {options.map(o => (
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ apolice }) {
  const events = [
    { label: 'Solicitação recebida', ts: apolice.created_at, color: '#3B82F6' },
  ]
  if (apolice.data_transmissao) {
    events.push({ label: 'Apólice emitida', ts: apolice.data_transmissao, color: '#8B5CF6' })
  }
  if (apolice.status_emissao === 'enviada') {
    events.push({ label: 'Apólice enviada ao cliente', ts: null, color: '#10B981' })
  }

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: ev.color }} />
            {i < events.length - 1 && <div className="w-px flex-1 bg-dark-border mt-1.5" />}
          </div>
          <div className="pb-3 min-w-0">
            <p className="text-sm text-dark-text font-medium">{ev.label}</p>
            {ev.ts && <p className="text-[10px] text-dark-muted/60 mt-0.5 font-mono">{fmtDt(ev.ts)}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ApoliceDetalhe() {
  const { id }           = useParams()
  const navigate         = useNavigate()
  const toast            = useToast()
  const { resolverNome } = useImobiliaria()

  const [apolice,  setApolice]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [confirm,  setConfirm]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Campos editáveis
  const [numeroApolice,    setNumeroApolice]    = useState('')
  const [numeroProposta,   setNumeroProposta]   = useState('')
  const [seguradora,       setSeguradora]       = useState('')
  const [statusEmissao,    setStatusEmissao]    = useState('')
  const [proprietarioNome, setProprietarioNome] = useState('')
  const [proprietarioCel,  setProprietarioCel]  = useState('')
  const [endereco,         setEndereco]         = useState('')
  const [inicioVigencia,   setInicioVigencia]   = useState('')
  const [fimVigencia,      setFimVigencia]      = useState('')
  const [valorParcela,     setValorParcela]     = useState('')
  const [formaPagamento,   setFormaPagamento]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchApoliceDetalhe(id)
    if (data) {
      setApolice(data)
      setNumeroApolice(data.numero_apolice || '')
      setNumeroProposta(data.numero_proposta || '')
      setSeguradora(data.seguradora || '')
      setStatusEmissao(data.status_emissao || '')
      setProprietarioNome(data.proprietario_nome || '')
      setProprietarioCel(data.proprietario_cel || '')
      setEndereco(data.endereco || '')
      setInicioVigencia(data.inicio_vigencia || '')
      setFimVigencia(data.fim_vigencia || '')
      setValorParcela(data.valor_parcela !== null && data.valor_parcela !== undefined ? String(data.valor_parcela) : '')
      setFormaPagamento(data.forma_pagamento || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function salvar() {
    setSalvando(true)
    const meses = calcularMeses(inicioVigencia, fimVigencia)
    const err = await atualizarApolice(id, {
      numero_apolice:      numeroApolice.trim() || null,
      numero_proposta:     numeroProposta.trim() || null,
      seguradora:          seguradora || null,
      status_emissao:      statusEmissao,
      proprietario_nome:   proprietarioNome.trim() || null,
      proprietario_cel:    proprietarioCel.trim() || null,
      endereco:            endereco.trim() || null,
      inicio_vigencia:     inicioVigencia || null,
      fim_vigencia:        fimVigencia || null,
      tempo_vigencia_meses: meses || null,
      valor_parcela:       valorParcela ? parseFloat(valorParcela) : null,
      forma_pagamento:     formaPagamento || null,
    })
    setSalvando(false)
    if (err) { toast({ type: 'error', title: 'Erro ao salvar' }); return }
    toast({ type: 'success', title: 'Alterações salvas!' })
    load()
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await excluirApolice(id)
    if (err) { setDeleting(false); toast({ type: 'error', title: 'Erro ao excluir' }); return }
    toast({ type: 'success', title: 'Apólice excluída' })
    navigate('/apolices/lista')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-dark-muted text-sm">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Carregando apólice...
      </div>
    )
  }

  if (!apolice) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-muted">Apólice não encontrada</p>
        <button onClick={() => navigate('/apolices/lista')} className="btn-secondary mt-4">← Voltar</button>
      </div>
    )
  }

  const ficha    = apolice.fichas
  const meses    = calcularMeses(inicioVigencia, fimVigencia)
  const siStatus = STATUS_EMISSAO_LABELS[apolice.status_emissao] || { label: apolice.status_emissao, color: '#6B7280' }

  return (
    <div className="pb-24 space-y-5 animate-fade-in">

      {/* ── Breadcrumb ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/apolices/lista')}
          className="flex items-center gap-1.5 text-dark-muted hover:text-dark-text transition-colors text-sm flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-dark-text truncate">
            {ficha?.nome_empresa || ficha?.nome_interessado || apolice.nome_interessado || 'Apólice'}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: siStatus.color + '20', color: siStatus.color }}>
              {siStatus.label}
            </span>
            {apolice.imobiliaria && (
              <span className="text-xs text-dark-muted">{resolverNome(apolice.imobiliaria)}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body: 2 colunas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Coluna Esquerda ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Dados do Locatário (read-only da ficha) */}
          {ficha && (
            <div className="card p-5">
              <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
                Dados do Locatário
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <ReadField label="Nome"     value={ficha.nome_empresa || ficha.nome_interessado} />
                <ReadField label="CPF/CNPJ" value={ficha.cpf || ficha.cnpj} />
                <ReadField label="Celular"  value={ficha.celular} />
                <ReadField label="Produto"  value={PRODUTO_LABELS[ficha.produto] || ficha.produto} />
                <ReadField label="Imobiliária" value={resolverNome(apolice.imobiliaria)} />
              </div>
            </div>
          )}

          {/* Dados do Proprietário */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Dados do Proprietário
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <EditField label="Nome"    value={proprietarioNome} onChange={setProprietarioNome} placeholder="Nome do proprietário" />
              <EditField label="Celular" value={proprietarioCel}  onChange={setProprietarioCel}  placeholder="(11) 99999-9999" />
            </div>
          </div>

          {/* Dados do Imóvel */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Dados do Imóvel
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2">
                <EditField label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua, número, bairro, cidade" />
              </div>
              <ReadField label="Valor do Aluguel" value={apolice.valor_aluguel} />
            </div>
          </div>
        </div>

        {/* ── Coluna Direita ── */}
        <div className="space-y-4">

          {/* Dados da Apólice */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Dados da Apólice
            </p>
            <div className="space-y-4">
              <EditField label="Número da Apólice" value={numeroApolice} onChange={setNumeroApolice} placeholder="000000000" required />
              <EditField label="Número da Proposta" value={numeroProposta} onChange={setNumeroProposta} placeholder="Opcional" />
              <div>
                <label className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                  Seguradora<span className="text-status-danger ml-0.5">*</span>
                </label>
                <SeguradoraSelect value={seguradora} onChange={setSeguradora} required />
              </div>
              <SelectField
                label="Status"
                value={statusEmissao}
                onChange={setStatusEmissao}
                options={Object.entries(STATUS_EMISSAO_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
          </div>

          {/* Vigência e Pagamento */}
          <div className="card p-5">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4 pb-2 border-b border-dark-border">
              Vigência e Pagamento
            </p>
            <div className="space-y-4">
              <EditField label="Início da Vigência" type="date" value={inicioVigencia} onChange={setInicioVigencia} required />
              <EditField label="Fim da Vigência"    type="date" value={fimVigencia}    onChange={setFimVigencia}    required />
              <div>
                <p className="text-[10px] font-semibold text-dark-muted uppercase tracking-wider mb-1">Tempo de Vigência</p>
                <p className="text-sm text-dark-text">{meses > 0 ? `${meses} meses` : '—'}</p>
              </div>
              <EditField label="Valor da Parcela (R$)" type="number" value={valorParcela} onChange={setValorParcela} placeholder="0,00" required />
              <SelectField
                label="Forma de Pagamento"
                value={formaPagamento}
                onChange={setFormaPagamento}
                options={Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                required
              />
            </div>
          </div>

          {/* Histórico */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Histórico</p>
            <Timeline apolice={apolice} />
          </div>
        </div>
      </div>

      {/* ── Footer Sticky ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-6 py-4 bg-dark-surface/95 backdrop-blur-xl border-t border-dark-border"
           style={{ left: 'var(--sidebar-w, 0)' }}>
        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/apolices/lista')}
                className="btn-secondary flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
                    className="btn-danger flex items-center gap-1.5 text-sm">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-status-danger font-medium">Confirmar?</span>
              <button onClick={handleDelete} disabled={deleting}
                      className="px-3 py-1.5 rounded-lg bg-status-danger text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
                {deleting ? '...' : 'Sim, excluir'}
              </button>
              <button onClick={() => setConfirm(false)}
                      className="px-3 py-1.5 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text">
                Não
              </button>
            </div>
          )}
          <button onClick={salvar} disabled={salvando}
                  className="btn-primary flex items-center gap-1.5 text-sm">
            <Save className="w-4 h-4" /> {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}
