const AVATAR_COLORS = ['#4A90D9', '#10B981', '#F59E0B', '#8B5CF6', '#2B5BA8', '#EC4899', '#06B6D4', '#EF4444']

function initials(name) {
  return (name || '?')
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function avatarColor(name) {
  return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length]
}

export default function CrmAvatarBadge({ name, subtitle, size = 'md' }) {
  const avatarSize = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm'

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-2xl font-bold text-white ${avatarSize}`}
        style={{ background: avatarColor(name) }}
      >
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-dark-text">{name || 'Sem nome'}</p>
        {subtitle && <p className="truncate text-xs text-dark-muted">{subtitle}</p>}
      </div>
    </div>
  )
}
