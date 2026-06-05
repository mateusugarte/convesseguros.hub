import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

export function invalidarCacheSeguradoras() {
  _cache = null
}

export default function SeguradoraSelect({
  value,
  onChange,
  placeholder = 'Selecionar seguradora...',
  required = false,
  className = '',
  disabled = false,
}) {
  const [seguradoras, setSeguradoras] = useState(_cache || [])

  useEffect(() => {
    getSeguradoras().then(setSeguradoras)
  }, [])

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={`select w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {!required && <option value="">{placeholder}</option>}
      {seguradoras.map(nome => (
        <option key={nome} value={nome}>{nome}</option>
      ))}
    </select>
  )
}
