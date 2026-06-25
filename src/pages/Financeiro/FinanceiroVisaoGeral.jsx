import { useEffect, useMemo, useState } from 'react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import { fetchComissaoGerada, fetchApolicesEmitidasCount, fetchRecebimentos } from '../../lib/financeiro'
import { formatMoneyBR } from '../../lib/apolices'
import { primeiroDiaMes, addMeses, projetarProximosMeses } from '../../lib/financeiroCalc'
import { Coins, TrendingUp, FileText, CalendarClock } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PROJECAO_MESES = 12

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroVisaoGeral() {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [comissaoGerada, setComissaoGerada] = useState(0)
  const [comissaoGeradaAnt, setComissaoGeradaAnt] = useState(0)
  const [qtdApolices, setQtdApolices] = useState(0)
  const [recebimentos, setRecebimentos] = useState([])
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const mesAntDate = new Date(ano, mes - 2, 1)
    const [inicioAnt, fimAnt] = rangeMes(mesAntDate.getFullYear(), mesAntDate.getMonth() + 1)
    const fimProjecao = addMeses(mesRef, PROJECAO_MESES)

    Promise.all([
      fetchComissaoGerada({ inicio, fim }),
      fetchComissaoGerada({ inicio: inicioAnt, fim: fimAnt }),
      fetchApolicesEmitidasCount({ inicio, fim }),
      fetchRecebimentos({ inicio: mesRef, fim: fimProjecao }),
    ]).then(([cg, cgAnt, qa, rec]) => {
      if (!mounted) return
      setComissaoGerada(cg)
      setComissaoGeradaAnt(cgAnt)
      setQtdApolices(qa)
      setRecebimentos(rec)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [inicio, fim, mesRef, ano, mes])

  const projecao = useMemo(
    () => projetarProximosMeses(recebimentos, { mesesAFrente: PROJECAO_MESES, referencia: mesRef }),
    [recebimentos, mesRef],
  )
  const recebidaMes = projecao.length ? projecao[0].total : 0
  const totalProjetado = useMemo(() => projecao.reduce((s, p) => s + p.total, 0), [projecao])
  const variacao = comissaoGeradaAnt > 0
    ? Math.round(((comissaoGerada - comissaoGeradaAnt) / comissaoGeradaAnt) * 100)
    : null
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Visão Geral"
        title="Comissão do Seguro Fiança"
        description="Comissão gerada no mês e a estimativa de recebimento, rateada pela quantidade de parcelas de cada apólice."
        stats={(
          <>
            <MetricCard
              label="Comissão Gerada"
              value={formatMoneyBR(comissaoGerada)}
              hint={variacao != null ? `${mesLabel} · ${variacao >= 0 ? '+' : ''}${variacao}% vs mês ant.` : `emitidas em ${mesLabel}`}
              tone="secondary"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Recebida Estimada"
              value={formatMoneyBR(recebidaMes)}
              hint={`a receber em ${mesLabel}`}
              tone="accent"
              icon={<Coins className="h-4 w-4" />}
            />
            <MetricCard
              label="Apólices"
              value={qtdApolices}
              hint="emitidas no período"
              tone="success"
              icon={<FileText className="h-4 w-4" />}
            />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês de referência">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2]
              .map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
          <div className="flex flex-wrap items-center gap-1">
            {MESES_ABBR.map((label, i) => (
              <button
                key={label}
                onClick={() => setMes(i + 1)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      <DataCard
        title="Agenda de recebimentos"
        subtitle={`Projeção dos próximos ${PROJECAO_MESES} meses · total ${formatMoneyBR(totalProjetado)}. Cada comissão é dividida conforme as parcelas da apólice.`}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : projecao.every(p => p.total === 0) ? (
          <EmptyState
            title="Sem recebimentos projetados"
            description="Nenhuma parcela de comissão cai nos próximos meses a partir do período selecionado."
            icon={<CalendarClock className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-2">
            {projecao.map(p => (
              <div key={p.mes} className="flex items-center justify-between gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-dark-text">{p.label}</p>
                  <p className="text-xs text-dark-muted">{p.parcelas} parcela{p.parcelas !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(p.total)}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  )
}
