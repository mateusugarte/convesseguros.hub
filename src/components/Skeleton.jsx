// Shared skeletons for the new CRM shell.

function Block({ className = '', style }) {
  return <div className={`skeleton-surface animate-pulse rounded-xl ${className}`} style={style} />
}

export function KanbanSkeleton() {
  const counts = [4, 3, 4, 2, 3, 2]

  return (
    <div className="kanban-scroll flex gap-4 overflow-x-auto pb-2">
      {counts.map((count, index) => (
        <div key={index} className="kanban-col">
          <div className="kanban-col-header mb-3">
            <div className="flex items-center justify-between gap-3">
              <Block className="h-3.5 w-24 rounded-full" />
              <Block className="h-6 w-8 rounded-full" />
            </div>
          </div>

          <div className="kanban-col-body space-y-3 pr-1">
            {Array.from({ length: count }).map((_, cardIndex) => (
              <div key={cardIndex} className="kanban-card rounded-2xl border border-dark-border/60 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <Block className="h-3 w-20 rounded-full" />
                    <Block className="h-4 w-full rounded-full" />
                    <Block className="h-3 w-4/5 rounded-full" />
                  </div>
                  <Block className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Block className="h-6 w-14 rounded-full" />
                  <div className="flex -space-x-2">
                    <Block className="h-7 w-7 rounded-full border border-white/60" />
                    <Block className="h-7 w-7 rounded-full border border-white/60" />
                    <Block className="h-7 w-7 rounded-full border border-white/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 7, cols = 5 }) {
  return (
    <div className="table-shell">
      <div className="table-shell-head">
        <div className="space-y-2">
          <Block className="h-3.5 w-24 rounded-full" />
          <Block className="h-5 w-40 rounded-full" />
        </div>
        <Block className="h-9 w-28 rounded-2xl" />
      </div>

      <div className="table-shell-body">
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid items-center gap-4 py-3 border-b border-dark-border/40" style={{ gridTemplateColumns: cols > 4 ? '1fr 1.2fr 1.4fr 0.8fr 0.7fr' : '0.9fr 1.2fr 1.6fr 0.8fr' }}>
              <Block className="h-3 w-16 rounded-full" />
              <Block className="h-3 w-full rounded-full" />
              <Block className="h-3 w-full rounded-full" />
              <Block className="h-3 w-24 rounded-full" />
              {cols > 4 && <Block className="h-6 w-16 rounded-full justify-self-end" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dashboard-hero">
        <div className="space-y-3">
          <Block className="h-3.5 w-28 rounded-full" />
          <Block className="h-9 w-80 rounded-full" />
          <Block className="h-4 w-[32rem] max-w-full rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Block className="h-8 w-20 rounded-full" />
          <Block className="h-8 w-24 rounded-full" />
          <Block className="h-8 w-28 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="metric-tile space-y-3">
            <Block className="h-3 w-24 rounded-full" />
            <Block className="h-8 w-16 rounded-full" />
            <Block className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel p-5 space-y-4">
          <Block className="h-4 w-36 rounded-full" />
          <Block className="h-64 w-full rounded-3xl" />
        </div>
        <div className="glass-panel p-5 space-y-4">
          <Block className="h-4 w-28 rounded-full" />
          <div className="space-y-3">
            <Block className="h-16 w-full rounded-2xl" />
            <Block className="h-16 w-full rounded-2xl" />
            <Block className="h-16 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" style={{ minHeight: '100vh' }}>
      <div className="dashboard-hero">
        <div className="space-y-3">
          <Block className="h-3.5 w-24 rounded-full" />
          <Block className="h-8 w-72 rounded-full" />
          <Block className="h-4 w-[28rem] max-w-full rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="metric-tile space-y-3">
            <Block className="h-3 w-20 rounded-full" />
            <Block className="h-7 w-14 rounded-full" />
            <Block className="h-3 w-24 rounded-full" />
          </div>
        ))}
      </div>

      <div className="table-shell">
        <div className="table-shell-head">
          <div className="space-y-2">
            <Block className="h-3 w-24 rounded-full" />
            <Block className="h-5 w-40 rounded-full" />
          </div>
          <Block className="h-9 w-28 rounded-2xl" />
        </div>
        <div className="table-shell-body">
          <Block className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  )
}
