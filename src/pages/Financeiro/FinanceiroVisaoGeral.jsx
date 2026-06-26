import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import CalendarioAno from './CalendarioAno'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBarChart from '../../components/financeiro/SeguradoraBarChart'
import { fetchProducaoLedger, fetchRecebimentos } from '../../lib/financeiro'
import { montarCalendarioAno, rankingImobiliarias, agruparPorSeguradora } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, TrendingUp, FileText, Building2, ArrowRight } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MEDALHA = ['text-amber-400', 'text-slate-300', 'text-orange-400']

function KpiCard({ label, value, hint, icon, accent = false, color = 'brand-secondary' }) {
  const colorMap = {
    'brand-secondary': { bg: 'bg-brand-secondary/10', text: 'text-brand-secondary', border: 'border-brand-secondary/20' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    sky: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  }
  const c = colorMap[color] || colorMap['brand-secondary']
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-dark-surface2/50 p-5 ${accent ? c.border : 'border-dark-border/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-dark-muted">{label}</p>
          <p className="truncate text-2xl font-bold text-dark-text">{value}</p>
          {hint && <p className="mt-1 text-xs text-dark-muted">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
          {icon}
        </div>
      </div>
      {accent && <div className={`absolute bottom-0 left-0 h-0.5 w-full ${c.bg}`} />}
    </div>
  )
}

export default function FinanceiroVisaoGeral() {
  const navigate = useNavigate()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [ledger, setLedger] = useState([])
  const [recebimentos, setRecebimentos] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const inicio = `${ano}-01-01`
    const fim = `${ano}-12-31`
    Promise.allSettled([
      fetchProducaoLedger({ inicio, fim }),
      fetchRecebimentos({ inicio, fim }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, rec, cat]) => {
      if (!mounted) return
      setLedger(led.status === 'fulfilled' ? led.value : [])
      setRecebimentos(rec.status === 'fulfilled' ? rec.value : [])
      setCatalogo(cat.status === 'fulfilled' ? cat.value : null)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [ano])

  const cells = useMemo(
    () => montarCalendarioAno({ ano, ledgerRows: ledger, recebimentoRows: recebimentos }),
    [ano, ledger, recebimentos],
  )
  const cell = cells[mes - 1] || { producao: 0, comissaoGerada: 0, recebidaEstimada: 0, qtd: 0 }

  const rowsDoMes = useMemo(() => ledger.filter(r => {
    const d = parseYmd(r.data_emissao)
    return d && d.getFullYear() === ano && d.getMonth() + 1 === mes
  }), [ledger, ano, mes])

  const ranking = useMemo(() => rankingImobiliarias(rowsDoMes), [rowsDoMes])

  const porSeguradora = useMemo(() => agruparPorSeguradora(rowsDoMes), [rowsDoMes])
  const producaoSeguradora = useMemo(
    () => porSeguradora.map(s => ({ seguradora: s.seguradora, value: s.premio, qtd: s.qtd })),
    [porSeguradora],
  )
  const comissaoSeguradora = useMemo(
    () => porSeguradora.map(s => ({ seguradora: s.seguradora, value: s.comissao })),
    [porSeguradora],
  )

  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`
  const maxRanking = ranking[0]?.premioTotal || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-dark-muted">Financeiro · Dashboard</p>
        <h1 className="text-2xl font-bold text-dark-text">Visão geral do Seguro Fiança</h1>
        <p className="mt-1 text-sm text-dark-muted">
          Selecione o mês no calendário para ver os indicadores do período.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Produção do mês"
          value={formatMoneyBR(cell.producao)}
          hint={mesLabel}
          icon={<Coins className="h-5 w-5" />}
          color="brand-secondary"
          accent
        />
        <KpiCard
          label="Comissão gerada"
          value={formatMoneyBR(cell.comissaoGerada)}
          hint={mesLabel}
          icon={<TrendingUp className="h-5 w-5" />}
          color="emerald"
          accent
        />
        <KpiCard
          label="Recebida estimada"
          value={formatMoneyBR(cell.recebidaEstimada)}
          hint={`a receber em ${mesLabel}`}
          icon={<Coins className="h-5 w-5" />}
          color="amber"
          accent
        />
        <KpiCard
          label="Apólices emitidas"
          value={cell.qtd}
          hint={mesLabel}
          icon={<FileText className="h-5 w-5" />}
          color="sky"
          accent
        />
      </div>

      {/* Calendário anual */}
      <DataCard
        title="Calendário anual"
        subtitle="Produção por mês — clique para selecionar o período"
        actions={(
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
        )}
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <CalendarioAno cells={cells} mesSelecionado={mes} onSelectMes={setMes} />
        )}
      </DataCard>

      {/* Gráficos lado a lado */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard
          title="Produção por seguradora"
          subtitle={`Prêmio total emitido — ${mesLabel}`}
        >
          {loading ? (
            <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <div className="pt-1">
              <SeguradoraBarChart
                data={producaoSeguradora}
                color="bg-brand-secondary"
                emptyLabel="Sem produção no mês"
                height={280}
              />
            </div>
          )}
        </DataCard>
        <DataCard
          title="Comissão por seguradora"
          subtitle={`Comissão total gerada — ${mesLabel}`}
        >
          {loading ? (
            <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <div className="pt-1">
              <SeguradoraBarChart
                data={comissaoSeguradora}
                color="bg-emerald-500"
                emptyLabel="Sem comissão no mês"
                height={280}
              />
            </div>
          )}
        </DataCard>
      </div>

      {/* Ranking de imobiliárias */}
      <DataCard
        title={`Ranking de imobiliárias — ${mesLabel}`}
        subtitle="Por produção (prêmio total) no período selecionado"
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
        ) : ranking.length === 0 ? (
          <EmptyState
            title="Sem produção no mês"
            description="Nenhuma apólice emitida no mês selecionado."
            icon={<Building2 className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-2">
            {ranking.map((item, i) => {
              const meta = resolveImobiliaria(catalogo, item.imobiliaria)
              const pct = maxRanking > 0 ? Math.max(6, Math.round((item.premioTotal / maxRanking) * 100)) : 0
              return (
                <button
                  key={item.imobiliaria}
                  onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)}
                  className="group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3 text-left transition-colors hover:border-dark-border"
                >
                  <div className="absolute inset-y-0 left-0 bg-brand-secondary/8 transition-all group-hover:bg-brand-secondary/12" style={{ width: `${pct}%` }} />
                  <div className="relative flex min-w-0 items-center gap-3">
                    <span className={`w-6 shrink-0 text-center text-sm font-bold ${MEDALHA[i] || 'text-dark-muted'}`}>{i + 1}</span>
                    <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                  </div>
                  <div className="relative flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(item.premioTotal)}</p>
                      <p className="text-[11px] text-dark-muted">{item.qtd} apólice{item.qtd !== 1 ? 's' : ''}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-dark-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </DataCard>
    </div>
  )
}
