// Porta de entrada dos parsers AUTO implementados pelo Codex. Allianz fica no
// modulo independente mantido pelo Claude e deve ser registrada pela camada de
// integracao sem alterar este arquivo.

import { ehLayoutPorto, parseCotacaoPorto, detectarMarca, MARCAS_PORTO, marcaPortoPorId } from './orcamentoPortoParser.js'
import { ehLayoutBradesco, parseCotacaoBradesco } from './orcamentoBradescoParser.js'
import { ehLayoutHdi, listarProdutosHdi, parseCotacaoHdi } from './orcamentoHdiParser.js'
import { ehLayoutDarwin, parseCotacaoDarwin } from './orcamentoDarwinParser.js'
import { ehLayoutPier, listarProdutosPier, parseCotacaoPier } from './orcamentoPierParser.js'
import { ehLayoutSuhai, listarProdutosSuhai, parseCotacaoSuhai } from './orcamentoSuhaiParser.js'
import { ehLayoutYelum, parseCotacaoYelum } from './orcamentoYelumParser.js'
import { ehLayoutTokio, listarProdutosTokio, parseCotacaoTokio } from './orcamentoTokioParser.js'
import { protegerCoberturasContraPremio } from './orcamentoComparativo.js'

const produtoUnico = (seguradora, label = 'Produto cotado') => ({
  seguradora,
  requer_selecao: false,
  produtos: [{ id: 'unico', label }],
})

/**
 * As quatro marcas da familia Porto sao parsers SEPARADOS na selecao.
 *
 * Elas compartilham o mesmo layout, mas nao a mesma identidade: o orcamento que
 * chega ao cliente leva o nome e a LOGO da seguradora escolhida. Enquanto as
 * quatro moravam numa opcao unica ("Porto / Azul / Itau / Mitsui"), a marca do
 * documento final dependia de adivinhacao por texto — e foi assim que uma
 * cotacao da Porto e uma da Azul sairam as duas como Azul Seguros. Agora o
 * operador escolhe qual das quatro, e essa escolha vence a deteccao.
 *
 * `detectar` continua sendo o layout da familia inteira: quando ninguem
 * escolheu nada, qualquer uma reconhece o PDF e a marca vem dos campos.
 */
const PARSERS_FAMILIA_PORTO = MARCAS_PORTO.map(marca => ({
  id: marca.id,
  // `apenas_selecao`: existem para quem ESCOLHEU a marca. A deteccao automatica
  // as ignora e cai em `porto_familia`, senao qualquer PDF da familia seria
  // rotulado com a primeira marca da lista — trocar uma adivinhacao por outra.
  apenas_selecao: true,
  nome: () => marcaPortoPorId(marca.id).nome,
  detectar: ehLayoutPorto,
  listarProdutos: () => produtoUnico(marcaPortoPorId(marca.id).nome),
  parse: entrada => parseCotacaoPorto({ ...entrada, marca_id: marca.id }),
}))

export const PARSERS_ORCAMENTO_AUTO = [
  ...PARSERS_FAMILIA_PORTO,
  {
    // Id antigo da opcao agrupada. Continua valendo para rascunhos e leituras
    // ja gravados com ele: sem marca escolhida, a marca vem dos campos do PDF.
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
    listarProdutos: listarProdutosTokio, parse: entrada => parseCotacaoTokio({ ...entrada, produto: entrada.produto }),
  },
]

export class LayoutOrcamentoNaoReconhecidoError extends Error {
  constructor() {
    super('Não foi possível reconhecer a seguradora ou o layout desta cotação.')
    this.name = 'LayoutOrcamentoNaoReconhecidoError'
    this.code = 'LAYOUT_ORCAMENTO_NAO_RECONHECIDO'
  }
}

export function parserOrcamentoPorId(id) {
  return PARSERS_ORCAMENTO_AUTO.find(parser => parser.id === id) || null
}

export function detectarParserOrcamento({ texto = '' } = {}) {
  return PARSERS_ORCAMENTO_AUTO.find(parser => !parser.apenas_selecao && parser.detectar(texto)) || null
}

/** Opcoes oferecidas ao operador no seletor de seguradora do PDF. */
export function parsersSelecionaveisOrcamento() {
  return PARSERS_ORCAMENTO_AUTO.filter(parser => parser.id !== 'porto_familia')
}

export function listarProdutosOrcamento({ texto = '', parser_id: parserId = '' } = {}) {
  const parser = parserId ? parserOrcamentoPorId(parserId) : detectarParserOrcamento({ texto })
  if (!parser) throw new LayoutOrcamentoNaoReconhecidoError()
  return { parser_id: parser.id, ...parser.listarProdutos(texto) }
}

export function parseCotacaoPorSeguradora(entrada = {}) {
  const parser = entrada.parser_id ? parserOrcamentoPorId(entrada.parser_id) : detectarParserOrcamento(entrada)
  if (!parser) throw new LayoutOrcamentoNaoReconhecidoError()
  return protegerCoberturasContraPremio(parser.parse(entrada))
}
