import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  parseCotacaoHdi, ehLayoutHdi, extrairNotas, extrairGarantias, extrairTotais,
  colunasGarantias, extrairParcelamento, textoParcelamento, moeda, listarProdutosHdi,
} from './orcamentoHdiParser.js'
import { ProdutoOrcamentoObrigatorioError } from './orcamentoProdutos.js'
import { montarCategorias, validarCotacao, humanizarCobertura, ESTADO_COBERTURA } from './orcamentoComparativo.js'

// Fixture do PDF real recebido em 25/08/2026 (`documentos_automacao/orçamentos/HDI.pdf`).
const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/hdi.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = (modalidade = 'mercado') => parseCotacaoHdi({ itens: FX.itens, texto: FX.texto, modalidade })

test('reconhece o layout HDI', () => {
  assert.equal(ehLayoutHdi(FX.texto), true)
  assert.equal(ehLayoutHdi('Orçamento Porto Seguro'), false)
})

// ─── As duas modalidades ───────────────────────────────────────────────

test('acha os dois pares de colunas, um por modalidade', () => {
  const c = colunasGarantias(linhas())
  assert.equal(c.pares.length, 2)
  assert.ok(c.pares[0].lmi < c.pares[1].lmi, 'mercado fica a esquerda de determinado')
  assert.ok(c.franquia != null)
})

test('REGRESSAO: aceita cabecalho HDI escrito como Valor de Mercado Referenciado', () => {
  const l = [
    {
      pagina: 1, y: 100,
      texto: 'Garantias de Auto (Valores Expressos em R$) Valor de Mercado Referenciado Valor Determinado Franquia',
      celulas: [
        { texto: 'Garantias', x: 28 }, { texto: 'Valor', x: 264 }, { texto: 'de', x: 282 },
        { texto: 'Mercado', x: 291 }, { texto: 'Referenciado', x: 320 },
        { texto: 'Valor', x: 418 }, { texto: 'Determinado', x: 443 }, { texto: 'Franquia', x: 522 },
      ],
    },
    {
      pagina: 1, y: 90, texto: 'Cobertura L.M.I. Prêmio L.M.I. Prêmio',
      celulas: [
        { texto: 'Cobertura', x: 28 }, { texto: 'L.M.I.', x: 274 }, { texto: 'Prêmio', x: 342 },
        { texto: 'L.M.I.', x: 410 }, { texto: 'Prêmio', x: 467 },
      ],
    },
    {
      pagina: 1, y: 80, texto: 'CASCO 100,00% FIPE 1.522,17 66.716,10 2.053,61 4.392,74',
      celulas: [
        { texto: 'CASCO', x: 28 }, { texto: '100,00%', x: 281 }, { texto: 'FIPE', x: 309 },
        { texto: '1.522,17', x: 356 }, { texto: '66.716,10', x: 420 },
        { texto: '2.053,61', x: 477 }, { texto: '4.392,74', x: 540 },
      ],
    },
    {
      pagina: 1, y: 70, texto: 'TOTAL À VISTA (R$) 2.690,65 3.261,31',
      celulas: [
        { texto: 'TOTAL', x: 28 }, { texto: 'À', x: 50 }, { texto: 'VISTA', x: 57 },
        { texto: '(R$)', x: 77 }, { texto: '2.690,65', x: 357 }, { texto: '3.261,31', x: 478 },
      ],
    },
  ]
  assert.ok(colunasGarantias(l))
  assert.equal(extrairGarantias(l).find(g => g.nome_original_seguradora === 'CASCO')?.lmi_texto, '100,00% FIPE')
  assert.equal(extrairTotais(l, { modalidade: 'mercado' }).total, 2690.65)
})

test('cada modalidade tem os proprios totais', () => {
  const mercado = extrairTotais(linhas(), { modalidade: 'mercado' })
  const determinado = extrairTotais(linhas(), { modalidade: 'determinado' })
  assert.deepEqual(mercado, { premio_liquido: 1376.65, iof: 101.59, total: 1478.24 })
  assert.deepEqual(determinado, { premio_liquido: 1550.30, iof: 114.41, total: 1664.71 })
  // liquido + IOF = total, nas duas
  for (const t of [mercado, determinado]) {
    assert.equal(Math.round((t.premio_liquido + t.iof) * 100) / 100, t.total)
  }
})

