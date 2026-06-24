import { useEffect, useMemo, useState } from 'react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../components/ui'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { fetchFinanceiroComissoes, formatMoneyBR, toNumber } from '../lib/apolices'
import { Coins, ShieldCheck, FileText, TrendingUp } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad2(value) {
  return String(value).padStart(2, '0')
}

function toLocalYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function getRange(ano, mes) {
  return [
    toLocalYmd(new Date(ano, mes - 1, 1)),
    toLocalYmd(new Date(ano, mes, 0)),
  ]
}

function getParcelas(item) {
  const parcelas = Number(toNumber(item.parcelamento))
  return Number.isFinite(parcelas) && parcelas > 0 ? parcelas : 1
}

function getComissaoMensal(item) {
  const comissaoMensal = toNumber(item.comissao_mensal)
  if (comissaoMensal !== null) return comissaoMensal
  const comissaoTotal = toNumber(item.valor_comissao) || 0
  return comissaoTotal / getParcelas(item)
}

function groupBySeguradora(items) {
  const map = new Map()
  items.forEach(item => {
    const key = item.seguradora || 'Sem seguradora'
    const current = map.get(key) || { seguradora: key, producao: 0, comissaoMensal: 0, apolices: 0 }
    current.producao += toNumber(item.premio_total ?? item.valor_producao) || 0
    current.comissaoMensal += getComissaoMensal(item)
    current.apolices += 1
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => b.producao - a.producao)
}

export default function Financeiro() {
  const { profile } = useAuth()
  const agora = new Date()

  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [seguradora, setSeguradora] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => getRange(ano, mes), [ano, mes])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchFinanceiroComissoes({ inicio, fim, seguradora }).then(data => {
      if (!mounted) return
      setRows(data)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [inicio, fim, seguradora])

  const agrupado = useMemo(() => groupBySeguradora(rows), [rows])
  const totalProducao = useMemo(() => rows.reduce((sum, item) => sum + (toNumber(item.premio_total ?? item.valor_producao) || 0), 0), [rows])
  const totalComissaoMensal = useMemo(() => rows.reduce((sum, item) => sum + getComissaoMensal(item), 0), [rows])
  const totalApolices = rows.length
  const ticketMedio = totalApolices ? totalProducao / totalApolices : 0
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  if (!profile?.is_admin) {
    return (
      <DataCard title="Acesso restrito">
        <EmptyState
          title="Área financeira restrita"
          description="Somente perfis marcados como admin conseguem visualizar comissões e produção."
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </DataCard>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Financeiro"
        title="Seguro Fiança"
        description="Leitura financeira do setor de seguro fiança. A comissão é reconhecida mês a mês e rateada pela quantidade de parcelas de cada apólice."
        stats={(
          <>
            <MetricCard label="Produção" value={formatMoneyBR(totalProducao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão do mês" value={formatMoneyBR(totalComissaoMensal)} hint="seguro fiança rateado por parcelas" tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={totalApolices} hint="emitidas no período" tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Ticket médio" value={formatMoneyBR(ticketMedio)} hint="produção por apólice" tone="warning" icon={<Coins className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês que deseja auditar">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
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
          <Select
            value={seguradora}
            onChange={setSeguradora}
            options={[
              { value: '', label: 'Todas as seguradoras' },
              ...[...new Set(rows.map(r => r.seguradora).filter(Boolean))].map(nome => ({ value: nome, label: nome })),
            ]}
            className="min-w-[220px]"
          />
        </div>
      </DataCard>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <DataCard title="Produção por seguradora" subtitle="Valor total de produção capturado no período">
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : agrupado.length === 0 ? (
            <EmptyState
              title="Sem produção no período"
              description="Nenhuma apólice emitida foi encontrada para os filtros selecionados."
              icon={<Coins className="h-6 w-6" />}
            />
          ) : (
            <div className="space-y-3">
              {agrupado.map(item => (
                <div key={item.seguradora} className="rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-dark-text">{item.seguradora}</p>
                      <p className="text-xs text-dark-muted">{item.apolices} apólice{item.apolices !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(item.producao)}</p>
                      <p className="text-xs text-dark-muted">Comissão do mês {formatMoneyBR(item.comissaoMensal)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataCard>

        <DataCard title="Últimas emissões" subtitle="Snapshot financeiro das apólices emitidas">
          {loading ? (
            <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Sem registros"
              description="As apólices emitidas aparecerão aqui após o preenchimento da produção e do rateio mensal da comissão."
              icon={<FileText className="h-6 w-6" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-table text-sm">
                <thead className="table-thead">
                  <tr>
                    {['Emissão', 'Seguradora', 'Apólice', 'Parcelas', 'Produção', 'Comissão do mês', '% Comissão'].map(h => (
                      <th key={h} className="th whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {rows.map(row => (
                    <tr key={row.apolice_id}>
                      <td className="td text-xs text-dark-muted whitespace-nowrap">{String(row.data_emissao).slice(0, 10)}</td>
                      <td className="td max-w-[160px] truncate">{row.seguradora || '—'}</td>
                      <td className="td font-mono text-xs text-dark-muted">{row.numero_apolice || '—'}</td>
                      <td className="td font-mono text-xs">{getParcelas(row)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(row.premio_total ?? row.valor_producao)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(getComissaoMensal(row))}</td>
                      <td className="td font-mono text-xs">{row.pct_comissao != null ? `${row.pct_comissao}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      </div>
    </div>
  )
}
