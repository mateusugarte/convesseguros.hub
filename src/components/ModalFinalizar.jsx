import { useState } from 'react'
import { finalizarFicha, SEGURADORAS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, X } from 'lucide-react'

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
    if (err) setError('Não foi possível finalizar a ficha.')
    else onSuccess()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-status-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-status-success" />
            </div>
            <div>
              <h2 className="font-bold text-dark-text">Finalizar Ficha</h2>
              {ficha?.nome_interessado && (
                <p className="text-xs text-dark-muted">{ficha.nome_interessado}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X className="w-5 h-5" />
          </button>
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
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
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
            <input
              type="text"
              list="seg-list-finalizar"
              value={seguradora}
              onChange={e => setSeguradora(e.target.value)}
              placeholder="Selecione ou digite..."
              className="input"
              autoComplete="off"
            />
            <datalist id="seg-list-finalizar">
              {SEGURADORAS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          {/* Retorno */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-surface2 cursor-pointer hover:border-brand-accent/40 transition-colors">
            <input
              type="checkbox"
              checked={retorno}
              onChange={e => setRetorno(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-accent"
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
