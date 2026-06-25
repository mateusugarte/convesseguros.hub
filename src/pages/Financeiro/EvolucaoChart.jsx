import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoneyBR } from '../../lib/apolices'

const COR = '#2B5BA8'

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-dark-text">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-dark-muted">{p.name}: {formatMoneyBR(p.value)}</p>
      ))}
    </div>
  )
}

export default function EvolucaoChart({ data }) {
  if (!data?.length || data.every(d => d.comissao === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-dark-muted">Sem dados no período</div>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradComissaoProd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COR} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={42}
          tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip content={<Tip />} />
        <Area
          type="monotone"
          dataKey="comissao"
          name="Comissão gerada"
          stroke={COR}
          fill="url(#gradComissaoProd)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
