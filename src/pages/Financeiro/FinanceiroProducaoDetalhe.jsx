import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import EvolucaoChart from './EvolucaoChart'
import { fetchProducaoLedger } from '../../lib/financeiro'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { agruparPorSeguradora, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Coins, TrendingUp, FileText, Shield } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducaoDetalhe() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const imobiliaria = decodeURIComponent(imobParam || '')
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.all([
      fetchProducaoLedger({ inicio, fim, imobiliaria }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim, imobiliaria }),
      fetchImobiliariasCatalogMap(),
    ]).then(([prod, evol, cat]) => {
      if (!mounted) return
      setRows(prod)
      setEvolucaoRows(evol)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [inicio, fim, mesRef, imobiliaria])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const meta = resolveImobiliaria(catalogo, imobiliaria)
  const qtd = rows.length
  const premio = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissao = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/financeiro/producao')} className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-muted hover:text-dark-text">
        <ArrowLeft className="h-4 w-4" /> Voltar para Produção
      </button>

      <PageHeader
        eyebrow="Financeiro · Produção"
        title={meta?.nomeCanonico || imobiliaria}
        description={`Produção emitida em ${mesLabel}, detalhada por seguradora.`}
        actions={(<ImobiliariaIdentity nome={imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />)}
        stats={(
          <>
            <MetricCard label="Apólices" value={qtd} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Prêmio" value={formatMoneyBR(premio)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão gerada" value={formatMoneyBR(comissao)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
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

      <DataCard title="Evolução" subtitle={`Comissão gerada da imobiliária nos últimos ${EVOLUCAO_MESES} meses`}>
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
    </div>
  )
}
