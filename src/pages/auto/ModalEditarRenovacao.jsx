import { useState } from 'react'
import { X } from 'lucide-react'
import SeguradoraSelect from '../../components/SeguradoraSelect'

// Edicao dos 3 campos que uma renovacao possui de forma independente de
// cliente/apolice (seguradora, vencimento, data limite da cotacao) — os
// mesmos campos do formulario de criacao manual (AutoRenovacoesPuxar.jsx).
// Compartilhado entre AutoRenovacoes.jsx e AutoRenovacoesPuxar.jsx.
export default function ModalEditarRenovacao({ renovacao, onClose, onSave, isSaving }) {
  const [seguradora, setSeguradora] = useState(renovacao.seguradora || '')
  const [vigenciaFim, setVigenciaFim] = useState(renovacao.vigencia_fim || '')
  const [dataLimite, setDataLimite] = useState(renovacao.data_limite_envio || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-dark-border bg-dark-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-dark-text">Editar renovação</h3>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</label>
            <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto="auto" placeholder="Selecionar seguradora" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data de vencimento</label>
            <input type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data limite da cotação</label>
            <input type="date" value={dataLimite} onChange={e => setDataLimite(e.target.value)} className="input w-full" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onSave({ seguradora: seguradora || null, vigencia_fim: vigenciaFim, data_limite_envio: dataLimite || null })}
            disabled={isSaving || !vigenciaFim}
            className="btn-primary disabled:opacity-60"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
