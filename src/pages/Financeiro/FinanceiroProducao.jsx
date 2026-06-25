import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import EvolucaoChart from './EvolucaoChart'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria, fetchImobiliariasDistintas,
} from '../../lib/financeiro'
import { agruparPorSeguradora, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { Building2, Coins, TrendingUp, FileText, Percent, Shield } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const { user } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [opcoes, setOpcoes] = useState([])
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [pct, setPct] = useState('')
  const [pctSalvo, setPctSalvo] = useState(null)
  const [loading, setLoading] = useState(false)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  // Opções do seletor + catálogo (uma vez)
  useEffect(() => {
    let mounted = true
    Promise.all([fetchImobiliariasDistintas(), fetchImobiliariasCatalogMap()])
      .then(([nomes, cat]) => {
        if (!mounted) return
        setOpcoes(nomes)
        setCatalogo(cat)
      }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Dados da imobiliária selecionada
  useEffect(() => {
    if (!selecionada) { setRows([]); setEvolucaoRows([]); return }
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.allSettled([
      fetchProducaoLedger({ inicio, fim, imobiliaria: selecionada }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim, imobiliaria: selecionada }),
      fetchPctImobiliarias({ mes: mesRef }),
    ]).then(([prod, evol, pctMap]) => {
      if (!mounted) return
      setRows(prod.status === 'fulfilled' ? prod.value : [])
      setEvolucaoRows(evol.status === 'fulfilled' ? evol.value : [])
      const pctMapValue = pctMap.status === 'fulfilled' ? pctMap.value : {}
      const salvo = pctMapValue[selecionada]
      setPctSalvo(salvo ?? null)
      const meta = resolveImobiliaria(catalogo, selecionada)
      setPct(salvo != null ? String(salvo) : (meta?.pctComissao != null ? String(meta.pctComissao) : ''))
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, inicio, fim, mesRef, catalogo])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const producao = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissaoGerada = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const valorRepassar = (() => {
    const p = parseDecimalBR(pct)
    return p != null ? (p / 100) * comissaoGerada : 0
  })()
  const meta = resolveImobiliaria(catalogo, selecionada)
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  async function salvarPct() {
    const p = parseDecimalBR(pct)
    if (p === pctSalvo) return
    const err = await salvarPctImobiliaria({ imobiliaria: selecionada, mes: mesRef, pct: p, userId: user?.id })
    if (!err) setPctSalvo(p)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Produção"
        title="Produção por imobiliária"
        description="Selecione a imobiliária e o mês. Produção é a soma do prêmio total dos seguros emitidos."
        actions={selecionada ? (<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />) : null}
      />

      <DataCard title="Seleção" subtitle="Imobiliária e mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selecionada}
            onChange={v => navigate(v ? `/financeiro/producao/${encodeURIComponent(v)}` : '/financeiro/producao')}
            options={[{ value: '', label: 'Selecione a imobiliária...' }, ...opcoes.map(n => ({ value: n, label: n }))]}
            className="min-w-[260px]"
          />
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

      {!selecionada ? (
        <DataCard title="Produção">
          <EmptyState title="Selecione uma imobiliária" description="Escolha uma imobiliária no seletor acima para ver a produção do mês." icon={<Building2 className="h-6 w-6" />} />
        </DataCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Produção" value={formatMoneyBR(producao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão gerada" value={formatMoneyBR(comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={rows.length} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="A repassar" value={formatMoneyBR(valorRepassar)} hint="% × comissão gerada" tone="warning" icon={<Percent className="h-4 w-4" />} />
          </div>

          <DataCard title="Repasse da imobiliária" subtitle="Percentual sobre a comissão gerada, salvo para o mês">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <input
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  onBlur={salvarPct}
                  inputMode="decimal"
                  className="w-20 rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1.5 text-right text-sm text-dark-text focus:border-brand-secondary focus:outline-none"
                  placeholder="0"
                />
                <Percent className="h-4 w-4 text-dark-muted" />
              </div>
              <span className="text-sm text-dark-muted">→ a repassar</span>
              <span className="text-sm font-semibold text-emerald-400">{formatMoneyBR(valorRepassar)}</span>
            </div>
          </DataCard>

          <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`}>
            <EvolucaoChart data={evolucao} />
          </DataCard>

          <DataCard title="Por seguradora" subtitle="Quebra da produção do mês por seguradora">
            {loading ? (
              <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
            ) : seguradoras.length === 0 ? (
              <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no período para esta imobiliária." icon={<Shield className="h-6 w-6" />} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-table text-sm">
                  <thead className="table-thead">
                    <tr>
                      {['Seguradora', 'Apólices', 'Prêmio', 'Comissão', 'Participação'].map(h => (
                        <th key={h} className="th whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {seguradoras.map(item => (
                      <tr key={item.seguradora}>
                        <td className="td"><SeguradoraBadge nome={item.seguradora} size="md" /></td>
                        <td className="td font-mono text-xs">{item.qtd}</td>
                        <td className="td font-mono text-xs">{formatMoneyBR(item.premio)}</td>
                        <td className="td font-mono text-xs">{formatMoneyBR(item.comissao)}</td>
                        <td className="td font-mono text-xs">{item.pctParticipacao}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      )}
    </div>
  )
}