test('lista as duas modalidades e exige escolha explicita', () => {
  const lista = listarProdutosHdi()
  assert.equal(lista.requer_selecao, true)
  assert.deepEqual(lista.produtos.map(p => p.id), ['mercado', 'determinado'])
  assert.throws(
    () => parseCotacaoHdi({ itens: FX.itens, texto: FX.texto }),
    erro => erro instanceof ProdutoOrcamentoObrigatorioError
      && erro.code === 'PRODUTO_ORCAMENTO_OBRIGATORIO'
      && erro.produtos.length === 2,
  )
})

test('le mercado referenciado somente quando ele foi escolhido', () => {
  assert.equal(parse().modalidade, 'mercado')
  assert.equal(parse().valores.premio_total, 1478.24)
})

test('registra o total da outra modalidade sem perder o dado', () => {
  const alt = parse().modalidade_alternativa
  assert.equal(alt.modalidade, 'determinado')
  assert.equal(alt.premio_total, 1664.71)
  assert.equal(parse('determinado').modalidade_alternativa.premio_total, 1478.24)
})

// ─── Notas de rodape ───────────────────────────────────────────────────

test('junta as notas que quebram em varias linhas', () => {
  const notas = extrairNotas(linhas())
  assert.equal(Object.keys(notas).length, 4)
  assert.match(notas['1'], /Vidros com franquia de R\$ 340,00/)
  assert.match(notas['1'], /Maquina de Vidros com franquia de R\$ 100,00\.$/)  // ultima linha entrou
  assert.match(notas['3'], /7 dias de Carro Reserva/)
  assert.match(notas['4'], /Guincho 600 KM/)
})

test('a nota de rodape classifica o que o jargao esconde', () => {
  // "07 DIAS CR MANUAL" e "ESPECIAL AUTO - 600KM" nao casam com o dicionario.
  // A nota do proprio PDF traduz os dois para o vocabulario do ramo, e e ela
  // que decide a categoria — sem sujar o dicionario com jargao de uma cia so.
  const cot = parse()
  const porCategoria = Object.fromEntries(cot.coberturas.map(c => [c.categoria, c.nome_original_seguradora]))
  assert.equal(porCategoria.carro_reserva, '07 DIAS CR MANUAL')
  assert.equal(porCategoria.assistencia, 'ESPECIAL AUTO - 600KM')
})

// ─── Garantias ─────────────────────────────────────────────────────────

test('le as 11 linhas de garantia com LMI, franquia e premio', () => {
  const g = extrairGarantias(linhas())
  assert.equal(g.length, 11)
  const casco = g.find(x => /^CASCO/.test(x.nome_original_seguradora))
  assert.equal(casco.lmi_texto, '100,00% FIPE')
  assert.equal(casco.premio, 507.38)
  assert.equal(casco.franquia, 2465.76)
})

test('a mesma linha rende valores diferentes conforme a modalidade', () => {
  const nome = x => /^CASCO/.test(x.nome_original_seguradora)
  assert.equal(extrairGarantias(linhas(), { modalidade: 'mercado' }).find(nome).premio, 507.38)
  assert.equal(extrairGarantias(linhas(), { modalidade: 'determinado' }).find(nome).premio, 681.03)
  assert.equal(extrairGarantias(linhas(), { modalidade: 'determinado' }).find(nome).valor_lmi, 26625.60)
})

test('"Não Contratado" e exclusao declarada, nao silencio', () => {
  const cot = parse()
  assert.ok(cot.nao_incluso.some(i => /Acess[óo]rio/i.test(i.titulo)))
  assert.ok(!cot.coberturas.some(c => /Acess[óo]rio/i.test(c.nome_original_seguradora)))
})

// ─── A regressao do LMI percentual ─────────────────────────────────────

