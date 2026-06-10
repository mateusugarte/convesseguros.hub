import { useState } from 'react'
import { assumirFicha } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { UserCheck, ArrowLeft } from 'lucide-react'

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
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative glass-modal rounded-2xl p-6 space-y-5 w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-brand-secondary/20 flex items-center justify-center flex-shrink-0">
            <UserCheck className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="font-bold text-dark-text">Assumir Ficha</h2>
            <p className="text-xs text-dark-muted">Esta ação não pode ser desfeita</p>
          </div>
        </div>

        <p className="text-sm text-dark-muted leading-relaxed">
          Ao assumir, a ficha passará para <span className="text-status-warning font-medium">Em Cotação</span> e ficará sob sua responsabilidade.
        </p>

        {error && (
          <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleAssumir} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Assumindo...' : 'Confirmar e Assumir'}
          </button>
        </div>
      </div>
    </div>
  )
}

