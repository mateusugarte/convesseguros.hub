import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import CalendarioAno from './CalendarioAno'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import { fetchProducaoLedger, fetchRecebimentos } from '../../lib/financeiro'
import { montarCalendarioAno, rankingImobiliarias } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, TrendingUp, FileText, Building2 } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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
    Promise.all([
      fetchProducaoLedger({ inicio, fim }),
      fetchRecebimentos({ inicio, fim }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, rec, cat]) => {
      if (!mounted) return
      setLedger(led)
      setRecebimentos(rec)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [ano])

  const cells = useMemo(
    () => montarCalendarioAno({ ano, ledgerRows: ledger, recebimentoRows: recebimentos }),
    [ano, ledger, recebimentos],
  )
  const cell = cells[mes - 1] || { producao: 0, comissaoGerada: 0, recebidaEstimada: 0, qtd: 0 }

  const ranking = useMemo(() => {
    const doMes = ledger.filter(r => {
      const d = parseYmd(r.data_emissao)
      return d && d.getFullYear() === ano && d.getMonth() + 1 === mes
    })
    return rankingImobiliarias(doMes)
  }, [ledger, ano, mes])

  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Dashboard"
        title="Visão geral do Seguro Fiança"
        description="Produção é a soma do prêmio total das apólices emitidas. Selecione o mês no calendário."
        stats={(
          <>
            <MetricCard label="Produção" value={formatMoneyBR(cell.producao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão Gerada" value={formatMoneyBR(cell.comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Recebida Estimada" value={formatMoneyBR(cell.recebidaEstimada)} hint={`a receber em ${mesLabel}`} tone="warning" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={cell.qtd} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Calendário"
        subtitle="Produção por mês — clique para selecionar"
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
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <CalendarioAno cells={cells} mesSelecionado={mes} onSelectMes={setMes} />
        )}
      </DataCard>

      <DataCard title={`Ranking de imobiliárias — ${mesLabel}`} subtitle="Por produção (prêmio total) no mês">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : ranking.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no mês selecionado." icon={<Building2 className="h-6 w-6" />} />
        ) : (
          <div className="space-y-2">
            {ranking.map((item, i) => {
              const meta = resolveImobiliaria(catalogo, item.imobiliaria)
              return (
                <button
                  key={item.imobiliaria}
                  onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3 text-left transition-colors hover:border-dark-border"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-dark-muted">{i + 1}</span>
                    <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(item.premioTotal)}</p>
                    <p className="text-[11px] text-dark-muted">{item.qtd} apólice{item.qtd !== 1 ? 's' : ''}</p>
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