test('REGRESSAO: o LMI do casco e percentual, nao dinheiro', () => {
  // "100,00% FIPE" formatado como moeda virava "Casco: R$ 100,00" impresso
  // para o cliente — um valor de indenizacao falso e mil vezes menor que o
  // real. So vira moeda quando a celula e mesmo um valor monetario.
  const colisao = montarCategorias(parse()).categorias.find(c => c.key === 'colisao')
  assert.match(colisao.texto, /100,00% FIPE/)
  assert.doesNotMatch(colisao.texto, /R\$ 100,00/)

  // Na modalidade de valor determinado, ai sim e dinheiro.
  const outra = montarCategorias(parse('determinado')).categorias.find(c => c.key === 'colisao')
  assert.match(outra.texto, /R\$ 26\.625,60/)
})

test('indenizacao integral acompanha a modalidade', () => {
  assert.deepEqual(parse().indenizacao_integral, { incluida: true, percentual_fipe: 100, observacao: '' })
  const det = parse('determinado').indenizacao_integral
  assert.equal(det.incluida, true)
  assert.equal(det.percentual_fipe, null)   // nao existe percentual aqui; nao inventar
  assert.match(det.observacao, /valor determinado de R\$ 26\.625,60/)
})

// ─── Parcelamento ──────────────────────────────────────────────────────

test('sem juros e calculado por n x parcela, porque a HDI nao imprime o total', () => {
  const planos = Object.fromEntries(
    extrairParcelamento(linhas(), { modalidade: 'mercado', total: 1478.24 }).map(p => [p.meio, p]),
  )
  assert.equal(planos['Cartão de Crédito'].maximo_sem_juros, 12)   // 12 x 123,18 = 1.478,16
  assert.equal(planos['Débito Em Conta'].maximo_sem_juros, 6)      // 7x ja sobe para 233,58
  assert.equal(planos['Carnê'].maximo_sem_juros, 1)                // 2 x 755,38 > total
})

test('REGRESSAO: parcelamento HDI aceita linhas quebradas em numero, x e valor', () => {
  const l = [
    {
      pagina: 1, y: 30, texto: 'Parcelamento Valor de Mercado Referenciado Parcelamento Valor Determinado',
      celulas: [{ texto: 'Parcelamento', x: 92 }, { texto: 'Valor', x: 136 }, { texto: 'Mercado', x: 163 }],
    },
    {
      pagina: 1, y: 20, texto: 'Cartão de Crédito Débito Em Conta Carnê Cartão de Crédito Débito Em Conta Carnê',
      celulas: [
        { texto: 'Cartão', x: 80 }, { texto: 'Crédito', x: 111 },
        { texto: 'Débito', x: 138 }, { texto: 'Conta', x: 172 }, { texto: 'Carnê', x: 211 },
        { texto: 'Cartão', x: 349 }, { texto: 'Crédito', x: 381 },
        { texto: 'Débito', x: 408 }, { texto: 'Conta', x: 442 }, { texto: 'Carnê', x: 481 },
      ],
    },
    {
      pagina: 1, y: 10, texto: '12 x 224,22 12 x 271,77',
      celulas: [
        { texto: '12', x: 83 }, { texto: 'x', x: 92 }, { texto: '224,22', x: 113 },
        { texto: '12', x: 353 }, { texto: 'x', x: 362 }, { texto: '271,77', x: 382 },
      ],
    },
  ]
  assert.deepEqual(extrairParcelamento(l, { modalidade: 'mercado', total: 2690.65 }), [
    { meio: 'Cartão de Crédito', maximo_sem_juros: 12, valor_parcela: 224.22 },
  ])
  assert.deepEqual(extrairParcelamento(l, { modalidade: 'determinado', total: 3261.31 }), [
    { meio: 'Cartão de Crédito', maximo_sem_juros: 12, valor_parcela: 271.77 },
  ])
})

test('pega a metade certa da tabela conforme a modalidade', () => {
  const det = extrairParcelamento(linhas(), { modalidade: 'determinado', total: 1664.71 })
  const cartao = det.find(p => /Cart[ãa]o/i.test(p.meio))
  assert.equal(cartao.valor_parcela, 138.72)   // 12x da coluna da direita
})

