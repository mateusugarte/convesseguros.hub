import test from 'node:test'
import assert from 'node:assert/strict'

// Matriz transversal dos PDFs reais: garante que todo parser cumpra o mesmo
// contrato de campos ou exponha um bloqueio de revisao, sem ocultar lacunas.
import './orcamentoParsersContrato.test.mjs'
import fs from 'node:fs'

import {
  detectarParserOrcamento, listarProdutosOrcamento, parseCotacaoPorSeguradora, parserOrcamentoPorId,
  LayoutOrcamentoNaoReconhecidoError,
} from './orcamentoSeguradoraParser.js'
import { ProdutoOrcamentoObrigatorioError } from './orcamentoProdutos.js'

const fixture = nome => JSON.parse(fs.readFileSync(new URL(`./__fixtures__/${nome}.json`, import.meta.url)))
const porto = () => fixture('porto-familia').AZUL

test('detecta todos os layouts sob responsabilidade deste módulo', () => {
  const esperados = {
    bradesco: 'bradesco', hdi: 'hdi', darwin: 'darwin',
    pier: 'pier', suhai: 'suhai', yelum: 'yelum', tokio: 'tokio',
  }
  assert.equal(detectarParserOrcamento(porto())?.id, 'porto_familia')
  for (const [arquivo, id] of Object.entries(esperados)) {
    assert.equal(detectarParserOrcamento(fixture(arquivo))?.id, id, arquivo)
  }
})

test('produtos únicos seguem direto e múltiplos exigem seleção', () => {
  assert.equal(listarProdutosOrcamento(fixture('darwin')).requer_selecao, false)
  assert.equal(listarProdutosOrcamento(fixture('hdi')).produtos.length, 2)
  assert.equal(listarProdutosOrcamento(fixture('pier')).produtos.length, 2)
  assert.equal(listarProdutosOrcamento(fixture('suhai')).produtos.length, 4)
})

test('entrada única não deixa HDI, Pier ou Suhai escolherem produto sozinhas', () => {
  for (const nome of ['hdi', 'pier', 'suhai']) {
    assert.throws(
      () => parseCotacaoPorSeguradora(fixture(nome)),
      erro => erro instanceof ProdutoOrcamentoObrigatorioError,
      nome,
    )
  }
})

test('entrada única encaminha o produto explicitamente selecionado', () => {
  const hdi = parseCotacaoPorSeguradora({ ...fixture('hdi'), produto: 'determinado' })
  const pier = parseCotacaoPorSeguradora({ ...fixture('pier'), produto: 'completo' })
  const suhai = parseCotacaoPorSeguradora({ ...fixture('suhai'), produto: 'terceiros' })
  assert.equal(hdi.produto_selecionado.id, 'determinado')
  assert.equal(hdi.valores.premio_total, 1664.71)
  assert.equal(pier.produto_selecionado.id, 'completo')
  assert.equal(suhai.produto_selecionado.id, 'terceiros')
  assert.equal(suhai.valores.premio_total, 1502.87)
})

test('parser selecionado pelo usuario vence a deteccao automatica', () => {
  const parser = parserOrcamentoPorId('hdi')
  assert.equal(parser?.id, 'hdi')
  assert.equal(listarProdutosOrcamento({ ...fixture('pier'), parser_id: 'hdi' }).parser_id, 'hdi')
  const cot = parseCotacaoPorSeguradora({ ...fixture('hdi'), parser_id: 'hdi', produto: 'mercado' })
  assert.equal(cot.seguradora.nome, 'HDI Seguros')
})

test('layout desconhecido produz erro estável para a interface', () => {
  assert.throws(
    () => listarProdutosOrcamento({ texto: 'arquivo qualquer' }),
    erro => erro instanceof LayoutOrcamentoNaoReconhecidoError
      && erro.code === 'LAYOUT_ORCAMENTO_NAO_RECONHECIDO',
  )
})
