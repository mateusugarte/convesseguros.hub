import { useEffect, useState } from 'react'
import { WorkspacesSelect } from './ui/WorkspacesSelect'
import { fetchSeguradorasPorProduto, invalidarCacheSeguradoras } from '../lib/seguradoras'
import { getEntityImageUrl } from '../lib/entityMedia'

function segColor(nome) {
  const palette = ['#4A90D9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#2B5BA8', '#EF4444']
  let h = 0
  for (let i = 0; i < (nome || '').length; i += 1) h = nome.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

function logoIcon(nome, logoUrl, logoPath) {
  const resolvedUrl = getEntityImageUrl(logoPath, logoUrl)
  if (!resolvedUrl) return null
  return (
    <img
      src={resolvedUrl}
      alt={nome}
      className="w-full h-full object-contain"
      loading="lazy"
      decoding="async"
    />
  )
}

export { invalidarCacheSeguradoras }

export default function SeguradoraSelect({
  value,
  onChange,
  produto,
  placeholder = 'Seguradora...',
  required = false,
  className = '',
  disabled = false,
}) {
  const [seguradoras, setSeguradoras] = useState([])

  useEffect(() => {
    fetchSeguradorasPorProduto(produto).then(setSeguradoras).catch(() => setSeguradoras([]))
  }, [produto])

  const options = seguradoras.map(seg => ({
    value: seg.nome_canonico,
    label: seg.nome_canonico,
    color: segColor(seg.nome_canonico),
    initials: seg.nome_canonico.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase() || '',
    icon: logoIcon(seg.nome_canonico, seg.logo_url, seg.logo_path),
  }))

  return (
    <WorkspacesSelect
      value={value || ''}
      onChange={nextValue => {
        if (required && !nextValue) return
        onChange(nextValue)
      }}
      options={options}
      placeholder={placeholder}
      label="Seguradora"
      disabled={disabled}
      className={className}
      clearable={!required && !!value}
      searchable={seguradoras.length > 8}
      emptyText={produto  'Nenhuma seguradora para este produto' : 'Nenhuma seguradora cadastrada'}
    />
  )
}
