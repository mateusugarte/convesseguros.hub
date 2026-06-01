import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'

// Módulo-level cache — compartilhado entre todas as instâncias do hook
let _aliasMap = null   // { alias_lower → nome_canonico }
let _grupos   = null   // [{ id, nome_canonico, ativa }]
let _promise  = null   // promessa em andamento (evita requests paralelos)

export function useImobiliaria() {
  const [aliasMap, setAliasMap] = useState(_aliasMap || {})
  const [grupos,   setGrupos]   = useState(_grupos   || [])
  const [loading,  setLoading]  = useState(!_aliasMap)

  const carregar = useCallback(async (forçar = false) => {
    // Cache quente para ambos → usar direto, sem request
    if (_aliasMap && _grupos && !forçar) {
      setAliasMap(_aliasMap)
      setGrupos(_grupos)
      setLoading(false)
      return
    }

    if (!_promise || forçar) {
      _promise = Promise.all([
        supabase
          .from('imobiliaria_aliases')
          .select('alias, imobiliarias!imobiliaria_id(id, nome_canonico)'),
        supabase
          .from('imobiliarias')
          .select('id, nome_canonico, ativa')
          .eq('ativa', true)
          .order('nome_canonico'),
      ]).then(([{ data: aliasesData }, { data: gruposData }]) => {
        const mapa = {}
        aliasesData?.forEach(({ alias, imobiliarias: imob }) => {
          if (imob) mapa[alias.toLowerCase().trim()] = imob.nome_canonico
        })
        _aliasMap = mapa
        _grupos   = gruposData || []
        return { mapa, grupos: _grupos }
      })
    }

    const { mapa, grupos: gs } = await _promise
    setAliasMap(mapa)
    setGrupos(gs)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // useCallback garante referência estável → não causa loops em dependências
  const resolverNome = useCallback((nomeOriginal) => {
    if (!nomeOriginal) return '—'
    const chave = nomeOriginal.toLowerCase().trim()
    if (aliasMap[chave]) return aliasMap[chave]
    return normalizeImobiliaria(nomeOriginal) || nomeOriginal
  }, [aliasMap])

  // Estável: [] de dependências → referência nunca muda
  const getAliases = useCallback(async (nomeCanônico) => {
    const { data } = await supabase
      .from('imobiliaria_aliases')
      .select('alias, imobiliarias!imobiliaria_id!inner(nome_canonico)')
      .eq('imobiliarias.nome_canonico', nomeCanônico)
    return data?.map(d => d.alias) || [nomeCanônico]
  }, [])

  function recarregar() {
    _aliasMap = null
    _grupos   = null
    _promise  = null
    return carregar(true)
  }

  return { resolverNome, getAliases, grupos, aliasMap, loading, recarregar }
}
