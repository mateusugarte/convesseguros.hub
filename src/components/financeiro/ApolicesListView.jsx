import { useMemo, useState } from 'react'
import { Select } from '../ui/Select'
import SeguradoraBadge from '../SeguradoraBadge'
import { formatMoneyBR } from '../../lib/apolices'

function fmtData(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'
}
function vigencia(row) {
  const i = fmtData(row.inicio_vigencia)
  const f = fmtData(row.fim_vigencia)
  if (i === '—' && f === '—') return '—'
  return `${i} – ${f}`
}
const STATUS_BADGE = {
  ativa: 'bg-emerald-500/15 text-emerald-400',
  renovada: 'bg-blue-500/15 text-blue-400',
  cancelada: 'bg-red-500/15 text-red-400',
  expirada: 'bg-amber-500/15 text-amber-400',
}

// Tabela de apólices com filtro por seguradora (sem modal).
// onRowClick(apolice) opcional → linha vira clicável.
export default function ApolicesListView({ apolices = [], loading = false, onRowClick, showImobiliaria = false }) {
  const [seg, setSeg] = useState('')

  const seguradoras = useMemo(
    () => [...new Set(apolices.map(a => a.seguradora).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [apolices],
  )
  const filtradas = useMemo(
    () => (seg ? apolices.filter(a => a.seguradora === seg) : apolices),
    [apolices, seg],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={seg}
          onChange={setSeg}
          options={[{ value: '', label: 'Todas as seguradoras' }, ...seguradoras.map(s => ({ value: s, label: s }))]}
          className="min-w-[220px]"
        />
        <span className="text-xs text-dark-muted">{filtradas.length} apólice{filtradas.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="py-12 text-center text-sm text-dark-muted">Nenhuma apólice encontrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-table text-sm">
            <thead className="table-thead">
              <tr>
                {[
                  'Seguradora', 'Cliente', ...(showImobiliaria ? ['Imobiliária'] : []), 'Nº apólice',
                  'Prêmio', 'Comissão', 'Parcelamento', 'Parcela', 'Vigência', 'Status',
                ].map(h => (
                  <th key={h} className="th whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filtradas.map(a => (
                <tr
                  key={a.id}
                  onClick={onRowClick ? () => onRowClick(a) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-dark-surface2/40' : ''}
                >
                  <td className="td"><SeguradoraBadge nome={a.seguradora} size="sm" /></td>
                  <td className="td whitespace-nowrap">{a.nome_interessado || '—'}</td>
                  {showImobiliaria && <td className="td whitespace-nowrap">{a.imobiliaria || '—'}</td>}
                  <td className="td whitespace-nowrap font-mono text-xs">{a.numero_apolice || '—'}</td>
                  <td className="td whitespace-nowrap font-mono text-xs">{formatMoneyBR(a.premio_total)}</td>
                  <td className="td whitespace-nowrap font-mono text-xs">{formatMoneyBR(a.valor_comissao)}</td>
                  <td className="td font-mono text-xs">{a.parcelamento}x</td>
                  <td className="td whitespace-nowrap font-mono text-xs">{formatMoneyBR(a.valor_parcela)}</td>
                  <td className="td whitespace-nowrap font-mono text-xs">{vigencia(a)}</td>
                  <td className="td">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[a.status_apolice] || 'bg-dark-surface2 text-dark-muted'}`}>
                      {a.status_apolice || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
