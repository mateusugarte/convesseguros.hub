// ─── Para onde o botao "Voltar" leva ───────────────────────────────────
//
// Cada tela de detalhe tinha o destino do "Voltar" FIXO no codigo:
// `/auto/cotacoes`, `/auto/emissoes`, `/auto/clientes`. Quem abria a cotacao
// pela Visao Geral, pelo Pipeline, pela ficha do cliente ou pela busca universal
// era despejado numa lista onde nunca esteve — e perdia junto o mes filtrado, a
// busca digitada e a posicao da rolagem.
//
// A ordem de decisao, do mais especifico para o mais generico:
//
//  1. `state.from`. Quem navegou disse explicitamente de onde veio. Vence
//     sempre: e a unica origem que sobrevive quando a tela de destino troca a
//     propria URL (`replace`), o que apagaria a entrada anterior do historico.
//  2. O historico do proprio app. O React Router numera as entradas em
//     `history.state.idx`. `idx > 0` significa que existe uma tela ANTERIOR
//     dentro desta sessao, e recuar uma entrada devolve exatamente aquela tela,
//     com query string e rolagem, sem nenhum call site precisar declarar nada.
//  3. O destino fixo, como ultimo recurso.
//
// O passo 2 e o que conserta o caso reclamado. O passo 3 continua existindo
// porque `idx === 0` e real: link colado, aba nova, F5 na propria tela de
// detalhe. Nesses casos nao ha tela anterior DO SISTEMA, e recuar levaria o
// usuario para fora — para o site que ele visitou antes ou para uma aba em
// branco.

// Rota interna e a que comeca com uma barra so. `//host` e `https://host` sao
// endereco de outro site: se um deles chegasse em `state.from`, o "Voltar"
// mandaria o usuario para fora do sistema.
const ROTA_INTERNA = /^\/(?!\/)/

export function ehRotaInterna(valor) {
  return typeof valor === 'string' && ROTA_INTERNA.test(valor.trim())
}

/** Rota atual em uma string, para ser passada adiante como `state.from`. */
export function rotaAtual(location = {}) {
  const rota = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`
  return rota || '/'
}

/**
 * Decide o retorno sem tocar em React nem no objeto `history`.
 *
 * Devolve `{ modo, destino }`. `modo: 'historico'` traz `destino: -1`, que e o
 * argumento que `navigate` espera para recuar uma entrada.
 */
export function resolverRetorno({ from, historyIndex, fallback = '/' } = {}) {
  const rota = typeof from === 'string' ? from.trim() : ''
  if (ehRotaInterna(rota)) return { modo: 'rota', destino: rota }
  if (Number.isInteger(historyIndex) && historyIndex > 0) return { modo: 'historico', destino: -1 }
  return { modo: 'fallback', destino: fallback }
}
