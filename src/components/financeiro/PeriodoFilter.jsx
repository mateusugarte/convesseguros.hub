import { useEffect, useState } from 'react'
import { Select } from '../ui/Select'
import { primeiroDiaMes } from '../../lib/financeiroCalc'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}
function fmtData(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Filtro de período: modo "Mês" (ano + mês) e modo "Intervalo" (datas livres, sem limite).
// Emite { inicio, fim, label, mesRef } via onChange sempre que muda.
export default function PeriodoFilter({ onChange }) {
  const agora = new Date()
  const [modo, setModo] = useState('mes')
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')

  useEffect(() => {
    if (modo === 'mes') {
      const [i, f] = rangeMes(ano, mes)
      onChange?.({ inicio: i, fim: f, label: `${MESES_ABBR[mes - 1]} ${ano}`, mesRef: `${ano}-${pad2(mes)}-01` })
    } else if (inicio && fim) {
      onChange?.({ inicio, fim, label: `${fmtData(inicio)} a ${fmtData(fim)}`, mesRef: primeiroDiaMes(inicio) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, ano, mes, inicio, fim])

  const anos = [agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2]

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl bg-dark-surface2/60 p-1">
        {[['mes', 'Mês'], ['intervalo', 'Intervalo']].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setModo(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${modo === v ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:text-dark-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {modo === 'mes' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={anos.map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
          <div className="flex flex-wrap items-center gap-1">
            {MESES_ABBR.map((label, i) => (
              <button
                key={label}
                onClick={() => setMes(i + 1)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-dark-muted">
            De
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1.5 text-sm text-dark-text focus:border-brand-secondary focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 text-xs text-dark-muted">
            até
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1.5 text-sm text-dark-text focus:border-brand-secondary focus:outline-none" />
          </label>
          {(!inicio || !fim) && <span className="text-xs text-dark-muted">Selecione as duas datas</span>}
        </div>
      )}
    </div>
  )
}
