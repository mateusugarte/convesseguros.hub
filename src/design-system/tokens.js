// ── Conves Hub — Design Tokens ────────────────────────────────────────────────
// Single source of truth for programmatic use (Recharts, inline styles, etc.)
// CSS variables in index.css are the runtime counterpart for Tailwind/JSX.

export const BRAND = {
  primary:   '#F5582A',
  secondary: '#2B5BA8',
  accent:    '#FF8B5F',
  gold:      '#C9A84C',
}

// Semantic status colors — light/dark variants
export const STATUS = {
  success: { light: '#059669', dark: '#10B981' },
  warning: { light: '#D97706', dark: '#F59E0B' },
  danger:  { light: '#DC2626', dark: '#EF4444' },
  info:    { light: '#1D4ED8', dark: '#3B82F6' },
  muted:   { light: '#6B7280', dark: '#8899BB' },
  purple:  { light: '#7C3AED', dark: '#8B5CF6' },
}

// Chart palette — ordered for sequential data series
export const CHART_COLORS = [
  '#F5582A', // brand-primary
  '#10B981', // success
  '#F97316', // warning
  '#8B5CF6', // purple
  '#2B5BA8', // brand-secondary
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#EF4444', // danger
  '#6B7280', // muted
]

// Status → color map (for Kanban columns, charts, badges)
export const STATUS_COLORS = {
  pendente:     '#F97316',
  em_cotacao:   '#3B82F6',
  em_analise:   '#F5582A',
  aprovado:     '#10B981',
  recusado:     '#EF4444',
  emitido:      '#2B5BA8',
  cancelado:    '#6B7280',
  cpf_invalido: '#F97316',
  expirada:     '#6B7280',
}

// Produto → color map
export const PRODUTO_COLORS = {
  residencial_pf:  { color: '#F5582A', bg: 'rgba(245,88,42,0.15)'  },
  comercial_pf:    { color: '#10B981', bg: 'rgba(16,185,129,0.15)'  },
  pessoa_juridica: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
}

// z-index scale — defines all stacking layers
export const Z = {
  base:     0,
  dropdown: 300,
  modal:    400,
  toast:    500,
}

// Border radius scale
export const RADIUS = {
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
  full: '9999px',
}
