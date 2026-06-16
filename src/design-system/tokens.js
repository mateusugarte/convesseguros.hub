// ── Conves Hub — Design Tokens ────────────────────────────────────────────────
// Single source of truth for programmatic use (Recharts, inline styles, etc.)
// CSS variables in index.css are the runtime counterpart for Tailwind/JSX.

export const BRAND = {
  primary:   '#000079',
  secondary: '#c3f0f2',
  accent:    '#dcffff',
  gold:      '#a2d6da',
}

export const PALETTE = [
  '#000079',
  '#001a7a',
  '#0d2d8f',
  '#2247aa',
  '#4b6cc2',
  '#86a4d8',
  '#c3f0f2',
  '#dcffff',
  '#7fbec4',
]

export const AVATAR_COLORS = [
  '#000079',
  '#2247aa',
  '#4b6cc2',
  '#86a4d8',
  '#c3f0f2',
  '#dcffff',
  '#7fbec4',
  '#001a7a',
]

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
  ...PALETTE,
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
  residencial_pf:  { color: '#000079', bg: 'rgba(0,0,121,0.14)'  },
  comercial_pf:    { color: '#2247aa', bg: 'rgba(34,71,170,0.14)'  },
  pessoa_juridica: { color: '#7fbec4', bg: 'rgba(127,190,196,0.16)' },
}

export const STATUS_CHART_COLORS = {
  aprovado: '#0f766e',
  recusado: '#8b1e4e',
  em_cotacao: '#4c67b0',
  pendente: '#000079',
  emitido: '#2247aa',
  em_analise: '#4b6cc2',
  cancelado: '#6b7280',
  cpf_invalido: '#5db7c2',
  expirada: '#7fbec4',
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
