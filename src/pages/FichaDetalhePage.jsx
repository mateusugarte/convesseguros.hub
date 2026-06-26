import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { fetchFichaDetalhe, editarFicha, deletarFicha, salvarRetornoGeradoFicha, limparRetornoGeradoFicha, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useToast } from '../contexts/ToastContext'
import { toNumber, formatMoneyBR } from '../lib/apolices'
import { formatDecimalBRInput } from '../lib/numberInput'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Pencil, Trash2, Check, CheckCircle2, CircleDot, X, CalendarDays, Building2, UserRound, Clock3, Copy, FileText, Link as LinkIcon, Loader2 } from 'lucide-react'
import { PageHeader, MetricCard, DataCard } from '../components/ui'
import { Avatar } from '../components/ui'
import ImobiliariaIdentity from '../components/ImobiliariaIdentity'
import SeguradoraBadge from '../components/SeguradoraBadge'
import SeguradoraSelect from '../components/SeguradoraSelect'
import ModalFicha from '../components/ModalFicha'
import ModalAssumir from '../components/ModalAssumir'
import ModalFinalizar from '../components/ModalFinalizar'
import SecaoDocumentos from '../components/SecaoDocumentos'
import FichaStatusBadge from '../components/FichaStatusBadge'
import { Select } from '../components/ui/Select'
import { normalizeDisplayText } from '../lib/text'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDt(v) {
  if (!v) return null
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}
function fmtBRL(v) {
  return formatMoneyBR(v)
}

function resolveFichaValor(ficha, field) {
  return ficha?.[field] ?? ficha?.raw_data?.[field] ?? null
}

// ── InlineField — campo editável com click ────────────────────────────────────

