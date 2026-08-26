import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas, valorAposRotulo } from './pdfLayout.js'
import {
  parseCotacaoBradesco, ehLayoutBradesco, extrairClausulas, extrairLmi,
  extrairFranquias, extrairPremios, extrairPagamento, textoPagamento, moeda,
} from './orcamentoBradescoParser.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

// Fixture do PDF real recebido em 25/08/2026
// (`documentos_automacao/orçamentos/BRADESCO.pdf`), com coordenadas.
const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/bradesco.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
const parse = () => parseCotacaoBradesco({ itens: FX.itens, texto: FX.texto })

// ─── valorAposRotulo ───────────────────────────────────────────────────

test('valorAposRotulo le rotulo e valor em celulas separadas ou grudados', () => {
  const l = agruparLinhas([
    { texto: 'Para-Brisa:', x: 26, y: 100, pagina: 1 },
    { texto: '314,00', x: 76, y: 100, pagina: 1 },
    { texto: 'Assist. Funeral: 0,00', x: 217, y: 100, pagina: 1 },
  ])
  assert.equal(valorAposRotulo(l, 'Para-Brisa'), '314,00')
  assert.equal(valorAposRotulo(l, 'Assist. Funeral'), '0,00')
  assert.equal(valorAposRotulo(l, 'Inexistente'), '')
})

// ─── A armadilha do rotulo repetido ────────────────────────────────────

test('REGRESSAO: "Veículo:" existe em duas secoes com sentidos diferentes', () => {
  // Na secao de LMI "Veículo:" vale "Valor de Mercado Referenciado"; na de
  // FRANQUIAS vale "2.497,72 (Reduzida)". Sem recortar a secao, a franquia do
  // card sairia como um texto, ou o criterio de indenizacao viraria um numero.
  assert.equal(extrairLmi(linhas()).referencia_veiculo, 'Valor de Mercado Referenciado')
  assert.equal(extrairFranquias(linhas()).veiculo, 2497.72)
  assert.equal(extrairFranquias(linhas()).tipo, 'Reduzida')
})

test('REGRESSAO: "Nome:" do proponente nao pode virar o nome da corretora', () => {
  // "DADOS DO PROPONENTE" e "DADOS DO CORRETOR" usam o mesmo rotulo. Sem o
  // corte, o segurado do orcamento sairia como "CONVES CORRETORA DE SEGUROS".
  const cot = parse()
  assert.equal(cot.segurado.nome, 'NEUZA FRANCISCA DOS SANTOS LINS')
  assert.doesNotMatch(cot.segurado.nome, /CONVES|CORRETORA/i)
})

// ─── Identificacao ─────────────────────────────────────────────────────

test('reconhece o layout pelo CNPJ do emissor mais o titulo do documento', () => {
  assert.equal(ehLayoutBradesco(FX.texto), true)
  assert.equal(ehLayoutBradesco('Cotacao Porto Seguro 61.198.164/0001-60'), false)
})

// ─── Clausulas ─────────────────────────────────────────────────────────

test('le as 9 clausulas contratadas com codigo e nome', () => {
  const c = extrairClausulas(linhas())
  assert.equal(c.length, 9)
  const porCodigo = Object.fromEntries(c.map(x => [x.codigo, x.nome]))
  assert.equal(porCodigo['001'], 'Cobertura Compreensiva')
  assert.equal(porCodigo['060'], 'Auto Reserva 07 Dias')
  assert.equal(porCodigo['024'], 'Vidro Protegido Plus')
  assert.equal(porCodigo['113'], 'Assist Auto Dia/Noite - Passeio 400 KM')
})

test('a cobertura vem da lista de clausulas, nao do premio', () => {
  // No Bradesco um item contratado pode ter premio 0,00 (incluso no pacote).
  // Deduzir ausencia de premio zerado inventaria uma exclusao.
  const cot = parse()
  const reserva = cot.coberturas.find(c => c.codigo_seguradora === '060')
  assert.ok(reserva)
  assert.equal(reserva.incluida, true)
  assert.equal(reserva.categoria, 'carro_reserva')
})

// ─── Secoes de valores ─────────────────────────────────────────────────

test('LMI traz os tres limites de terceiros e o percentual da FIPE', () => {
  const lmi = extrairLmi(linhas())
  assert.equal(lmi.danos_materiais, 150000)
  assert.equal(lmi.danos_corporais, 150000)
  assert.equal(lmi.danos_morais, 5000)
  assert.equal(lmi.percentual_fipe, 100)
})

test('premios batem: liquido + IOF = total', () => {
  const p = extrairPremios(linhas())
  assert.equal(p.liquido, 1797.27)
  assert.equal(p.iof, 132.63)
  assert.equal(p.total, 1929.90)
  assert.equal(Math.round((p.liquido + p.iof) * 100) / 100, p.total)
})

test('moeda ignora traco e texto sem numero', () => {
  assert.equal(moeda('2.497,72 (Reduzida)'), 2497.72)
  assert.equal(moeda('Cobertura não contratada'), null)
  assert.equal(moeda('-'), null)
})

// ─── Formas de pagamento ───────────────────────────────────────────────

