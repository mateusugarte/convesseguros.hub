import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEmissoesAuto, moverEmissaoColuna, emitirApoliceAuto } from '../../lib/auto'

const COLUNAS = [
  { id: 'cotacao_feita',      label: 'Cotação Feita' },
  { id: 'negociando',         label: 'Negociando' },
  { id: 'aguardando_vistoria', label: 'Aguardando Vistoria' },
  { id: 'emitida',            label: 'Emitida' },
]

const FORM_VAZIO = {
  seguradora: '', numero_apolice: '', vigencia_inicio: '', vigencia_fim: '',
  premio_liquido: '', pct_comissao: '', forma_pagamento: '', parcelamento: '',
  tipo_producao: 'equipe', responsavel: '', eh_renovacao: false,
  tem_repasse: false, pct_repasse: '', nome_repasse: '',
}

function CardEmissao({ emissao, onDragStart }) {
  const tipo = emissao.cotacoes_auto?.tipo ?? emissao.tipo
  const cor = tipo === 'renovacao'
    ? 'border-l-4 border-green-500'
    : 'border-l-4 border-blue-500'

  return (
    <div
      draggable
      onDragStart={() => onDragStart(emissao)}
      className={`bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 cursor-grab active:cursor-grabbing shadow-sm ${cor}`}
    >
      <p className="font-medium text-sm truncate">{emissao.clientes_auto?.nome_completo ?? '—'}</p>
      <p className="text-xs text-gray-500 truncate mt-0.5">
        {emissao.cotacoes_auto?.modelo_veiculo ?? '—'}
      </p>
      <span className={`text-xs px-2 py-0.5 rounded-full mt-1.5 inline-block font-medium ${
        tipo === 'renovacao' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {tipo === 'renovacao' ? 'Renovação' : 'Novo'}
      </span>
    </div>
  )
}

function CampoTexto({ label, campo, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(campo, e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
    </div>
  )
}

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [modalEmissao, setModalEmissao] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes'],
    queryFn: getEmissoesAuto,
  })

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { mutate: emitir, isPending } = useMutation({
    mutationFn: payload => emitirApoliceAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setModalEmissao(null)
      setForm(FORM_VAZIO)
    },
  })

  function setField(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  function handleDrop(colunaDestino) {
    if (!dragging) return
    if (colunaDestino === 'emitida') {
      setModalEmissao(dragging)
    } else {
      mover({ id: dragging.id, coluna: colunaDestino })
    }
    setDragging(null)
    setDragOver(null)
  }

  const premioLiquido = parseFloat(form.premio_liquido) || 0
  const pctComissao   = parseFloat(form.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
  const valorRepasse  = form.tem_repasse ? valorComissao * (parseFloat(form.pct_repasse) || 0) : 0

  function handleEmitir() {
    emitir({
      emissao_id:      modalEmissao.id,
      cliente_id:      modalEmissao.cliente_id,
      seguradora:      form.seguradora,
      numero_apolice:  form.numero_apolice,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim:    form.vigencia_fim,
      premio_liquido:  premioLiquido,
      pct_comissao:    pctComissao,
      valor_comissao:  valorComissao,
      forma_pagamento: form.forma_pagamento,
      parcelamento:    form.parcelamento,
      tipo_producao:   form.tipo_producao,
      responsavel:     form.tipo_producao === 'individual' ? form.responsavel : null,
      eh_renovacao:    form.eh_renovacao,
      tem_repasse:     form.tem_repasse,
      pct_repasse:     form.tem_repasse ? parseFloat(form.pct_repasse) : null,
      nome_repasse:    form.tem_repasse ? form.nome_repasse : null,
      valor_repasse:   form.tem_repasse ? valorRepasse : null,
    })
    mover({ id: modalEmissao.id, coluna: 'emitida' })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestão de Emissões Auto</h1>

      <div className="grid grid-cols-4 gap-4">
        {COLUNAS.map(col => {
          const cards = emissoes.filter(e => e.coluna === col.id)
          return (
            <div
              key={col.id}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
              onDrop={() => handleDrop(col.id)}
              onDragLeave={() => setDragOver(null)}
              className={`rounded-xl p-3 min-h-[300px] transition-colors ${
                dragOver === col.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {col.label} <span className="text-gray-400">({cards.length})</span>
              </h2>
              <div className="space-y-2">
                {cards.map(e => (
                  <CardEmissao
                    key={e.id}
                    emissao={e}
                    onDragStart={setDragging}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {modalEmissao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <div>
              <h2 className="text-lg font-bold">Emitir Apólice</h2>
              <p className="text-sm text-gray-500 mt-0.5">{modalEmissao.clientes_auto?.nome_completo}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoTexto label="Seguradora"        campo="seguradora"       value={form.seguradora}       onChange={setField} />
              <CampoTexto label="Número da apólice" campo="numero_apolice"   value={form.numero_apolice}   onChange={setField} />
              <CampoTexto label="Vigência início"   campo="vigencia_inicio"  value={form.vigencia_inicio}  onChange={setField} type="date" />
              <CampoTexto label="Vigência fim"      campo="vigencia_fim"     value={form.vigencia_fim}     onChange={setField} type="date" />
              <CampoTexto label="Prêmio líquido"    campo="premio_liquido"   value={form.premio_liquido}   onChange={setField} type="number" />
              <CampoTexto label="% Comissão (0.15)" campo="pct_comissao"     value={form.pct_comissao}     onChange={setField} type="number" />
              <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento}  onChange={setField} />
              <CampoTexto label="Parcelamento"      campo="parcelamento"     value={form.parcelamento}     onChange={setField} />
            </div>

            {premioLiquido > 0 && pctComissao > 0 && (
              <p className="text-sm font-medium text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Comissão: R$ {valorComissao.toFixed(2)}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de produção</label>
              <select
                value={form.tipo_producao}
                onChange={e => setField('tipo_producao', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="equipe">Equipe</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            {form.tipo_producao === 'individual' && (
              <CampoTexto label="Responsável" campo="responsavel" value={form.responsavel} onChange={setField} />
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.eh_renovacao}
                  onChange={e => setField('eh_renovacao', e.target.checked)}
                  className="rounded"
                />
                É renovação da carteira?
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.tem_repasse}
                  onChange={e => setField('tem_repasse', e.target.checked)}
                  className="rounded"
                />
                Existe repasse?
              </label>
            </div>

            {form.tem_repasse && (
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto label="% Repasse (0.10)" campo="pct_repasse"  value={form.pct_repasse}  onChange={setField} type="number" />
                <CampoTexto label="Nome do repasse"  campo="nome_repasse" value={form.nome_repasse} onChange={setField} />
                {valorRepasse > 0 && (
                  <p className="col-span-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    Repasse: R$ {valorRepasse.toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setModalEmissao(null); setForm(FORM_VAZIO) }}
                className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmitir}
                disabled={isPending || !form.vigencia_fim}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                {isPending ? 'Emitindo...' : 'Confirmar emissão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
