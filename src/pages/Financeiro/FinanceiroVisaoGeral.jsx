import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import CalendarioAno from './CalendarioAno'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import RegisteredSeguradorasStrip from '../../components/financeiro/RegisteredSeguradorasStrip'
import SeguradoraBarChart from '../../components/financeiro/SeguradoraBarChart'
import { fetchProducaoLedger, fetchRecebimentos } from '../../lib/financeiro'
import { montarCalendarioAno, rankingImobiliarias, agruparPorSeguradora } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, TrendingUp, FileText, Building2, ArrowRight } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MEDALHA = ['text-amber-500', 'text-slate-400', 'text-orange-500']

function KpiCard({ label, value, hint, icon, accent = false, color = 'brand-secondary' }) {
  const colorMap = {
    'brand-secondary': { bg: 'bg-emerald-500/12', text: 'text-emerald-700', border: 'border-emerald-500/20' },
    emerald: { bg: 'bg-emerald-500/12', text: 'text-emerald-700', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/12', text: 'text-amber-600', border: 'border-amber-500/20' },
    sky: { bg: 'bg-sky-500/12', text: 'text-sky-600', border: 'border-sky-500/20' },
  }
  const c = colorMap[color] || colorMap['brand-secondary']
  return (
    <div className={`relative overflow-hidden rounded-[26px] border bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88))] p-5 shadow-[0_20px_50px_-36px_rgba(16,185,129,0.5)] ${accent ? c.border : 'border-emerald-500/12'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-dark-muted">{label}</p>
          <p className="truncate text-2xl font-bold text-dark-text">{value}</p>
          {hint && <p className="mt-1 text-xs text-dark-muted">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${c.bg} ${c.text} ${c.border}`}>
          {icon}
        </div>
      </div>
      {accent && <div className={`absolute bottom-0 left-0 h-1 w-full ${c.bg}`} />}
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
      <section className="overflow-hidden rounded-[32px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.92))] px-6 py-6 shadow-[0_28px_72px_-44px_rgba(16,185,129,0.5)]">
        <p className="mb-1 inline-flex rounded-full border border-emerald-500/15 bg-dark-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Financeiro · Produção</p>
        <h1 className="text-3xl font-bold text-dark-text">Visão geral do Seguro Fiança</h1>
        <p className="mt-2 max-w-2xl text-sm text-dark-muted">
          Leia produção, comissão, recebimento estimado e o ranking consolidado do mês com uma visualização mais clara das imobiliárias e seguradoras ativas.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Produção do mês" value={formatMoneyBR(cell.producao)} hint={mesLabel} icon={<Coins className="h-5 w-5" />} color="brand-secondary" accent />
        <KpiCard label="Comissão gerada" value={formatMoneyBR(cell.comissaoGerada)} hint={mesLabel} icon={<TrendingUp className="h-5 w-5" />} color="emerald" accent />
        <KpiCard label="Recebida estimada" value={formatMoneyBR(cell.recebidaEstimada)} hint={`a receber em ${mesLabel}`} icon={<Coins className="h-5 w-5" />} color="amber" accent />
        <KpiCard label="Apólices emitidas" value={cell.qtd} hint={mesLabel} icon={<FileText className="h-5 w-5" />} color="sky" accent />
      </div>

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
        className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,250,0.9))]"
      >
        {loading ? (
          <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <CalendarioAno cells={cells} mesSelecionado={mes} onSelectMes={setMes} />
        )}
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Produção por seguradora" subtitle={`Prêmio total emitido — ${mesLabel}`} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]">
          {loading ? (
            <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <div className="pt-1">
              <SeguradoraBarChart data={producaoSeguradora} color="bg-emerald-600" emptyLabel="Sem produção no mês" height={280} />
            </div>
          )}
        </DataCard>
        <DataCard title="Comissão por seguradora" subtitle={`Comissão total gerada — ${mesLabel}`} className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.9))]">
          {loading ? (
            <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
          ) : (
            <div className="pt-1">
              <SeguradoraBarChart data={comissaoSeguradora} color="bg-emerald-500" emptyLabel="Sem comissão no mês" height={280} />
            </div>
          )}
        </DataCard>
      </div>

      <DataCard title={`Ranking de imobiliárias — ${mesLabel}`} subtitle="Por produção no período selecionado" className="border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,253,244,0.88))]">
        {loading ? (
          <div className="py-16 text-center text-sm text-dark-muted">Carregando...</div>
        ) : ranking.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no mês selecionado." icon={<Building2 className="h-6 w-6" />} />
        ) : (
          <div className="space-y-2">
            {ranking.map((item, i) => {
              const meta = resolveImobiliaria(catalogo, item.imobiliaria)
              const pct = maxRanking > 0 ? Math.max(8, Math.round((item.premioTotal / maxRanking) * 100)) : 0
              return (
                <button
                  key={item.imobiliaria}
                  onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)}
                  className="group relative w-full overflow-hidden rounded-[24px] border border-emerald-500/15 bg-dark-surface/92 px-4 py-4 text-left shadow-[0_18px_48px_-36px_rgba(16,185,129,0.45)] transition-all hover:-translate-y-0.5 hover:border-emerald-500/30"
                >
                  <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.15),rgba(52,211,153,0.04))] transition-all" style={{ width: `${pct}%` }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`w-6 shrink-0 text-center text-sm font-bold ${MEDALHA[i] || 'text-dark-muted'}`}>{i + 1}</span>
                        <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                      </div>
                      <RegisteredSeguradorasStrip seguradoras={meta?.registeredSeguradoras} limit={4} />
                    </div>
                    <div className="relative flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(item.premioTotal)}</p>
                        <p className="text-[11px] text-dark-muted">{item.qtd} apólice{item.qtd !== 1 ? 's' : ''}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700/50 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
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
