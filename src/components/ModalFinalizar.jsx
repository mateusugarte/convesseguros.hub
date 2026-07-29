import { useMemo, useState } from 'react'
import { finalizarFichaComRawData } from '../lib/fichas'
import { toNumber } from '../lib/apolices'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, ArrowRight, Ban, Check, CircleCheckBig, FileCheck2,
  SearchCheck, ShieldAlert, TimerOff, UserX,
} from 'lucide-react'
import SeguradoraSelect from './SeguradoraSelect'
import { ModalFrame } from './ui/ModalFrame'

const STATUS_FINAIS = [
  { value: 'aprovado', label: 'Aprovado', description: 'Aceita e pronta para seguir para emissão.', icon: CircleCheckBig, tone: 'success' },
  { value: 'recusado', label: 'Recusado', description: 'Análise concluída sem aprovação.', icon: Ban, tone: 'danger' },
  { value: 'emitido', label: 'Emitido', description: 'A apólice já foi emitida pela seguradora.', icon: FileCheck2, tone: 'info' },
  { value: 'em_analise', label: 'Em análise', description: 'Ainda aguarda uma decisão da seguradora.', icon: SearchCheck, tone: 'info' },
  { value: 'cancelado', label: 'Cancelado', description: 'Atendimento interrompido ou cancelado.', icon: UserX, tone: 'neutral' },
  { value: 'cpf_invalido', label: 'CPF inválido', description: 'O documento impede a continuidade.', icon: ShieldAlert, tone: 'warning' },
  { value: 'expirada', label: 'Expirada', description: 'O prazo desta oportunidade foi encerrado.', icon: TimerOff, tone: 'neutral' },
]

function fichaNome(ficha) {
  const raw = ficha?.raw_data || {}
  return ficha?.nome_empresa || ficha?.nome_interessado || raw.nome_empresa || raw.razao_social || raw.nome || 'Ficha sem nome'
}

function normalizeSeguradora(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR')
}

function resolveCotacaoAprovada(ficha) {
  const raw = ficha?.raw_data || {}
  const cotacoesAtuais = Array.isArray(raw.cotacoes) ? raw.cotacoes : []
  const cotacoesSnapshot = Array.isArray(raw.retorno_gerado?.cotacoes_snapshot)
    ? raw.retorno_gerado.cotacoes_snapshot
    : []
  const cotacoes = cotacoesAtuais.some(item => item?.status === 'aprovado')
    ? cotacoesAtuais
    : cotacoesSnapshot
  const aprovadas = cotacoes.filter(item => item?.status === 'aprovado')
  const preferidas = [
    raw.seguradora_escolhida,
    raw.retorno_gerado?.seguradora_escolhida,
    ficha?.seguradora,
  ].filter(Boolean)

  const escolhidaManualmente = preferidas
    .map(nome => aprovadas.find(item => normalizeSeguradora(item?.seguradora) === normalizeSeguradora(nome)))
    .find(Boolean)

  const escolhida = escolhidaManualmente || aprovadas
    .map(item => ({
      ...item,
      _total: (toNumber(item?.valor_parcela) || 0) * (toNumber(item?.parcelamento) || 0),
    }))
    .sort((a, b) => {
      const totalA = a._total > 0 ? a._total : Number.POSITIVE_INFINITY
      const totalB = b._total > 0 ? b._total : Number.POSITIVE_INFINITY
      return totalA - totalB
    })[0]

  return {
    seguradora: escolhida?.seguradora || preferidas[0] || '',
    valorParcela: escolhida?.valor_parcela ?? ficha?.valor_parcela ?? '',
    encontrada: Boolean(escolhida),
  }
}

function formatMoneyBR(value) {
  const number = toNumber(value)
  if (!(number > 0)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function formatValueInput(value) {
  if (value === '' || value == null) return ''
  const number = toNumber(value)
  if (!Number.isFinite(number)) return ''
  return number.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 })
}

