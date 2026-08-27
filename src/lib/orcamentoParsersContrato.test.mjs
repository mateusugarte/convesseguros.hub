import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { parseCotacaoAllianz } from './orcamentoAllianzParser.js'
import { parseCotacaoBradesco } from './orcamentoBradescoParser.js'
import { parseCotacaoDarwin } from './orcamentoDarwinParser.js'
import { parseCotacaoHdi } from './orcamentoHdiParser.js'
import { parseCotacaoPier } from './orcamentoPierParser.js'
import { parseCotacaoPorto } from './orcamentoPortoParser.js'
import { parseCotacaoSuhai } from './orcamentoSuhaiParser.js'
import { parseCotacaoTokio } from './orcamentoTokioParser.js'
import { parseCotacaoYelum } from './orcamentoYelumParser.js'
import {
  ESTADO_COBERTURA, montarCategorias, TEM_VALOR_MONETARIO, validarCotacao,
} from './orcamentoComparativo.js'

const fixture = nome => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${nome}.json`, import.meta.url)))
const porto = fixture('porto-familia')

const COTACOES_REAIS = [
  ['Allianz', parseCotacaoAllianz({ ...fixture('allianz'), oferta: 'Completo' })],
  ['Bradesco', parseCotacaoBradesco(fixture('bradesco'))],
  ['Darwin', parseCotacaoDarwin(fixture('darwin'))],
  ['HDI', parseCotacaoHdi({ ...fixture('hdi'), modalidade: 'mercado' })],
  ['Pier', parseCotacaoPier({ ...fixture('pier'), produto: 'completo', franquia_tipo: 'reduzida' })],
  ['Azul', parseCotacaoPorto(porto.AZUL)],
  ['Itaú', parseCotacaoPorto(porto.ITAU)],
  ['Mitsui', parseCotacaoPorto(porto.MITSUI)],
  ['Suhai', parseCotacaoSuhai({ ...fixture('suhai'), produto: 'compreensiva' })],
  ['Tokio', parseCotacaoTokio(fixture('tokio'))],
  ['Yelum', parseCotacaoYelum(fixture('yelum'))],
]

test('contrato comum cobre todos os PDFs reais sem ocultar campo ausente', () => {
  for (const [nome, cotacao] of COTACOES_REAIS) {
    const validacao = validarCotacao(cotacao)
    const bloqueios = new Set(validacao.bloqueios.map(item => item.caminho))
    const categorias = Object.fromEntries(montarCategorias(cotacao).categorias.map(item => [item.key, item]))

    assert.ok(cotacao.valores.premio_total != null || bloqueios.has('valores.premio_total'), `${nome}: prêmio`)
    assert.ok(cotacao.valores.premio_parcelado?.length || bloqueios.has('valores.premio_parcelado'), `${nome}: parcelamento`)
    assert.ok(cotacao.valores.franquia != null || bloqueios.has('valores.franquia'), `${nome}: franquia`)

    const integralCompleta = cotacao.indenizacao_integral?.incluida === false
      || (cotacao.indenizacao_integral?.incluida === true && cotacao.indenizacao_integral?.percentual_fipe != null)
    assert.ok(
      integralCompleta
        || bloqueios.has('indenizacao_integral.incluida')
        || bloqueios.has('indenizacao_integral.percentual_fipe'),
      `${nome}: indenização integral`,
    )

    for (const key of ['assistencia', 'carro_reserva', 'vidros', 'terceiros']) {
      const categoria = categorias[key]
      if (categoria?.estado === ESTADO_COBERTURA.NAO_INFORMADO) {
        assert.ok(bloqueios.has(`coberturas.${key}`), `${nome}: ${key} ausente sem bloqueio`)
      }
    }

    if (categorias.terceiros?.estado === ESTADO_COBERTURA.INCLUIDA) {
      assert.match(categorias.terceiros.texto, TEM_VALOR_MONETARIO, `${nome}: terceiros sem valor monetário`)
    }
  }
})
