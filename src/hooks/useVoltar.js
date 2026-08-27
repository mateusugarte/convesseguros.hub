import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { resolverRetorno, rotaAtual } from '../lib/navegacaoRetorno.js'

/**
 * Devolve a funcao do botao "Voltar"/"Fechar" de uma tela de detalhe.
 *
 * `fallback` so entra em cena quando nao ha para onde voltar dentro do sistema
 * (link colado, aba nova, F5 na propria tela). A regra de decisao mora em
 * `navegacaoRetorno.js`, sem React, e e testada la.
 */
export function useVoltar(fallback = '/') {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from

  return useCallback(() => {
    const plano = resolverRetorno({
      from,
      // O React Router numera as entradas que ele mesmo empilhou. Fora do
      // navegador (SSR, teste) nao ha `window`, e ai vale o fallback.
      historyIndex: typeof window === 'undefined' ? null : window.history.state?.idx,
      fallback,
    })
    navigate(plano.destino)
  }, [navigate, from, fallback])
}

/**
 * Rota atual em string, para declarar a origem ao abrir um detalhe:
 * `navigate(destino, { state: { from: origem } })`.
 *
 * Usar isto em vez de escrever a rota na mao evita o erro de um componente
 * montado em mais de uma rota declarar sempre a mesma origem.
 */
export function useOrigemAtual() {
  return rotaAtual(useLocation())
}
