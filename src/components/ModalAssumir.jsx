import { useState } from 'react'
import { assumirFicha } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { UserCheck, ArrowLeft } from 'lucide-react'
import { ModalFrame } from './ui/ModalFrame'

export default function ModalAssumir({ id, onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleAssumir() {
    setLoading(true)
    setError('')
    const err = await assumirFicha(id, user.id)
    if (err) setError('Não foi possível assumir a ficha.')
    else onSuccess()
    setLoading(false)
  }

  return (
    <ModalFrame
      onClose={onClose}
      size="sm"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      surfaceClassName="glass-modal ficha-action-modal"
      ariaLabel="Assumir ficha"
    >
      <div className="glass-modal">
        {/* Header */}
        <div className="modal-shell-header flex items-center gap-3 border-b border-dark-border/60">
          <button onClick={onClose} className="modal-close-button" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-brand-secondary/20 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-status-info" />
          </div>
          <div>
            <h2 className="font-bold text-dark-text">Assumir Ficha</h2>
            <p className="text-xs text-dark-muted">Esta ação não pode ser desfeita</p>
          </div>
        </div>

        <div className="modal-shell-body space-y-4 p-5">
        <p className="text-sm text-dark-muted leading-relaxed">
          Ao assumir, a ficha passará para <span className="text-status-warning font-medium">Em Cotação</span> e ficará sob sua responsabilidade.
        </p>

        {error && (
          <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        </div>

        <div className="modal-shell-footer flex gap-3 border-t border-dark-border/60">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleAssumir} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Assumindo...' : 'Confirmar e Assumir'}
          </button>
        </div>
      </div>
    </ModalFrame>
  )
}