export default function ModalFinalizar({ ficha, defaultStatus, onClose, onSuccess }) {
  const { user } = useAuth()
  const cotacaoAprovada = useMemo(() => resolveCotacaoAprovada(ficha), [ficha])
  const [step, setStep] = useState(defaultStatus ? 2 : 1)
  const [status, setStatus] = useState(defaultStatus || '')
  const [seguradora, setSeguradora] = useState(
    cotacaoAprovada.seguradora
  )
  const [valorParcela, setValorParcela] = useState(
    formatValueInput(cotacaoAprovada.valorParcela)
  )
  const [retornoEnviado, setRetornoEnviado] = useState(Boolean(ficha?.retorno_enviado))
  const [passadoPelaImobiliaria, setPassadoPelaImobiliaria] = useState(
    Boolean(ficha?.raw_data?.passado_pela_imobiliaria)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editarDadosAprovacao, setEditarDadosAprovacao] = useState(false)

  const selectedStatus = useMemo(() => STATUS_FINAIS.find(item => item.value === status), [status])
  const precisaSeguradora = status === 'aprovado' || status === 'emitido'
  const precisaValor = status === 'aprovado'
  const valorNumerico = toNumber(valorParcela)
  const dadosAprovacaoPreenchidos = Boolean(seguradora.trim()) && valorNumerico > 0
  const detalhesValidos = (!precisaSeguradora || Boolean(seguradora.trim())) && (!precisaValor || valorNumerico > 0)
  const SelectedIcon = selectedStatus?.icon || CircleCheckBig

  function avancar() {
    if (!status) return setError('Selecione o resultado do atendimento.')
    setError('')
    setStep(2)
  }

  async function handleFinalizar() {
    if (precisaSeguradora && !seguradora.trim()) return setError('Selecione a seguradora para concluir.')
    if (precisaValor && !(valorNumerico > 0)) return setError('Informe um valor de parcela válido para concluir a aprovação.')

    setLoading(true)
    setError('')
    const err = await finalizarFichaComRawData(ficha.id, {
      status,
      seguradora: seguradora.trim() || null,
      valor_parcela: precisaValor ? valorNumerico : undefined,
      retorno_enviado: retornoEnviado,
      userId: user?.id,
      rawDataPatch: status === 'aprovado' ? { passado_pela_imobiliaria: passadoPelaImobiliaria } : undefined,
    })
    if (err) {
      console.error('Erro ao finalizar ficha:', err)
      setError(err.message || 'Não foi possível concluir a ficha.')
      setLoading(false)
      return
    }
    setLoading(false)
    onSuccess()
  }

  return (
    <ModalFrame
      onClose={onClose}
      size="lg"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      surfaceClassName="ficha-action-modal finish-flow-modal"
      ariaLabel="Concluir atendimento da ficha"
    >
      <div className="finish-flow">
        <header className="modal-shell-header finish-flow-header">
          <button
            type="button"
            onClick={step === 2 && !defaultStatus ? () => setStep(1) : onClose}
            className="modal-close-button"
            aria-label={step === 2 && !defaultStatus ? 'Voltar para resultados' : 'Fechar'}
            disabled={loading}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="finish-flow-heading">
            <span>Encerrar atendimento</span>
            <h2>Concluir ficha</h2>
            <p>{fichaNome(ficha)}</p>
          </div>
          <div className="finish-flow-progress" aria-label={`Etapa ${step} de 2`}>
            <span className="is-active">1</span><i className={step >= 2 ? 'is-active' : ''} /><span className={step >= 2 ? 'is-active' : ''}>2</span>
          </div>
        </header>

        <main className="modal-shell-body finish-flow-body">
          {step === 1 ? (
            <section className="finish-step" aria-labelledby="finish-outcome-title">
              <div className="finish-step-copy">
                <span>Etapa 1 de 2</span>
                <h3 id="finish-outcome-title">Qual foi o resultado?</h3>
                <p>Escolha o desfecho para mostrarmos apenas os campos necessários.</p>
              </div>
              <div className="finish-outcome-grid">
                {STATUS_FINAIS.map(item => {
                  const Icon = item.icon
                  const active = status === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => { setStatus(item.value); setError('') }}
                      className={`finish-outcome finish-tone-${item.tone}${active ? ' is-selected' : ''}`}
                      aria-pressed={active}
                    >
                      <span className="finish-outcome-icon"><Icon /></span>
                      <span className="finish-outcome-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                      <span className="finish-outcome-check">{active && <Check className="w-3.5 h-3.5" />}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : (
            <section className="finish-step" aria-labelledby="finish-details-title">
              <div className="finish-step-copy finish-step-copy-inline">
                <div><span>Etapa 2 de 2</span><h3 id="finish-details-title">Revise os detalhes</h3><p>Confirme as informações antes de concluir.</p></div>
                <div className={`finish-selected-status finish-tone-${selectedStatus?.tone || 'neutral'}`}>
                  <SelectedIcon /><span><small>Resultado</small><strong>{selectedStatus?.label}</strong></span>
                </div>
              </div>

              <div className="finish-details-grid">
                {status === 'aprovado' && dadosAprovacaoPreenchidos && !editarDadosAprovacao && (
                  <div className="finish-approved-summary finish-field-wide">
                    <span className="finish-approved-summary-icon"><CircleCheckBig /></span>
                    <div>
                      <small>{cotacaoAprovada.encontrada ? 'Cotação aprovada localizada' : 'Dados da aprovação já preenchidos'}</small>
                      <strong>{seguradora}</strong>
                      <p>{formatMoneyBR(valorNumerico)} por parcela</p>
                    </div>
                    <button type="button" onClick={() => setEditarDadosAprovacao(true)}>Alterar dados</button>
                  </div>
                )}
                {precisaSeguradora && (status !== 'aprovado' || !dadosAprovacaoPreenchidos || editarDadosAprovacao) && (
                  <div className="finish-field finish-field-wide">
                    <label>Seguradora <span>*</span></label>
                    <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto={ficha?.produto} required />
                  </div>
                )}
                {precisaValor && (!dadosAprovacaoPreenchidos || editarDadosAprovacao) && (
                  <div className="finish-field">
                    <label htmlFor="finish-valor-parcela">Valor da parcela <span>*</span></label>
                    <div className="finish-money-input"><span>R$</span><input id="finish-valor-parcela" type="text" inputMode="decimal" value={valorParcela} onChange={event => setValorParcela(event.target.value)} placeholder="0,00" autoComplete="off" /></div>
                  </div>
                )}
                <div className={`finish-field${precisaValor && (!dadosAprovacaoPreenchidos || editarDadosAprovacao) ? '' : ' finish-field-wide'}`}>
                  <span className="finish-field-label">Retorno enviado?</span>
                  <div className="finish-segmented" role="group" aria-label="Retorno enviado">
                    <button type="button" onClick={() => setRetornoEnviado(true)} className={retornoEnviado ? 'is-active is-positive' : ''}>Sim, enviado</button>
                    <button type="button" onClick={() => setRetornoEnviado(false)} className={!retornoEnviado ? 'is-active' : ''}>Ainda não</button>
                  </div>
                </div>
                {status === 'aprovado' && (
                  <button type="button" className={`finish-toggle finish-field-wide${passadoPelaImobiliaria ? ' is-active' : ''}`} onClick={() => setPassadoPelaImobiliaria(value => !value)} aria-pressed={passadoPelaImobiliaria}>
                    <span className="finish-toggle-mark">{passadoPelaImobiliaria && <Check className="w-3.5 h-3.5" />}</span>
                    <span><strong>Passado pela imobiliária</strong><small>Marque quando a aprovação já foi comunicada e validada.</small></span>
                  </button>
                )}
                {!precisaSeguradora && (
                  <div className="finish-context-note finish-field-wide"><SelectedIcon /><p><strong>Nenhum dado adicional obrigatório.</strong> Revise o retorno e conclua quando estiver pronto.</p></div>
                )}
              </div>
            </section>
          )}
          {error && <div className="finish-error" role="alert">{error}</div>}
        </main>

        <footer className="modal-shell-footer finish-flow-footer">
          <p>{step === 1 ? 'O status só muda depois da confirmação final.' : `A ficha será movida para “${selectedStatus?.label || status}”.`}</p>
          <div>
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">Cancelar</button>
            {step === 1 ? (
              <button type="button" onClick={avancar} disabled={!status} className="btn-primary finish-primary-action">Continuar <ArrowRight className="w-4 h-4" /></button>
            ) : (
              <button type="button" onClick={handleFinalizar} disabled={loading || !detalhesValidos} className="btn-primary finish-primary-action">
                {loading ? 'Concluindo...' : status === 'aprovado' ? 'Concluir aprovação' : 'Concluir ficha'}
                {!loading && <Check className="w-4 h-4" />}
              </button>
            )}
          </div>
        </footer>
      </div>
    </ModalFrame>
  )
}
