import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRenovacoesAuto, atualizarStatusRenovacao } from '../../lib/auto'

const PERIODOS = [
  { value: 'proximo_mes', label: 'Próximo mês' },
  { value: 'mes_atual',   label: 'Mês atual' },
  { value: 'passadas',    label: 'Passadas' },
  { value: '',            label: 'Todas' },
]

const STATUS_COTACAO = {
  nao_cotada:        { label: 'Não cotada',           cor: 'bg-red-50 border-red-300' },
  cotada_nao_enviada: { label: 'Cotada — não enviada', cor: 'bg-yellow-50 border-yellow-300' },
  cotada_enviada:    { label: 'Cotada e enviada',      cor: 'bg-green-50 border-green-300' },
}

const BADGE_COR = {
  nao_cotada:         'bg-red-100 text-red-700',
  cotada_nao_enviada: 'bg-yellow-100 text-yellow-700',
  cotada_enviada:     'bg-green-100 text-green-700',
}

function formatarData(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR')
}

export default function AutoRenovacoes() {
  const [periodo, setPeriodo] = useState('proximo_mes')
  const qc = useQueryClient()

  const { data: renovacoes = [], isLoading } = useQuery({
    queryKey: ['auto-renovacoes', periodo],
    queryFn: () => getRenovacoesAuto({ periodo }),
  })

  const { mutate: atualizarStatus } = useMutation({
    mutationFn: ({ id, status_cotacao }) => atualizarStatusRenovacao(id, { status_cotacao }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Renovações Auto</h1>
        <span className="text-sm text-gray-400">{renovacoes.length} registro(s)</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              periodo === p.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-400 py-8 text-center">Carregando...</p>}

      {!isLoading && renovacoes.length === 0 && (
        <p className="text-gray-400 py-8 text-center">Nenhuma renovação no período selecionado.</p>
      )}

      <div className="space-y-2">
        {renovacoes.map(r => {
          const statusInfo = STATUS_COTACAO[r.status_cotacao] ?? STATUS_COTACAO.nao_cotada
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${statusInfo.cor}`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.clientes_auto?.nome_completo ?? '—'}</p>
                <p className="text-sm text-gray-600">
                  {r.seguradora} &mdash; Vence: <strong>{formatarData(r.vigencia_fim)}</strong>
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium ${BADGE_COR[r.status_cotacao]}`}>
                  {statusInfo.label}
                </span>
              </div>
              <select
                value={r.status_cotacao}
                onChange={e => atualizarStatus({ id: r.id, status_cotacao: e.target.value })}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-800 shrink-0"
              >
                <option value="nao_cotada">Não cotada</option>
                <option value="cotada_nao_enviada">Cotada — não enviada</option>
                <option value="cotada_enviada">Cotada e enviada</option>
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
