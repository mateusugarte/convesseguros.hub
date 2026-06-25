import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import EvolucaoChart from './EvolucaoChart'
import { useAuth } from '../../contexts/AuthContext'
import { fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria } from '../../lib/financeiro'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { agruparPorImobiliaria, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { Building2, Coins, TrendingUp, Percent } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [pctMap, setPctMap] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.all([
      fetchProducaoLedger({ inicio, fim }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim }),
      fetchPctImobiliarias({ mes: mesRef }),
      fetchImobiliariasCatalogMap(),
    ]).then(([prod, evol, pct, cat]) => {
      if (!mounted) return
      setRows(prod)
      setEvolucaoRows(evol)
      setPctMap(pct)
      setCatalogo(cat)
      setEdits({})
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [inicio, fim, mesRef])

  const imobiliarias = useMemo(() => agruparPorImobiliaria(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const totalComissaoGerada = useMemo(() => imobiliarias.reduce((s, i) => s + i.comissaoGerada, 0), [imobiliarias])
  const totalPremio = useMemo(() => imobiliarias.reduce((s, i) => s + i.premioTotal, 0), [imobiliarias])

  function pctAtual(imob) {
    if (edits[imob] !== undefined) return edits[imob]
    if (pctMap[imob] !== undefined && pctMap[imob] !== null) return String(pctMap[imob])
    const meta = resolveImobiliaria(catalogo, imob)
    return meta?.pctComissao != null ? String(meta.pctComissao) : ''
  }

  function valorRepassar(imob, comissaoGerada) {
    const pct = parseDecimalBR(pctAtual(imob))
    return pct ? (pct / 100) * comissaoGerada : 0
  }

  async function salvarPct(imob) {
    const raw = edits[imob]
    if (raw === undefined) return
    const pct = parseDecimalBR(raw)
    const err = await salvarPctImobiliaria({ imobiliaria: imob, mes: mesRef, pct, userId: user?.id })
    if (!err) setPctMap(prev => ({ ...prev, [imob]: pct }))
  }

  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Produção"
        title="Produção por imobiliária"
        description="Produção emitida no mês por imobiliária, com o percentual de repasse aplicado sobre a comissão gerada."
        stats={(
          <>
            <MetricCard label="Comissão Gerada" value={formatMoneyBR(totalComissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Prêmio Total" value={formatMoneyBR(totalPremio)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Imobiliárias" value={imobiliarias.length} hint="com produção no mês" tone="success" icon={<Building2 className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
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
      </DataCard>

      <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`}>
        <EvolucaoChart data={evolucao} />
      </DataCard>

      <DataCard title="Imobiliárias" subtitle="Clique para ver o detalhe por seguradora">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : imobiliarias.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no período selecionado." icon={<Building2 className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Apólices', 'Prêmio', 'Comissão gerada', 'Recebida estimada', '% repasse', 'A repassar'].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {imobiliarias.map(item => {
                  const meta = resolveImobiliaria(catalogo, item.imobiliaria)
                  return (
                    <tr key={item.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)} className="text-left">
                          <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{item.qtd}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.premioTotal)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.comissaoGerada)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.comissaoRecebidaEstimada)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <input
                            value={pctAtual(item.imobiliaria)}
                            onChange={e => setEdits(prev => ({ ...prev, [item.imobiliaria]: e.target.value }))}
                            onBlur={() => salvarPct(item.imobiliaria)}
                            inputMode="decimal"
                            className="w-16 rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1 text-right text-xs text-dark-text focus:border-brand-secondary focus:outline-none"
                            placeholder="0"
                          />
                          <Percent className="h-3 w-3 text-dark-muted" />
                        </div>
                      </td>
                      <td className="td font-mono text-xs font-semibold text-emerald-400">{formatMoneyBR(valorRepassar(item.imobiliaria, item.comissaoGerada))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  )
}
