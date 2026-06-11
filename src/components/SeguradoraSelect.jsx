import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { WorkspacesSelect } from './ui/WorkspacesSelect'

let _cache = null

async function getSeguradoras() {
  if (_cache) return _cache
  const { data } = await supabase
    .from('seguradoras')
    .select('nome_canonico')
    .neq('ativa', false)
    .order('nome_canonico')
    .limit(500)
  _cache = data?.map(s => s.nome_canonico) || []
  return _cache
}

export function invalidarCacheSeguradoras() { _cache = null }

function segColor(nome) {
  const palette = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8','#EF4444']
  let h = 0; for (let i = 0; i < (nome||'').length; i++) h = nome.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

export default function SeguradoraSelect({
  value,
  onChange,
  placeholder = 'Seguradora...',
  required    = false,
  className   = '',
  disabled    = false,
}) {
  const [seguradoras, setSeguradoras] = useState(_cache || [])

  useEffect(() => { getSeguradoras().then(setSeguradoras) }, [])

  const options = seguradoras.map(nome => ({
    value:    nome,
    label:    nome,
    color:    segColor(nome),
    initials: nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?',
  }))

  return (
    <WorkspacesSelect
      value={value || ''}
      onChange={v => { if (required && !v) return; onChange(v) }}
      options={options}
      placeholder={placeholder}
      label="Seguradora"
      disabled={disabled}
      className={className}
      clearable={!required && !!value}
      searchable={seguradoras.length > 8}
      emptyText="Nenhuma seguradora cadastrada"
    />
  )
}