function InlineField({ label, value, onSave, type = 'text', rows, formatter, inputMode }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value || '')
  const [saving,  setSaving]  = useState(false)

  function formatDraft(val) {
    return formatter ? formatter(val) : (val || '')
  }

  function cancel() { setEditing(false); setDraft(formatDraft(value)) }

  async function save() {
    if (draft === (value || '')) { setEditing(false); return }
    setSaving(true)
    await onSave(draft || null)
    setSaving(false)
    setEditing(false)
  }

  function handleKey(e) {
    if (!rows && e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  const inputClass = 'text-sm bg-dark-surface2 border border-brand-accent/60 rounded-lg px-3 py-1.5 text-dark-text outline-none focus:border-brand-accent w-full transition-colors'

  return (
    <div>
      <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      {editing ? (
        <div className="flex items-start gap-1.5">
          {rows ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              rows={rows}
              autoFocus
              className={`${inputClass} resize-none`}
            />
          ) : (
            <input
              type={type}
              inputMode={inputMode}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              className={inputClass}
            />
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex-shrink-0 p-1.5 rounded-lg bg-status-success/20 text-status-success hover:bg-status-success/30 transition-colors mt-0.5"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={cancel}
            className="flex-shrink-0 p-1.5 rounded-lg bg-dark-surface2 text-dark-muted hover:text-dark-text transition-colors mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p
          onClick={() => { setDraft(formatDraft(value)); setEditing(true) }}
          className="text-sm text-dark-text cursor-pointer group flex items-center gap-1.5 hover:text-brand-accent transition-colors"
        >
          <span>{formatter ? (formatter(value) || <span className="text-dark-muted/40 italic">—</span>) : (value || <span className="text-dark-muted/40 italic">—</span>)}</span>
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
        </p>
      )}
    </div>
  )
}

// ── ReadField — campo read-only ───────────────────────────────────────────────

function ReadField({ label, value }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div>
      <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-dark-text">{String(value)}</p>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ ficha }) {
  const events = []

  events.push({
    label: 'Ficha recebida',
    sub: ficha.imobiliaria ? `via ${ficha.imobiliaria}` : null,
    ts: ficha.created_at,
    color: '#3B82F6',
  })

  if (ficha.assumida_em) {
    events.push({
      label: `Assumida por ${ficha.profiles?.nome || 'desconhecido'}`,
      sub: 'Status → Em Cotação',
      ts: ficha.assumida_em,
      color: '#F59E0B',
    })
  }

  if (ficha.finalizada_em) {
    const si = STATUS_LABELS[ficha.status]
    events.push({
      label: `Finalizada — ${si?.label || ficha.status}`,
      sub: ficha.seguradora ? `Seguradora: ${ficha.seguradora}` : null,
      ts: ficha.finalizada_em,
      color: ficha.status === 'aprovado' ? '#059669' : ficha.status === 'recusado' ? '#EF4444' : '#4A90D9',
    })
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
            {ev.sub && <p className="text-xs text-dark-muted mt-0.5">{ev.sub}</p>}
            {ev.ts && (
              <p className="text-[10px] text-dark-muted/60 mt-0.5 font-mono">{fmtDt(ev.ts)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ProdutoBadge ──────────────────────────────────────────────────────────────

const PROD_COLORS = {
  residencial_pf:  { bg: 'rgba(74,144,217,0.15)',  text: '#4A90D9',  border: 'rgba(74,144,217,0.3)' },
  comercial_pf:    { bg: 'rgba(5,150,105,0.15)',   text: '#059669',  border: 'rgba(5,150,105,0.3)' },
  pessoa_juridica: { bg: 'rgba(139,92,246,0.15)',  text: '#8B5CF6',  border: 'rgba(139,92,246,0.3)' },
}

const COTACAO_STATUS_OPTIONS = [
  { value: '', label: 'Sem status' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'sem_cadastro', label: 'Sem cadastro' },
]

const COTACAO_SEGURADORAS_BASE = [
  'Porto Seguro',
  'Tokio Marine',
  'TOO Seguros',
  'Pottencial',
]

const COTACAO_SEGURADORAS_PJ = [
  'Junto Seguros',
]

const CAMPOS_REPLICAVEIS = new Set(['parcelamento'])

function getSeguradorasCotacao(produto) {
  return produto === 'pessoa_juridica'
    ? [...COTACAO_SEGURADORAS_BASE, ...COTACAO_SEGURADORAS_PJ]
    : COTACAO_SEGURADORAS_BASE
}

function formatMoney(v) {
  const n = toNumber(v)
  if (n === null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function formatParcelas(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number.parseInt(String(v), 10)
  if (!Number.isFinite(n)) return null
  return `${n}x`
}

function normalizeProductLabel(produto) {
  return produto === 'residencial_pf' ? 'RESIDENCIAL' : 'COMERCIAL'
}

function getNomeLocatario(ficha) {
  const nome = ficha?.produto === 'pessoa_juridica'
    ? (ficha?.nome_empresa || ficha?.nome_interessado || '')
    : (ficha?.nome_interessado || ficha?.nome_empresa || '')
  return normalizeDisplayText(nome).toUpperCase()
}

function buildCotacaoMessageData(ficha, cotacoes = [], biometriaUrl = '') {
  const nomeLocatario = getNomeLocatario(ficha)
  const tipoAprovacao = normalizeProductLabel(ficha?.produto)
  const seguradoras = getSeguradorasCotacao(ficha?.produto)
  const aprovadas = cotacoes.filter(c => c.status === 'aprovado')
  const recusadas = cotacoes.filter(c => c.status === 'recusado')

  const linhas = seguradoras.map(seguradora => {
    const cotacao = cotacoes.find(c => c.seguradora === seguradora) || { seguradora, status: '' }
    const nomeSeguradora = normalizeDisplayText(cotacao.seguradora || seguradora).toUpperCase()

    if (cotacao.status === 'sem_cadastro') {
      return null
    }

    if (cotacao.status === 'recusado') {
      return `_*${nomeSeguradora}*_ -- RECUSADO`
    }

    if (cotacao.status === 'aprovado') {
      const parcelas = formatParcelas(cotacao.parcelamento)
      const valor = formatMoney(cotacao.valor_parcela)
      const extras = [parcelas, valor].filter(Boolean).join(' ')
      return `_*${nomeSeguradora}*_ -- APROVADO${extras ? ` ${extras}` : ''}`
    }

    return `_*${nomeSeguradora}*_ -- PENDENTE`
  })

  const allRecusadas = recusadas.length > 0
    && recusadas.length === seguradoras.filter(seg => (cotacoes.find(c => c.seguradora === seg)?.status === 'recusado')).length
    && aprovadas.length === 0

  const escolhida = aprovadas
    .map(cotacao => ({
      ...cotacao,
      total: (toNumber(cotacao.valor_parcela) || 0) * (toNumber(cotacao.parcelamento) || 0),
      valor: toNumber(cotacao.valor_parcela) || 0,
    }))
    .sort((a, b) => {
      const totalA = Number.isFinite(a.total) && a.total > 0 ? a.total : Number.POSITIVE_INFINITY
      const totalB = Number.isFinite(b.total) && b.total > 0 ? b.total : Number.POSITIVE_INFINITY
      if (totalA !== totalB) return totalA - totalB
      return a.valor - b.valor
    })[0] || null

  const seguradoraEscolhida = escolhida?.seguradora || aprovadas[0]?.seguradora || ''
  const celular = normalizeDisplayText(String(ficha?.celular || '').trim())
  const linkBiometria = biometriaUrl.trim()

  if (allRecusadas) {
    return {
      title: `_*RECUSADO -- ${tipoAprovacao}*_`,
      body: [
        `_*${nomeLocatario}*_`,
        '',
        ...linhas.filter(line => line && !line.endsWith('PENDENTE')),
      ].join('\n'),
      status: 'recusado',
      seguradoraEscolhida: '',
    }
  }

  if (aprovadas.length > 0) {
    const seguradoraTexto = seguradoraEscolhida ? `*${normalizeDisplayText(seguradoraEscolhida).toUpperCase()}*` : '*SEGURADORA*'

    return {
      title: `_*PRÉ - APROVADO -- ${tipoAprovacao}*_`,
      body: [
        `_*${nomeLocatario}*_`,
        '',
        ...linhas.filter(Boolean),
        '',
        '_Aguardamos a realização da biometria facial para obtenção da aprovação._',
        '----------------------------------',
        ` Segue acima o PDF do orçamento pela ${seguradoraTexto}, que é por onde ficou mais em conta:`,
        '',
        '⚠️ *Solicitamos que confira os dados do anexo antes de enviar ao cliente. Caso identifique qualquer divergência, nos informe imediatamente para realizarmos o ajuste.*',
        '',
        ` Segue link de biometria ${seguradoraTexto} de _*${nomeLocatario}*_ enviado para o SMS do nº *${celular || '—'}*:`,
        linkBiometria || 'Cole o link de biometria aqui',
      ].join('\n'),
      status: 'aprovado',
      seguradoraEscolhida,
    }
  }

  return {
    title: `_*RETORNO PENDENTE -- ${tipoAprovacao}*_`,
    body: [
      `_*${nomeLocatario}*_`,
      '',
      ...linhas.filter(line => line && !line.endsWith('PENDENTE')),
    ].join('\n'),
    status: 'pendente',
    seguradoraEscolhida: '',
  }
}

function normalizarCotacoes(cotacoes = [], produto) {
  return getSeguradorasCotacao(produto).map(seguradora => {
    const atual = Array.isArray(cotacoes)
      ? cotacoes.find(c => c?.seguradora === seguradora) || {}
      : {}

    return {
      seguradora,
      status: atual.status || '',
      valor_parcela: atual.valor_parcela ?? '',
      pct_desconto: atual.pct_desconto ?? '',
      parcelamento: atual.parcelamento ?? '',
      pct_comissao: atual.pct_comissao ?? '',
    }
  })
}

function aplicarEmTodas(cotacoes, field, value) {
  if (!CAMPOS_REPLICAVEIS.has(field)) return cotacoes
  return cotacoes.map(item => ({ ...item, [field]: value }))
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FichaDetalhePage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()
  const { resolverNome, resolverImobiliariaInfo } = useImobiliaria()
  const toast     = useToast()

  const [ficha,    setFicha]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [editar,   setEditar]   = useState(false)
  const [assumir,  setAssumir]  = useState(false)
  const [finalizar,setFinalizar]= useState(false)
  const [confirm,  setConfirm]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [biometriaUrl, setBiometriaUrl] = useState('')
  const [mensagemGerada, setMensagemGerada] = useState('')
  const [copiandoMensagem, setCopiandoMensagem] = useState(false)
  const backTo = location.state?.backTo || location.state?.from || '/fichas'
  const backState = location.state?.backState || (location.state?.restoreKanban ? location.state : null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchFichaDetalhe(id)
    setFicha(data)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const cotacoesNormalizadas = useMemo(
    () => normalizarCotacoes(ficha?.raw_data?.cotacoes, ficha?.produto),
    [ficha?.raw_data?.cotacoes, ficha?.produto]
  )
  const retornoSalvo = ficha?.raw_data?.retorno_gerado || null
  const mensagemExibida = mensagemGerada || retornoSalvo?.texto || ''
  const cotacoesSnapshotSalvas = Array.isArray(retornoSalvo?.cotacoes_snapshot) ? retornoSalvo.cotacoes_snapshot : []
  const seguradoraEscolhida = ficha?.seguradora || retornoSalvo?.seguradora_escolhida || ''

  useEffect(() => {
    if (!retornoSalvo) return
    if (!mensagemGerada && retornoSalvo.texto) setMensagemGerada(retornoSalvo.texto)
    if (!biometriaUrl && retornoSalvo.biometria_url) setBiometriaUrl(retornoSalvo.biometria_url)
  }, [retornoSalvo, mensagemGerada, biometriaUrl])

  async function updateField(field, value) {
    const prev = ficha
    const patch = { [field]: value }

    if (CAMPOS_REPLICAVEIS.has(field)) {
      const raw = ficha?.raw_data || {}
      const cotacoes = normalizarCotacoes(raw.cotacoes, ficha?.produto)
      patch.raw_data = {
        ...raw,
        cotacoes: aplicarEmTodas(cotacoes, field, value),
      }
    }

    // Optimistic update
    setFicha(f => ({ ...f, ...patch }))
    const err = await editarFicha(id, patch, user?.id)
    if (err) {
      setFicha(prev)
      toast({ type: 'error', title: 'Erro ao salvar campo' })
    } else {
      toast({ type: 'success', title: 'Campo atualizado' })
    }
    return err
  }

  async function updateCotacao(seguradora, field, value) {
    const raw = ficha?.raw_data || {}
    const cotacoes = normalizarCotacoes(raw.cotacoes, ficha?.produto)
    const nextCotacoes = cotacoes.map(c => (c.seguradora === seguradora ? { ...c, [field]: value } : c))
    await updateField('raw_data', { ...raw, cotacoes: nextCotacoes })
  }

  async function selecionarSeguradora(cotacao) {
    const nome = cotacao?.seguradora || ''
    if (!nome) return

    const payload = {
      seguradora: nome,
      raw_data: {
        ...(ficha?.raw_data || {}),
        seguradora_escolhida: nome,
      },
    }

    const prev = ficha
    setFicha(current => current ? {
      ...current,
      seguradora: nome,
      raw_data: {
        ...(current.raw_data || {}),
        seguradora_escolhida: nome,
      },
    } : current)

    const err = await editarFicha(id, payload, user?.id)
    if (err) {
      setFicha(prev)
      toast({ type: 'error', title: 'Erro ao salvar seguradora escolhida' })
      return
    }

    toast({ type: 'success', title: 'Seguradora escolhida salva' })
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await deletarFicha(id)
    if (err) {
      setDeleting(false)
      toast({ type: 'error', title: 'Erro ao excluir ficha' })
    } else {
      toast({ type: 'success', title: 'Ficha excluída' })
      navigate(backTo, { replace: true, state: backState || undefined })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-dark-muted text-sm">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Carregando ficha...
      </div>
    )
  }

  if (!ficha) {
    return (
      <div className="text-center py-20">
        <p className="text-dark-muted">Ficha não encontrada</p>
        <button onClick={() => navigate(backTo, { replace: true, state: backState || undefined })} className="btn-secondary mt-4">← Voltar</button>
      </div>
    )
  }

  const si        = STATUS_LABELS[ficha.status] ?? { label: ficha.status, color: '' }
  const prodColor = PROD_COLORS[ficha.produto] || PROD_COLORS.residencial_pf
  const isPJ      = ficha.produto === 'pessoa_juridica'
  const isComPlus = ficha.produto === 'comercial_pf' || isPJ
  const isMe      = ficha.orcamentista_id === user?.id
  const canAssumir  = !ficha.assumida && ficha.status === 'pendente'
  const canFinalizar = isMe && ficha.status === 'em_cotacao'
  const nomePrincipal = isPJ ? (ficha.nome_empresa || ficha.nome_interessado || 'Sem nome') : (ficha.nome_interessado || 'Sem nome')
  const cotacoesAprovadas = cotacoesNormalizadas.filter(c => c.status === 'aprovado').length
  const cotacoesRecusadas = cotacoesNormalizadas.filter(c => c.status === 'recusado').length
  const cotacoesPendentes = cotacoesNormalizadas.filter(c => !c.status).length
  const resumoCotacoesSalvas = cotacoesSnapshotSalvas.length ? cotacoesSnapshotSalvas : cotacoesNormalizadas

  async function handleGerarMensagemRetorno() {
    const data = buildCotacaoMessageData(ficha, cotacoesNormalizadas, biometriaUrl)
    const texto = `${data.title}\n\n${data.body}`.trim()

    if (retornoSalvo?.texto || mensagemGerada) {
      const clearErr = await limparRetornoGeradoFicha(id, user?.id)
      if (clearErr) {
        toast({ type: 'error', title: 'Erro ao limpar a mensagem anterior' })
        return
      }
      setMensagemGerada('')
      setFicha(prev => prev ? {
        ...prev,
        raw_data: {
          ...(prev.raw_data || {}),
          retorno_gerado: null,
        },
      } : prev)
    }

    const err = await salvarRetornoGeradoFicha(id, {
      texto,
      biometria_url: biometriaUrl,
      gerado_em: new Date().toISOString(),
      seguradora_escolhida: data.seguradoraEscolhida,
      status: data.status,
      cotacoes_snapshot: cotacoesNormalizadas,
    }, user?.id)
    if (err) {
      toast({ type: 'error', title: 'Erro ao salvar retorno' })
      return
    }
    setFicha(prev => prev ? {
      ...prev,
      seguradora: data.seguradoraEscolhida || prev.seguradora || '',
      raw_data: {
        ...(prev.raw_data || {}),
        retorno_gerado: {
          texto,
          biometria_url: biometriaUrl,
          gerado_em: new Date().toISOString(),
          seguradora_escolhida: data.seguradoraEscolhida,
          status: data.status,
          cotacoes_snapshot: cotacoesNormalizadas,
        },
      },
    } : prev)
    if (data.seguradoraEscolhida && ficha?.seguradora !== data.seguradoraEscolhida) {
      await editarFicha(id, { seguradora: data.seguradoraEscolhida }, user?.id)
    }
    setMensagemGerada(texto)
    toast({ type: 'success', title: 'Mensagem gerada e salva' })
  }

  async function handleCopiarMensagemRetorno() {
    try {
      setCopiandoMensagem(true)
      await navigator.clipboard.writeText(mensagemExibida || '')
      toast({ type: 'success', title: 'Mensagem copiada' })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao copiar mensagem', message: error?.message })
    } finally {
      setCopiandoMensagem(false)
    }
  }

  if (editar) return (
    <ModalFicha ficha={ficha} onClose={() => setEditar(false)} onSuccess={() => { setEditar(false); load() }} />
  )
  if (assumir) return (
    <ModalAssumir id={ficha.id} onClose={() => setAssumir(false)} onSuccess={() => { setAssumir(false); load() }} />
  )
  if (finalizar) return (
    <ModalFinalizar ficha={ficha} onClose={() => setFinalizar(false)} onSuccess={() => { setFinalizar(false); load() }} />
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Ficha individual"
        title={nomePrincipal}
        description={`Detalhe completo de ${ficha.imobiliaria || 'imobiliária não informada'}. Mantenha a edição, a finalização e os documentos no mesmo fluxo.`}
        actions={(
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => {
                navigate(backTo, { replace: true, state: backState || undefined })
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </button>
            {canAssumir && (
              <button onClick={() => setAssumir(true)} className="btn-primary text-sm">
                Assumir
              </button>
            )}
            {canFinalizar && (
              <button
                onClick={() => setFinalizar(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors text-sm font-medium"
              >
                <Check className="w-4 h-4" /> Finalizar
              </button>
            )}
            <button
              onClick={() => setEditar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-status-danger/30 text-xs text-status-danger hover:bg-status-danger/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-status-danger font-medium">Confirmar?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1.5 rounded-2xl bg-status-danger text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {deleting ? '...' : 'Sim'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="px-2.5 py-1.5 rounded-2xl border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        )}
        stats={(
          <>
            <MetricCard
              label="Status"
              value={si.label}
              hint="estado atual da ficha"
              tone="accent"
              icon={<CalendarDays className="w-4 h-4" />}
            />
            <MetricCard
              label="Produto"
              value={PRODUTO_LABELS[ficha.produto] ?? ficha.produto}
              hint="linha de negócio"
              tone="secondary"
              icon={<Building2 className="w-4 h-4" />}
            />
            <MetricCard
              label="Responsável"
              value={ficha.profiles?.nome || 'Livre'}
              hint={ficha.assumida_em ? 'já assumida' : 'aguardando ação'}
              tone={isMe ? 'success' : 'warning'}
              icon={<UserRound className="w-4 h-4" />}
            />
            <MetricCard
              label="Recebida em"
              value={fmtDt(ficha.created_at) || '—'}
              hint="entrada original"
              tone="secondary"
              icon={<Clock3 className="w-4 h-4" />}
            />
          </>
        )}
      />

      {/* ── Body: 2 colunas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Coluna Esquerda: Dados ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Identificação */}
          <DataCard title={isPJ ? 'Empresa' : 'Interessado'} bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
            {isPJ ? (
              <>
                <ReadField label="Nome da Empresa" value={ficha.nome_empresa} />
                <ReadField label="CNPJ" value={ficha.cnpj} />
                <div className="col-span-2">
                  <ReadField label="CPF dos Sócios" value={ficha.cpf_socios} />
                </div>
              </>
            ) : (
              <>
                <ReadField label="Nome" value={ficha.nome_interessado} />
                <ReadField label="CPF" value={ficha.cpf} />
              </>
            )}
            <ReadField label="Celular" value={ficha.celular} />
            <ReadField label="E-mail" value={ficha.email} />
          </DataCard>

          {/* Imóvel */}
          <DataCard title="Dados do Imóvel" bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="col-span-2">
              <ImobiliariaIdentity
                nome={resolverNome(ficha.imobiliaria) || ficha.imobiliaria}
                imagemUrl={resolverImobiliariaInfo(ficha.imobiliaria)?.imagem_url}
                imagemPath={resolverImobiliariaInfo(ficha.imobiliaria)?.imagem_path}
                size="lg"
                emphasis
              />
            </div>
            <ReadField label="Imobiliária" value={resolverNome(ficha.imobiliaria) || ficha.imobiliaria} />
            <ReadField label="Tipo" value={ficha.tipo_imovel} />
            <ReadField label="CEP" value={ficha.cep} />
            <ReadField label="Aluguel" value={fmtBRL(resolveFichaValor(ficha, 'valor_aluguel'))} />
            <ReadField label="IPTU" value={fmtBRL(resolveFichaValor(ficha, 'valor_iptu'))} />
            <ReadField label="Condomínio" value={fmtBRL(resolveFichaValor(ficha, 'valor_condominio'))} />
            <div className="col-span-2">
              <InlineField
                label="Observações"
                value={ficha.observacoes}
                onSave={v => updateField('observacoes', v)}
                rows={3}
              />
            </div>
          </DataCard>

          {/* Campos extras — Comercial PF e PJ */}
          {isComPlus && (
            <DataCard title="Dados Complementares" bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
              <ReadField label="Atividade" value={ficha.atividade} />
              <ReadField label="Total de Rendimentos" value={fmtBRL(resolveFichaValor(ficha, 'total_rendimentos'))} />
              <ReadField label="Capital Social" value={fmtBRL(resolveFichaValor(ficha, 'capital_social'))} />
              <ReadField label="Motivo da Locação" value={ficha.motivo_locacao} />
              <ReadField label="Vigência" value={ficha.vigencia} />
              {isPJ && <ReadField label="Opção Tributária" value={ficha.opcao_tributaria} />}
            </DataCard>
          )}

          {/* Controle interno — campos editáveis */}
          <DataCard title="Controle Interno" bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
            <ReadField label="Orçamentista (Forms)" value={ficha.orcamentista_forms} />
            <InlineField
              label="% Comissão padrão"
              value={ficha.pct_comissao != null ? String(ficha.pct_comissao) : ''}
              type="text"
              inputMode="decimal"
              formatter={formatDecimalBRInput}
              onSave={v => updateField('pct_comissao', v ? toNumber(v) : null)}
            />
            <InlineField
              label="% Desconto"
              value={ficha.pct_desconto != null ? String(ficha.pct_desconto) : ''}
              type="text"
              inputMode="decimal"
              formatter={formatDecimalBRInput}
              onSave={v => updateField('pct_desconto', v ? toNumber(v) : null)}
            />
            <InlineField
              label="Parcelamento"
              value={ficha.parcelamento != null ? String(ficha.parcelamento) : ''}
              type="number"
              onSave={v => updateField('parcelamento', v ? parseInt(v, 10) : null)}
            />
            <InlineField
              label="Número do Orçamento"
              value={ficha.numero_orcamento != null ? String(ficha.numero_orcamento) : ''}
              onSave={v => updateField('numero_orcamento', v)}
            />
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-dark-muted">Assumida por</p>
              {ficha.profiles?.nome ? (
                <div className="flex items-center gap-2">
                  <Avatar name={ficha.profiles.nome} src={ficha.profiles.avatar_url || ''} size="sm" />
                  <span className="text-sm text-dark-text">{ficha.profiles.nome}</span>
                </div>
              ) : (
                <p className="text-sm text-dark-text">Livre</p>
              )}
            </div>
            <ReadField label="Assumida em" value={fmtDt(ficha.assumida_em)} />
            <div className="col-span-2">
              <p className="text-[10px] font-medium text-dark-muted uppercase tracking-wider mb-2">Retorno enviado</p>
              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div
                  onClick={() => updateField('retorno_enviado', !ficha.retorno_enviado)}
                  className={`w-9 h-5 rounded-full transition-colors ${ficha.retorno_enviado ? 'bg-status-success' : 'bg-dark-border'}`}
                >
                  <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.75 transition-transform ${ficha.retorno_enviado ? 'translate-x-4' : 'translate-x-0.5'} m-[3px]`} />
                </div>
                <span className="text-sm text-dark-text">{ficha.retorno_enviado ? 'Sim' : 'Não'}</span>
              </label>
            </div>
            <ReadField
              label="Passado pela imobiliária"
              value={Object.prototype.hasOwnProperty.call(ficha.raw_data || {}, 'passado_pela_imobiliaria')
                ? (ficha.raw_data?.passado_pela_imobiliaria ? 'Sim' : 'Não')
                : null}
            />
          </DataCard>

          <DataCard title="Cotação e retorno" bodyClassName="space-y-5">
            <div className="rounded-[28px] border border-brand-accent/20 bg-brand-accent/5 p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Resumo do preenchimento</p>
                  <p className="mt-1 text-sm text-dark-muted">
                    Ajuste a comissão por seguradora abaixo. O valor da ficha pode servir como padrão, mas cada card pode ser editado individualmente.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-dark-border bg-dark-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
                  Automação manual
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-dark-border/70 bg-white/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Comissão padrão da ficha</p>
                  <p className="mt-1 text-lg font-semibold text-dark-text">
                    {ficha.pct_comissao != null && ficha.pct_comissao !== ''
                      ? `${formatDecimalBRInput(ficha.pct_comissao)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-dark-border/70 bg-white/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Parcelamento base</p>
                  <p className="mt-1 text-lg font-semibold text-dark-text">{ficha.parcelamento != null && ficha.parcelamento !== '' ? `${ficha.parcelamento}x` : '—'}</p>
                </div>
                <div className="rounded-2xl border border-dark-border/70 bg-white/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">Seguradoras exibidas</p>
                  <p className="mt-1 text-lg font-semibold text-dark-text">{cotacoesNormalizadas.length}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge badge-success">Aprovadas: {cotacoesAprovadas}</span>
                <span className="badge badge-danger">Recusadas: {cotacoesRecusadas}</span>
                <span className="badge badge-warning">Pendentes: {cotacoesPendentes}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cotacoesNormalizadas.map(cotacao => {
                const statusTone = cotacao.status === 'aprovado'
                  ? 'border-status-success/30 text-status-success bg-status-success/10'
                  : cotacao.status === 'recusado'
                    ? 'border-status-danger/30 text-status-danger bg-status-danger/10'
                    : 'border-dark-border text-dark-muted bg-dark-surface'
                const isEscolhida = seguradoraEscolhida && cotacao.seguradora === seguradoraEscolhida

                return (
                  <div
                    key={cotacao.seguradora}
                    className={`rounded-[28px] border p-4 shadow-[0_18px_38px_rgba(15,23,42,0.08)] backdrop-blur-sm space-y-4 transition-all ${isEscolhida ? 'border-brand-accent/55 bg-brand-accent/7 ring-2 ring-brand-accent/12 shadow-[0_22px_46px_rgba(245,88,42,0.14)]' : 'border-dark-border bg-white/90'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <SeguradoraBadge nome={cotacao.seguradora} size="xl" showName={false} />
                      <div className="flex flex-col items-end gap-1">
                        {isEscolhida && (
                          <span className="text-[9px] uppercase tracking-[0.18em] rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2.5 py-1 text-brand-accent font-semibold">
                            Escolhida
                          </span>
                        )}
                        <div className={`text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border whitespace-nowrap ${statusTone}`}>
                          {cotacao.status || 'Sem status'}
                        </div>
                        <button
                          type="button"
                          onClick={() => selecionarSeguradora(cotacao)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${isEscolhida ? 'bg-brand-accent text-white shadow-sm' : 'border border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-brand-accent'}`}
                        >
                          {isEscolhida ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CircleDot className="w-3.5 h-3.5" />}
                          {isEscolhida ? 'Selecionada' : 'Selecionar'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-dark-muted mb-1">Status</p>
                        <Select
                          value={cotacao.status}
                          onChange={value => updateCotacao(cotacao.seguradora, 'status', value)}
                          options={COTACAO_STATUS_OPTIONS}
                          placeholder="Sem status"
                          label="Status"
                        />
                      </div>
                      <InlineField
                        label="Valor da Parcela"
                        value={cotacao.valor_parcela !== '' && cotacao.valor_parcela != null ? String(cotacao.valor_parcela) : ''}
                        type="text"
                        inputMode="decimal"
                        formatter={formatDecimalBRInput}
                        onSave={v => updateCotacao(cotacao.seguradora, 'valor_parcela', v ? toNumber(v) : null)}
                      />
                      <InlineField
                        label="% Desconto"
                        value={cotacao.pct_desconto !== '' && cotacao.pct_desconto != null ? String(cotacao.pct_desconto) : ''}
                        type="text"
                        inputMode="decimal"
                        formatter={formatDecimalBRInput}
                        onSave={v => updateCotacao(cotacao.seguradora, 'pct_desconto', v ? toNumber(v) : null)}
                      />
                      <InlineField
                        label="Qtd. Parcelas"
                        value={cotacao.parcelamento !== '' && cotacao.parcelamento != null ? String(cotacao.parcelamento) : ''}
                        type="number"
                        onSave={v => updateCotacao(cotacao.seguradora, 'parcelamento', v ? parseInt(v, 10) : null)}
                      />
                      <div className="sm:col-span-2">
                        <InlineField
                          label="Comissão da seguradora"
                          value={cotacao.pct_comissao !== '' && cotacao.pct_comissao != null ? String(cotacao.pct_comissao) : ''}
                          type="text"
                          inputMode="decimal"
                          formatter={formatDecimalBRInput}
                          onSave={v => updateCotacao(cotacao.seguradora, 'pct_comissao', v ? toNumber(v) : null)}
                        />
                        <p className="mt-1 text-[11px] text-dark-muted">
                          {cotacao.pct_comissao !== '' && cotacao.pct_comissao != null
                            ? 'Valor salvo individualmente para esta seguradora.'
                            : ficha.pct_comissao != null && ficha.pct_comissao !== ''
                              ? `Usa o padrão da ficha: ${ficha.pct_comissao}%`
                              : 'Preencha para registrar a comissão desta seguradora.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </DataCard>
        </div>

        {/* ── Coluna Direita: Timeline + Meta ── */}
        <div className="space-y-4">

          {/* Meta info */}
          <DataCard title="Informações" bodyClassName="space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-dark-muted">Recebida em</span>
                <span className="text-dark-text font-mono text-[10px]">
                  {fmtDt(ficha.created_at)}
                </span>
              </div>
              {ficha.finalizada_em && (
                <div className="flex justify-between">
                  <span className="text-dark-muted">Finalizada em</span>
                  <span className="text-dark-text font-mono text-[10px]">
                    {fmtDt(ficha.finalizada_em)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-dark-muted">ID</span>
                <span className="text-dark-muted font-mono text-[9px] truncate max-w-[120px]">{ficha.id}</span>
              </div>
            </div>
          </DataCard>

          {/* Timeline */}
          <DataCard title="Histórico">
            <Timeline ficha={ficha} />
          </DataCard>

          {/* Documentos */}
          <SecaoDocumentos
            fichaId={ficha.id}
            cpfCnpj={ficha.cpf || ficha.cnpj}
          />

          <DataCard
            title="Mensagem de retorno"
            actions={(
              <>
                <button
                  onClick={handleGerarMensagemRetorno}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-secondary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Gerar mensagem de retorno
                </button>
                <button
                  onClick={handleCopiarMensagemRetorno}
                  disabled={copiandoMensagem || !mensagemGerada}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-brand-accent/30 px-3 py-1.5 text-xs font-medium text-brand-accent transition-colors hover:bg-brand-accent/10 disabled:opacity-50"
                >
                  {copiandoMensagem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiandoMensagem ? 'Copiando...' : 'Copiar'}
                </button>
              </>
            )}
            bodyClassName="space-y-4"
          >
            <div className="rounded-2xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                {retornoSalvo?.texto ? 'Última mensagem salva' : 'Mensagem pronta para gerar'}
              </p>
              <p className="mt-1 text-xs text-dark-muted">
                {retornoSalvo?.texto
                  ? `A ficha mantém o texto gerado, o link de biometria e as cotações usadas na última geração${retornoSalvo?.gerado_em ? ` · ${fmtDt(retornoSalvo.gerado_em)}` : ''}.`
                  : 'Clique em gerar para salvar a mensagem dentro da ficha e manter o retorno sempre disponível.'}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
                Link de biometria
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-surface2/40 px-3 py-2">
                <LinkIcon className="w-4 h-4 flex-shrink-0 text-dark-muted" />
                <input
                  value={biometriaUrl}
                  onChange={e => setBiometriaUrl(e.target.value)}
                  placeholder="Cole aqui o link da biometria"
                  className="w-full bg-transparent text-sm text-dark-text outline-none placeholder:text-dark-muted/50"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-dark-border/70 bg-dark-surface2/30 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
                    {mensagemExibida ? 'Mensagem gerada' : 'Aguardando geração'}
                  </p>
                  <p className="mt-1 text-xs text-dark-muted">
                    {mensagemExibida
                      ? `O texto abaixo pode ser copiado e enviado${retornoSalvo?.gerado_em ? ` · salvo em ${fmtDt(retornoSalvo.gerado_em)}` : ''}.`
                      : 'A mensagem será montada ao clicar no botão acima.'}
                  </p>
                </div>
                {retornoSalvo?.status && (
                  <span className={`badge ${retornoSalvo.status === 'aprovado' ? 'badge-success' : retornoSalvo.status === 'recusado' ? 'badge-danger' : 'badge-warning'}`}>
                    {retornoSalvo.status}
                  </span>
                )}
              </div>
              <textarea
                readOnly
                value={mensagemExibida}
                rows={16}
                placeholder="A mensagem gerada aparecerá aqui."
                className="w-full resize-none rounded-2xl border border-dark-border bg-dark-surface px-4 py-3 font-mono text-[12px] leading-5 text-dark-text outline-none"
              />
            </div>

            {!!resumoCotacoesSalvas.length && (
              <div className="rounded-[28px] border border-dark-border/70 bg-white/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
                      Cotações usadas
                    </p>
                    <p className="mt-1 text-xs text-dark-muted">
                      {retornoSalvo?.seguradora_escolhida
                        ? `A última geração foi vinculada à seguradora ${normalizeDisplayText(retornoSalvo.seguradora_escolhida).toUpperCase()}.`
                        : 'Clique em uma seguradora para marcá-la como escolhida.'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {resumoCotacoesSalvas.map(cotacao => {
                    const isEscolhida = seguradoraEscolhida && cotacao.seguradora === seguradoraEscolhida
                    const statusLabel =
                      cotacao.status === 'recusado'
                        ? 'Recusado'
                        : cotacao.status === 'aprovado'
                          ? `${cotacao.parcelamento || '—'}x · ${cotacao.valor_parcela != null && cotacao.valor_parcela !== '' ? formatMoney(cotacao.valor_parcela) : '—'}`
                          : cotacao.status === 'sem_cadastro'
                            ? 'Sem cadastro'
                            : 'Pendente'

                    return (
                      <button
                        key={`snapshot-${cotacao.seguradora}`}
                        type="button"
                        onClick={() => selecionarSeguradora(cotacao)}
                        className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 ${
                          isEscolhida
                            ? 'border-brand-accent/50 bg-brand-accent/8 shadow-[0_14px_32px_rgba(245,88,42,0.12)] ring-1 ring-brand-accent/15'
                            : 'border-dark-border bg-dark-surface hover:border-brand-accent/35 hover:bg-white/80'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border bg-white shadow-sm ${isEscolhida ? 'border-brand-accent/30 ring-1 ring-brand-accent/10' : 'border-dark-border/40'}`}>
                            <SeguradoraBadge
                              nome={cotacao.seguradora}
                              logoUrl={cotacao.logo_url}
                              logoPath={cotacao.logo_path}
                              size="xl"
                              showName={false}
                              className="justify-center"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-dark-text md:text-base">
                                {normalizeDisplayText(cotacao.seguradora).toUpperCase()}
                              </p>
                              {isEscolhida && (
                                <span className="inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                  Escolhida
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-dark-muted">
                              {cotacao.status || 'sem status'}
                            </p>
                            <p className="mt-1 text-xs text-dark-muted">
                              Clique para definir esta seguradora como a escolhida.
                            </p>
                          </div>
                        </div>
                        <div className="ml-auto flex-shrink-0 text-right">
                          <p className="text-sm font-semibold text-dark-text md:text-base">
                            {statusLabel}
                          </p>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-dark-muted">
                            comissão {ficha.pct_comissao != null && ficha.pct_comissao !== '' ? `${ficha.pct_comissao}%` : '—'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </DataCard>
        </div>
      </div>

    </div>
  )
}