test('texto do parcelamento sai legivel', () => {
  const t = textoParcelamento(extrairParcelamento(linhas(), { modalidade: 'mercado', total: 1478.24 }))
  assert.ok(t.some(l => l === 'Cartão de Crédito: até 12x de R$ 123,18 sem juros'), t.join(' | '))
  assert.ok(t.some(l => /Carn[êe]: à vista/.test(l)), t.join(' | '))
})

// ─── Identificacao ─────────────────────────────────────────────────────

test('"Companhia Anterior" preenchida e renovacao, mesmo a HDI dizendo "Novo Negócio"', () => {
  // A HDI carimba "Novo Negócio" porque o cliente e novo PARA ELA. Para a
  // corretora, com companhia anterior preenchida, e renovacao congenere — o
  // mesmo criterio ja usado no Bradesco. Sem isso, uma renovacao entraria no
  // funil como negocio novo.
  assert.match(FX.texto, /Novo Negócio/)
  assert.equal(parse().cotacao.tipo_operacao, 'renovacao')
})

test('separa segurado de condutor principal', () => {
  const cot = parse()
  assert.equal(cot.segurado.nome, 'NEUZA FRANCISCA DOS SANTOS LINS')
  assert.equal(cot.condutor_principal.nome, 'Beatriz Santos Lins')
})

test('limpa o codigo interno e a referencia FIPE do nome do veiculo', () => {
  // Cru: "0014271 - CHEVROLET - CORSA - HATCH MAXX 1.4 ECONOFLEX 8V 5P (FIPE"
  const v = parse().veiculo
  assert.equal(v.marca_modelo, 'CHEVROLET - CORSA - HATCH MAXX 1.4 ECONOFLEX 8V 5P')
  assert.equal(v.ano_modelo, '2009/2010')
  assert.equal(v.cep_pernoite, '03659-070')   // vem sem hifen no PDF
  assert.equal(v.condutor_18_25, 'Sem cobertura')
})

test('vigencia sai da frase por extenso', () => {
  // "DAS 24 HS DO DIA 27/08/2026 ÀS 24 HS DO DIA 27/08/2027 ( 365 DIAS)"
  assert.equal(parse().vigencia.inicio, '2026-08-27')
  assert.equal(parse().vigencia.fim, '2027-08-27')
})

// ─── Integracao com o comparativo ──────────────────────────────────────

test('a cotacao HDI preenche as 7 categorias e pode ser gerada', () => {
  const cot = parse()
  for (const cat of montarCategorias(cot).categorias) {
    assert.equal(cat.estado, ESTADO_COBERTURA.INCLUIDA, `${cat.key}: ${cat.texto}`)
  }
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('APP e classificada de proposito, nao por omissao', () => {
  // Cobertura que cai em "adicional" por FALTA de classificacao dispara o aviso
  // de "nao classificada". Um aviso que sempre aparece deixa de ser lido.
  const v = validarCotacao(parse())
  assert.ok(!v.pendencias.some(p => /não classificada/.test(p.label)), JSON.stringify(v.pendencias))
})

test('humanizarCobertura preserva as siglas que aparecem na HDI', () => {
  assert.equal(humanizarCobertura('HDI AUTO VIDROS'), 'HDI Auto Vidros')
  assert.equal(humanizarCobertura('07 DIAS CR MANUAL'), '07 Dias CR Manual')
  assert.equal(humanizarCobertura('APP MORTE'), 'APP Morte')
})

test('moeda ignora o texto que nao e valor', () => {
  assert.equal(moeda('2.465,76'), 2465.76)
  assert.equal(moeda('Não Contratado'), null)
  assert.equal(moeda('100,00% FIPE'), 100)   // le o numero; quem decide se e dinheiro e o chamador
})

test('a logo e a cor vem do cadastro, nunca do PDF', () => {
  const cot = parseCotacaoHdi({
    itens: FX.itens,
    texto: FX.texto,
    modalidade: 'mercado',
    seguradoraMeta: { id: 'h1', nome_canonico: 'HDI Seguros', logo_url: 'https://cdn/hdi.png', cor_destaque: '#00723f' },
  })
  assert.equal(cot.seguradora.logo_url, 'https://cdn/hdi.png')
  assert.equal(cot.seguradora.cor_destaque, '#00723f')
})
