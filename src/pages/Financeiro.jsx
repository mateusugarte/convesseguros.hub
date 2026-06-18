import { useEffect, useMemo, useState } from 'react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../components/ui'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import { fetchFinanceiroComissoes, formatMoneyBR } from '../lib/apolices'
import { Coins, ShieldCheck, FileText, TrendingUp } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getRange(ano, mes) {
  return [
    new Date(ano, mes - 1, 1).toISOString(),
    new Date(ano, mes, 0, 23, 59, 59).toISOString(),
  ]
}

function groupBySeguradora(items) {
  const map = new Map()
  items.forEach(item => {
    const key = item.seguradora || 'Sem seguradora'
    const current = map.get(key) || { seguradora: key, producao: 0, comissao: 0, apolices: 0 }
    current.producao += Number(item.valor_producao) || 0
    current.comissao += Number(item.valor_comissao) || 0
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
  const totalProducao = useMemo(() => rows.reduce((sum, item) => sum + (Number(item.valor_producao) || 0), 0), [rows])
  const totalComissao = useMemo(() => rows.reduce((sum, item) => sum + (Number(item.valor_comissao) || 0), 0), [rows])
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
        title="Comissionamento"
        description="Leitura financeira das apólices emitidas. A produção entra pelo prêmio total e a comissão é calculada sobre o prêmio líquido."
        stats={(
          <>
            <MetricCard label="Produção" value={formatMoneyBR(totalProducao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão" value={formatMoneyBR(totalComissao)} hint="sobre prêmio líquido" tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
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
                      <p className="text-xs text-dark-muted">Comissão {formatMoneyBR(item.comissao)}</p>
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
              description="As apólices emitidas aparecerão aqui após o preenchimento do prêmio líquido e da comissão."
              icon={<FileText className="h-6 w-6" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-table text-sm">
                <thead className="table-thead">
                  <tr>
                    {['Emissão', 'Seguradora', 'Apólice', 'Produção', 'Comissão', '% Comissão'].map(h => (
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
                      <td className="td font-mono text-xs">{formatMoneyBR(row.valor_producao)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(row.valor_comissao)}</td>
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