test('REGRESSAO: parcela e casada pela coluna, nao pela ordem das celulas', () => {
  // A linha de 12x so existe para o Cartao de Credito Bradesco: ela tem 2
  // celulas onde as outras linhas tem 8. Lida por posicao na lista, o 12x
  // seria atribuido ao Debito em Conta, e o card anunciaria 12x num meio de
  // pagamento que so vai ate 11x.
  const planos = Object.fromEntries(extrairPagamento(linhas()).map(p => [p.meio, p]))
  assert.equal(planos['Cartão de Crédito Bradesco'].maximo_sem_juros, 12)
  assert.equal(planos['Débito em Conta'].maximo_sem_juros, 11)
})

test('para de contar parcela sem juros quando o total sobe', () => {
  // No Carne o total salta de R$ 1.929,86 para R$ 2.223,45 a partir de 7x.
  const carne = extrairPagamento(linhas()).find(p => /Carn/i.test(p.meio))
  assert.equal(carne.maximo_sem_juros, 6)
  assert.equal(carne.valor_parcela, 321.64)
})

test('texto do pagamento sai legivel para o cliente', () => {
  const linhasTexto = textoPagamento(extrairPagamento(linhas()))
  assert.ok(linhasTexto.some(l => l === 'Cartão de Crédito Bradesco: até 12x de R$ 160,83 sem juros'), linhasTexto.join(' | '))
})

// ─── Identificacao do risco ────────────────────────────────────────────

test('condutor principal vem da secao propria, nao do proponente', () => {
  // O documento diz "Segurado é o principal condutor ? Não" — sao pessoas
  // diferentes, e o card mostra o CONDUTOR.
  const cot = parse()
  assert.equal(cot.condutor_principal.nome, 'BEATRIZ SANTOS LINS')
  assert.notEqual(cot.condutor_principal.nome, cot.segurado.nome)
})

test('traduz a resposta do questionario de 18-25 anos', () => {
  assert.equal(parse().veiculo.condutor_18_25, 'Sem cobertura')
})

test('identificacao do veiculo e da vigencia', () => {
  const cot = parse()
  assert.equal(cot.veiculo.placa, 'EKL6036')
  assert.equal(cot.veiculo.ano_modelo, '2009/2010')
  assert.equal(cot.veiculo.cep_pernoite, '03659-070')
  assert.match(cot.veiculo.marca_modelo, /CHEVROLET/)
  assert.equal(cot.vigencia.inicio, '2026-08-27')
  assert.equal(cot.vigencia.fim, '2027-08-27')
})

test('"Cia Renovação" preenchida significa renovacao congenere', () => {
  // O Bradesco nao escreve "Renovacao" com essa palavra em lugar nenhum.
  assert.equal(parse().cotacao.tipo_operacao, 'renovacao')
})

// ─── Integracao com o comparativo ──────────────────────────────────────

test('a cotacao Bradesco preenche as 7 categorias e pode ser gerada', () => {
  // Primeira das amostras que fecha sem bloqueio: e a unica que declara carro
  // reserva, a categoria que trava as cotacoes da familia Porto.
  const cot = parse()
  const { categorias } = montarCategorias(cot)
  for (const cat of categorias) {
    assert.equal(cat.estado, ESTADO_COBERTURA.INCLUIDA, `${cat.key}: ${cat.texto}`)
  }
  assert.ok(categorias.some(c => c.key === 'carro_reserva'))

  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, true, JSON.stringify(v.bloqueios))
  assert.equal(v.pendencias.length, 0, JSON.stringify(v.pendencias))
})

test('danos morais rende o texto dos tres limites de terceiros', () => {
  const terceiros = montarCategorias(parse()).categorias.find(c => c.key === 'terceiros')
  assert.match(terceiros.texto, /150\.000,00 danos materiais/)
  assert.match(terceiros.texto, /150\.000,00 danos corporais/)
  assert.match(terceiros.texto, /5\.000,00 danos morais/)
})

test('vidros traz a franquia por peca, como no modelo validado', () => {
  const vidros = montarCategorias(parse()).categorias.find(c => c.key === 'vidros')
  assert.match(vidros.texto, /para-brisa R\$ 314,00/)
  assert.match(vidros.texto, /lateral R\$ 233,00/)
})

test('blindagem nao contratada vira exclusao declarada, nao silencio', () => {
  const cot = parse()
  assert.ok(cot.nao_incluso.some(i => i.titulo === 'Blindagem'))
  assert.ok(montarCategorias(cot).naoIncluso.some(i => i.titulo === 'Blindagem'))
})

test('a logo e a cor vem do cadastro, nunca do PDF', () => {
  const cot = parseCotacaoBradesco({
    itens: FX.itens,
    texto: FX.texto,
    seguradoraMeta: { id: 'b1', nome_canonico: 'Bradesco Auto/RE', logo_url: 'https://cdn/b.png', cor_destaque: '#cc092f' },
  })
  assert.equal(cot.seguradora.logo_url, 'https://cdn/b.png')
  assert.equal(cot.seguradora.cor_destaque, '#cc092f')
})
