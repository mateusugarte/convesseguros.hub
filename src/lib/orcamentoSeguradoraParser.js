// Porta de entrada dos parsers AUTO implementados pelo Codex. Allianz fica no
// modulo independente mantido pelo Claude e deve ser registrada pela camada de
// integracao sem alterar este arquivo.

import { ehLayoutPorto, parseCotacaoPorto, detectarMarca } from './orcamentoPortoParser.js'
import { ehLayoutBradesco, parseCotacaoBradesco } from './orcamentoBradescoParser.js'
import { ehLayoutHdi, listarProdutosHdi, parseCotacaoHdi } from './orcamentoHdiParser.js'
import { ehLayoutDarwin, parseCotacaoDarwin } from './orcamentoDarwinParser.js'
import { ehLayoutPier, listarProdutosPier, parseCotacaoPier } from './orcamentoPierParser.js'
import { ehLayoutSuhai, listarProdutosSuhai, parseCotacaoSuhai } from './orcamentoSuhaiParser.js'
import { ehLayoutYelum, parseCotacaoYelum } from './orcamentoYelumParser.js'
import { ehLayoutTokio, parseCotacaoTokio } from './orcamentoTokioParser.js'

const produtoUnico = (seguradora, label = 'Produto cotado') => ({
  seguradora,
  requer_selecao: false,
  produtos: [{ id: 'unico', label }],
})

export const PARSERS_ORCAMENTO_AUTO = [
  {
    id: 'porto_familia',
    nome: texto => detectarMarca(texto)?.nome || 'Porto Seguro',
    detectar: ehLayoutPorto,
    listarProdutos: texto => produtoUnico(detectarMarca(texto)?.nome || 'Porto Seguro'),
    parse: entrada => parseCotacaoPorto(entrada),
  },
  {
    id: 'bradesco', nome: () => 'Bradesco Seguros', detectar: ehLayoutBradesco,
    listarProdutos: () => produtoUnico('Bradesco Seguros'), parse: entrada => parseCotacaoBradesco(entrada),
  },
  {
    id: 'hdi', nome: () => 'HDI Seguros', detectar: ehLayoutHdi,
    listarProdutos: listarProdutosHdi, parse: entrada => parseCotacaoHdi({ ...entrada, produto: entrada.produto }),
  },
  {
    id: 'darwin', nome: () => 'Darwin Seguros', detectar: ehLayoutDarwin,
    listarProdutos: () => produtoUnico('Darwin Seguros'), parse: entrada => parseCotacaoDarwin(entrada),
  },
  {
    id: 'pier', nome: () => 'Pier Seguros', detectar: ehLayoutPier,
    listarProdutos: listarProdutosPier, parse: entrada => parseCotacaoPier({ ...entrada, produto: entrada.produto }),
  },
  {
    id: 'suhai', nome: () => 'Suhai Seguradora', detectar: ehLayoutSuhai,
    listarProdutos: listarProdutosSuhai, parse: entrada => parseCotacaoSuhai({ ...entrada, produto: entrada.produto }),
  },
  {
    id: 'yelum', nome: () => 'Yelum Seguros', detectar: ehLayoutYelum,
    listarProdutos: () => produtoUnico('Yelum Seguros'), parse: entrada => parseCotacaoYelum(entrada),
  },
  {
    id: 'tokio', nome: () => 'Tokio Marine', detectar: ehLayoutTokio,
    listarProdutos: () => produtoUnico('Tokio Marine'), parse: entrada => parseCotacaoTokio(entrada),
  },
]

export class LayoutOrcamentoNaoReconhecidoError extends Error {
  constructor() {
    super('Não foi possível reconhecer a seguradora ou o layout desta cotação.')
    this.name = 'LayoutOrcamentoNaoReconhecidoError'
    this.code = 'LAYOUT_ORCAMENTO_NAO_RECONHECIDO'
  }
}

export function detectarParserOrcamento({ texto = '' } = {}) {
  return PARSERS_ORCAMENTO_AUTO.find(parser => parser.detectar(texto)) || null
}

export function listarProdutosOrcamento({ texto = '' } = {}) {
  const parser = detectarParserOrcamento({ texto })
  if (!parser) throw new LayoutOrcamentoNaoReconhecidoError()
  return { parser_id: parser.id, ...parser.listarProdutos(texto) }
}

export function parseCotacaoPorSeguradora(entrada = {}) {
  const parser = detectarParserOrcamento(entrada)
  if (!parser) throw new LayoutOrcamentoNaoReconhecidoError()
  return parser.parse(entrada)
}
