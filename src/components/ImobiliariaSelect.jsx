import { useImobiliaria } from '../hooks/useImobiliaria'
import { WorkspacesSelect } from './ui/WorkspacesSelect'
import { Building2 } from 'lucide-react'

function nameToHue(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h) % 360
}

export default function ImobiliariaSelect({
  value,
  onChange,
  placeholder = 'Imobiliária...',
  required    = false,
  className   = '',
  disabled    = false,
  showAll     = true,
  allLabel    = 'Todas as imobiliárias',
}) {
  const { grupos, loading } = useImobiliaria()

  const options = [
    ...(showAll ? [{ value: '', label: allLabel, color: 'var(--glass-text-muted)', initials: '✓' }] : []),
    ...grupos.map(g => ({
      value:    g.nome_canonico,
      label:    g.nome_canonico,
      color:    `hsl(${nameToHue(g.nome_canonico)}, 50%, 50%)`,
      initials: g.nome_canonico.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?',
    })),
  ]

  return (
    <WorkspacesSelect
      value={value || ''}
      onChange={v => { if (required && !v) return; onChange(v) }}
      options={options}
      placeholder={loading ? 'Carregando...' : placeholder}
      label="Imobiliária"
      disabled={disabled}
      className={className}
      clearable={!required && !!value}
      searchable={grupos.length > 8}
      emptyText="Nenhuma imobiliária cadastrada"
    />
  )
}
