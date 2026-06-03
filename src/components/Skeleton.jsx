// Shared skeleton components — all use CSS animate-pulse, no spinners

export function KanbanSkeleton() {
  const counts = [3, 2, 3, 1, 2, 1, 1]
  return (
    <div className="flex gap-2 overflow-hidden">
      {counts.map((n, i) => (
        <div key={i} className="flex-shrink-0 w-[224px]">
          <div className="h-9 rounded-t-xl bg-dark-border/40 animate-pulse" />
          <div
            className="rounded-b-xl border border-dark-border p-2 space-y-2"
            style={{ height: 'calc(100vh - 330px)', background: 'rgb(var(--color-surface2) / 0.4)' }}
          >
            {Array.from({ length: n }).map((_, j) => (
              <div key={j} className="h-[88px] rounded-xl bg-dark-border/40 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 7, cols = 5 }) {
  return (
    <div className="p-4 space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3.5 border-b border-dark-border/40">
          <div className="w-16 h-3 rounded bg-dark-border/40 animate-pulse" />
          <div className="w-28 h-3 rounded bg-dark-border/40 animate-pulse" />
          <div className="flex-1 h-3 rounded bg-dark-border/40 animate-pulse" />
          {cols > 3 && <div className="w-20 h-3 rounded bg-dark-border/40 animate-pulse" />}
          {cols > 4 && <div className="w-16 h-5 rounded-full bg-dark-border/40 animate-pulse" />}
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 bg-dark-border/40 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="h-3 w-24 bg-dark-border/40 rounded animate-pulse" />
            <div className="h-8 w-16 bg-dark-border/40 rounded animate-pulse" />
            <div className="h-2 w-32 bg-dark-border/30 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card h-56 bg-dark-border/20 animate-pulse" />
        <div className="card h-56 bg-dark-border/20 animate-pulse" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-5" style={{ minHeight: '100vh' }}>
      <div className="h-7 w-44 bg-dark-border/40 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-24 bg-dark-border/20 animate-pulse" />
        ))}
      </div>
      <div className="card h-64 bg-dark-border/20 animate-pulse" />
    </div>
  )
}
