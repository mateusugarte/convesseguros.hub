/**
 * Contrato comum para PDFs que trazem mais de um produto no mesmo arquivo.
 *
 * Escolher silenciosamente o primeiro produto mistura premio, franquia e
 * coberturas de propostas diferentes. Por isso o parser interrompe antes da
 * leitura final e devolve opcoes suficientes para a interface pedir a escolha.
 */
export class ProdutoOrcamentoObrigatorioError extends Error {
  constructor(seguradora, produtos) {
    super(`Selecione um produto da ${seguradora} antes de elaborar o orçamento.`)
    this.name = 'ProdutoOrcamentoObrigatorioError'
    this.code = 'PRODUTO_ORCAMENTO_OBRIGATORIO'
    this.seguradora = seguradora
    this.produtos = produtos
  }
}

export class ProdutoOrcamentoInvalidoError extends Error {
  constructor(seguradora, produto, produtos) {
    super(`O produto "${produto}" não existe nesta cotação da ${seguradora}.`)
    this.name = 'ProdutoOrcamentoInvalidoError'
    this.code = 'PRODUTO_ORCAMENTO_INVALIDO'
    this.seguradora = seguradora
    this.produto = produto
    this.produtos = produtos
  }
}

export function exigirProduto({ seguradora, produtos, selecionado }) {
  const opcoes = (produtos || []).map(p => ({ ...p }))
  if (!selecionado) throw new ProdutoOrcamentoObrigatorioError(seguradora, opcoes)
  const produto = opcoes.find(p => p.id === selecionado)
  if (!produto) throw new ProdutoOrcamentoInvalidoError(seguradora, selecionado, opcoes)
  return produto
}

export function resultadoProdutos(seguradora, produtos) {
  const opcoes = (produtos || []).map(p => ({ ...p }))
  return {
    seguradora,
    requer_selecao: opcoes.length > 1,
    produtos: opcoes,
  }
}
