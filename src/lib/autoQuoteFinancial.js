import { parseDecimalBR } from './numberInput.js'

function texto(value) {
  return String(value ?? '').trim()
}

export function chaveSeguradora(value) {
  return texto(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

function opcaoDoLado(side, origem) {
  const nome = texto(side?.seguradora || side?.nome)
  if (!nome) return null

  return {
    nome,
    premio_total: parseDecimalBR(side?.campos?.premio_total ?? side?.premio_total),
    origem,
  }
}

/**
 * Traduz os dois lados revisados do comparativo para o fechamento financeiro.
 * A seguradora preferencial nunca e inferida pelo preco: ela e sempre a atual.
 */
export function derivarOpcoesFinanceirasComparativo({ atual, concorrente, opcoes = [] } = {}) {
  const preferencial = opcaoDoLado(atual, 'atual')
  const alternativas = [opcaoDoLado(concorrente, 'concorrente'), ...opcoes.map((opcao, index) => opcaoDoLado(opcao, `opcao_${index + 3}`))]
    .filter(Boolean)
  const comPremio = [preferencial, ...alternativas]
    .filter(opcao => opcao && Number.isFinite(opcao.premio_total))

  // "Mais barata" so existe depois que os dois totais podem ser comparados.
  // Escolher o unico PDF ja lido marcaria uma vencedora antes da hora.
  const maisBarata = comPremio.length >= 2
    ? comPremio.reduce((menor, opcao) => opcao.premio_total < menor.premio_total ? opcao : menor)
    : null

  return {
    seguradora_preferencial: preferencial,
    seguradora_mais_barata: maisBarata,
  }
}

/** Mantem os campos digitados apenas enquanto a seguradora continua a mesma. */
export function mesclarOpcaoFinanceira(salva, derivada) {
  if (!derivada?.nome) return salva || {}
  const mesmaSeguradora = chaveSeguradora(salva?.nome) === chaveSeguradora(derivada.nome)
  return {
    ...(mesmaSeguradora ? (salva || {}) : {}),
    nome: derivada.nome,
    premio_total: derivada.premio_total ?? null,
  }
}

export function opcaoFinanceiraSincronizada(salva, derivada) {
  const proxima = mesclarOpcaoFinanceira(salva, derivada)
  return chaveSeguradora(salva?.nome) === chaveSeguradora(proxima?.nome)
    && parseDecimalBR(salva?.premio_total) === parseDecimalBR(proxima?.premio_total)
}
