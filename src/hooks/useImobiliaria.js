import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'

let _cache = null       // mapa de aliases em memória (compartilhado entre instâncias)
let _promise = null     // promessa de carregamento em andamento

export function useImobiliaria() {
  const [aliasMap, setAliasMap] = useState(_cache || {})
  const [grupos,   setGrupos]   = useState([])
  const [loading,  setLoading]  = useState(!_cache)

  const carregar = useCallback(async (forçar = false) => {
    if (_cache && !forçar) {
      setAliasMap(_cache)
      setLoading(false)
      return
    }

    if (!_promise || forçar) {
      _promise = (async () => {
        const { data: aliasesData } = await supabase
          .from('imobiliaria_aliases')
          .select('alias, imobiliarias!imobiliaria_id(id, nome_canonico)')

        const mapa = {}
        aliasesData?.forEach(({ alias, imobiliarias: imob }) => {
          if (imob) mapa[alias.toLowerCase().trim()] = imob.nome_canonico
        })
        _cache = mapa
        return mapa
      })()
    }

    const mapa = await _promise
    setAliasMap(mapa)

    const { data: imobs } = await supabase
      .from('imobiliarias')
      .select('id, nome_canonico, ativa')
      .eq('ativa', true)
      .order('nome_canonico')
    setGrupos(imobs || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Resolver: alias DB → canônico; fallback → normalizeImobiliaria
  function resolverNome(nomeOriginal) {
    if (!nomeOriginal) return '—'
    const chave = nomeOriginal.toLowerCase().trim()
    if (aliasMap[chave]) return aliasMap[chave]
    return normalizeImobiliaria(nomeOriginal) || nomeOriginal
  }

  async function getAliases(nomeCanônico) {
    const { data } = await supabase
      .from('imobiliaria_aliases')
      .select('alias, imobiliarias!imobiliaria_id!inner(nome_canonico)')
      .eq('imobiliarias.nome_canonico', nomeCanônico)
    return data?.map(d => d.alias) || [nomeCanônico]
  }

  function recarregar() {
    _cache = null
    _promise = null
    return carregar(true)
  }

  return { resolverNome, getAliases, grupos, aliasMap, loading, recarregar }
}
