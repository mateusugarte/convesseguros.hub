import { useState } from 'react'
import { X } from 'lucide-react'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { calcularDataLimiteRenovacao } from './autoShared'

// Edicao dos campos independentes de cliente/apolice. A data limite e sempre
// derivada do vencimento pela mesma regra usada na importacao.
// Compartilhado entre AutoRenovacoes.jsx e AutoRenovacoesPuxar.jsx.
export default function ModalEditarRenovacao({ renovacao, onClose, onSave, isSaving }) {
  const [seguradora, setSeguradora] = useState(renovacao.seguradora || '')
  const [outraSeguradora, setOutraSeguradora] = useState(renovacao.outra_seguradora || '')
  const [vigenciaFim, setVigenciaFim] = useState(renovacao.vigencia_fim || '')
  const [identificacaoVeiculo, setIdentificacaoVeiculo] = useState(renovacao.identificacao_veiculo || '')
  const dataLimite = calcularDataLimiteRenovacao(vigenciaFim) || ''

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
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora atual</label>
            <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto="auto" placeholder="Selecionar seguradora" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Outra seguradora <span className="normal-case tracking-normal">(opcional)</span></label>
            <SeguradoraSelect value={outraSeguradora} onChange={setOutraSeguradora} produto="auto" placeholder="Selecionar outra seguradora" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data de vencimento</label>
            <input type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data limite automática</label>
            <input type="date" value={dataLimite} readOnly className="input w-full opacity-80" />
            <p className="mt-1 text-xs text-dark-muted">Calculada em 10 dias úteis antes do vencimento.</p>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Veículo <span className="normal-case tracking-normal">(opcional)</span></label>
            <input value={identificacaoVeiculo} onChange={e => setIdentificacaoVeiculo(e.target.value)} placeholder="Modelo e/ou placa" className="input w-full" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onSave({
              seguradora: seguradora || null,
              outra_seguradora: outraSeguradora || null,
              vigencia_fim: vigenciaFim,
              identificacao_veiculo: identificacaoVeiculo.trim() || null,
            })}
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
