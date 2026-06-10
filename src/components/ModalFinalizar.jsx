import { useState } from 'react'
import { finalizarFicha } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, ArrowLeft } from 'lucide-react'
import SeguradoraSelect from './SeguradoraSelect'

const STATUS_FINAIS = [
  { value: 'aprovado',     label: 'Aprovado',     color: 'text-status-success' },
  { value: 'recusado',     label: 'Recusado',     color: 'text-status-danger' },
  { value: 'emitido',      label: 'Emitido',      color: 'text-brand-accent' },
  { value: 'em_analise',   label: 'Em Análise',   color: 'text-brand-accent' },
  { value: 'cancelado',    label: 'Cancelado',    color: 'text-dark-muted' },
  { value: 'cpf_invalido', label: 'CPF Inválido', color: 'text-status-warning' },
  { value: 'expirada',     label: 'Expirada',     color: 'text-dark-muted' },
]

export default function ModalFinalizar({ ficha, defaultStatus, onClose, onSuccess }) {
  const { user } = useAuth()
  const [status,    setStatus]    = useState(defaultStatus || '')
  const [seguradora,setSeguradora]= useState(ficha?.seguradora ?? '')
  const [retorno,   setRetorno]   = useState(ficha?.retorno_enviado ?? false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleFinalizar() {
    if (!status) { setError('Selecione o status final.'); return }
    setLoading(true)
    setError('')
    const err = await finalizarFicha(ficha.id, {
      status,
      seguradora: seguradora.trim() || null,
      retorno_enviado: retorno,
      userId: user?.id,
    })
    if (err) {
      console.error('Erro ao finalizar ficha:', err)
      setError(err.message || 'Não foi possível finalizar a ficha.')
    } else onSuccess()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative glass-modal rounded-2xl overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-border">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-status-success/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-status-success" />
          </div>
          <div>
            <h2 className="font-bold text-dark-text">Finalizar Ficha</h2>
            {ficha?.nome_interessado && (
              <p className="text-xs text-dark-muted">{ficha.nome_interessado}</p>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-dark-muted mb-2 uppercase tracking-wider">
              Status Final <span className="text-status-danger">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_FINAIS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all ${
                    status === s.value
                      ? 'border-brand-accent bg-brand-accent/10 text-dark-text'
                      : 'border-dark-border bg-dark-surface2 text-dark-muted hover:border-dark-muted'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seguradora */}
          <div>
            <label className="block text-xs font-medium text-dark-muted mb-1.5 uppercase tracking-wider">Seguradora</label>
            <SeguradoraSelect value={seguradora} onChange={setSeguradora} />
          </div>

          {/* Retorno */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-surface2 cursor-pointer hover:border-brand-accent/40 transition-colors">
            <input
              type="checkbox"
              checked={retorno}
              onChange={e => setRetorno(e.target.checked)}
              className="w-5 h-5 rounded accent-brand-accent"
            />
            <span className="text-sm text-dark-text">Retorno enviado ao cliente</span>
          </label>

          {error && (
            <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleFinalizar} disabled={loading || !status} className="btn-primary flex-1">
            {loading ? 'Salvando...' : 'Finalizar Ficha'}
          </button>
        </div>
      </div>
    </div>
  )
}

