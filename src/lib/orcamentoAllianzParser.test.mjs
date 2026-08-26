import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas } from './pdfLayout.js'
import {
  parseCotacaoAllianz, ehLayoutAllianz, extrairNomesOfertas, blocosDeOfertas,
  extrairOfertas, extrairParcelamento, textoParcelamento, extrairFranquia,
  legendaAsteriscos, expandirSigla, moeda,
} from './orcamentoAllianzParser.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

// Fixture do PDF real recebido em 25/08/2026 (`documentos_automacao/orçamentos/ALLIANZ.pdf`),
// cotacao 493446723, VW Fox 2012, 6 paginas.
const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/allianz.json', import.meta.url)))
const linhas = () => agruparLinhas(FX.itens)
// `toLocaleString('pt-BR')` separa "R$" do numero com espaco NAO-QUEBRAVEL
// (U+00A0). Comparar contra um espaco comum falha com as duas strings parecendo
// identicas no diff — uma hora de caca a fantasma. Normalizado aqui.
const semNbsp = t => String(t).replace(/\u00a0/g, ' ')
const parse = oferta => parseCotacaoAllianz({ itens: FX.itens, texto: FX.texto, oferta })

test('reconhece o layout Allianz', () => {
  assert.equal(ehLayoutAllianz(FX.texto), true)
  assert.equal(ehLayoutAllianz('Orçamento Porto Seguro'), false)
})

test('moeda ignora o traco que a Allianz usa como "sem preco proprio"', () => {
  assert.equal(moeda('1.728,37'), 1728.37)
  assert.equal(moeda('-'), null)
  assert.equal(moeda(''), null)
})

// ─── As seis ofertas ───────────────────────────────────────────────────

test('le as seis ofertas na ordem, do cabecalho da tabela de parcelamento', () => {
  assert.deepEqual(extrairNomesOfertas(linhas()), [
    'Roubo e Furto', 'Básico', 'Ampliado', 'Completo', 'Master', 'Exclusivo',
  ])
})

// REGRESSAO: a frase que abre a secao ("...taxas de juros e valores de
// parcelas...") contem "juros" e "parcelas", e casava como se fosse o cabecalho
// da tabela. O resultado era uma lista de ofertas VAZIA, sem erro nenhum — e sem
// ofertas o parser devolvia uma cotacao sem premio e sem cobertura, como se o
// PDF nao tivesse nada dentro. O cabecalho e casado por CELULA, nao por linha.
test('REGRESSAO: a frase de abertura da secao nao e confundida com o cabecalho', () => {
  const nomes = extrairNomesOfertas(linhas())
  assert.ok(nomes.length === 6, 'as seis ofertas continuam sendo encontradas')
})

test('a tabela de coberturas vem em dois blocos de tres ofertas', () => {
  const blocos = blocosDeOfertas(linhas(), extrairNomesOfertas(linhas()))
  assert.equal(blocos.length, 2)
  assert.deepEqual(blocos[0].ofertas, [0, 1, 2])
  assert.deepEqual(blocos[1].ofertas, [3, 4, 5])
})

test('cada oferta tem premio proprio, e liquido + IOF fecha o total', () => {
  const ofertas = extrairOfertas(linhas())
  assert.equal(ofertas.length, 6)
  assert.deepEqual(ofertas.map(o => o.premio_total), [
    2453.03, 3982.08, 4085.23, 4236.87, 4450.50, 4866.50,
  ])
  for (const o of ofertas) {
    assert.equal(Math.round((o.premio_liquido + o.iof) * 100) / 100, o.premio_total, o.nome)
  }
})

// A leitura por pareamento sequencial existe justamente por causa disto: o LMI
// e o preco de uma mesma cobertura mudam de oferta para oferta, e trocar as
// colunas imprimiria o limite de uma oferta com o preco de outra.
test('LMI e preco acompanham a oferta, cobertura por cobertura', () => {
  const ofertas = extrairOfertas(linhas())
  const dm = i => ofertas[i].coberturas.find(c => /Danos Materiais/.test(c.nome_original_seguradora))

  assert.equal(dm(0).lmi_texto, '100.000,00')
  assert.equal(dm(0).preco, 885.64)
  assert.equal(dm(5).lmi_texto, '1.000.000,00')
  assert.equal(dm(5).preco, 1409.94)

  // O Casco e o caso que separa a oferta restrita das demais: R$ 395,83 na
  // "Roubo e Furto" contra R$ 1.728,37 em todas as outras cinco.
  const casco = i => ofertas[i].coberturas.find(c => /^Casco/.test(c.nome_original_seguradora))
  assert.equal(casco(0).preco, 395.83)
  for (const i of [1, 2, 3, 4, 5]) assert.equal(casco(i).preco, 1728.37)
})

test('as linhas de total nao sao lidas como cobertura', () => {
  const ofertas = extrairOfertas(linhas())
  for (const o of ofertas) {
    for (const c of o.coberturas) {
      assert.doesNotMatch(c.nome_original_seguradora, /Preço Líquido|Preço Total|IOF|Juros/)
    }
  }
  assert.equal(ofertas[0].coberturas.length, 11)
})

// ─── Inclusao: quem afirma a ausencia e o LMI, nao o preco ─────────────

// REGRESSAO (licao herdada do Bradesco): preco "-" nao e ausencia de cobertura.
// O Guincho 500 Km vem sem preco proprio nas seis ofertas por estar embutido no
// pacote. Deduzir exclusao a partir do preco tiraria a assistencia de reboque do
// card — cobertura que a apolice TEM sumindo do documento entregue ao cliente.
test('REGRESSAO: cobertura sem preco proprio continua incluida', () => {
  const guincho = extrairOfertas(linhas())[3].coberturas.find(c => /^Guincho/.test(c.nome_original_seguradora))
  assert.equal(guincho.preco, null)
  assert.equal(guincho.lmi_texto, '500 Km')
  assert.equal(guincho.incluida, true)
})

test('"Não Contratado" no LMI e negacao explicita', () => {
  const cr = extrairOfertas(linhas())[3].coberturas.find(c => /Carro Reserva/.test(c.nome_original_seguradora))
  assert.equal(cr.incluida, false)
})

// A Allianz e a primeira das amostras que NEGA carro reserva com todas as
// letras. Na familia Porto a categoria simplesmente nao e mencionada, e por isso
// trava a revisao. Aqui o estado tem de ser NAO_INCLUIDA, nao NAO_INFORMADO.
test('carro reserva negado no PDF vira NAO_INCLUIDA, e nao NAO_INFORMADO', () => {
  const { categorias } = montarCategorias(parse('Completo'))
  const cr = categorias.find(c => c.key === 'carro_reserva')
  assert.equal(cr.estado, ESTADO_COBERTURA.NAO_INCLUIDA)
})

// ─── Legenda dos asteriscos ────────────────────────────────────────────

test('le a legenda das siglas do rodape do proprio documento', () => {
  const legenda = legendaAsteriscos(FX.texto)
  assert.equal(legenda.get('RCF'), 'Responsabilidade Civil Facultativa')
  assert.equal(legenda.get('APP'), 'Acidentes Pessoais de Passageiros')
})

test('expandirSigla troca a sigla pelo que o documento diz que ela significa', () => {
  const legenda = legendaAsteriscos(FX.texto)
  assert.equal(
    expandirSigla('RCF** - Danos Materiais', legenda),
    'Responsabilidade Civil Facultativa - Danos Materiais',
  )
  assert.equal(
    expandirSigla('APP*** - Morte', legenda),
    'Acidentes Pessoais de Passageiros - Morte',
  )
  // Sem legenda, ao menos os asteriscos saem: sao marca de rodape, nunca parte
  // do nome da cobertura.
  assert.equal(expandirSigla('RCF** - Danos Materiais', new Map()), 'RCF - Danos Materiais')
  assert.equal(expandirSigla('Casco - Básica Compreensiva', legenda), 'Casco - Básica Compreensiva')
})

// REGRESSAO: com os asteriscos no nome, "rcf** - gastos com defesa" nao contem
// "responsabilidade civil" e "app*** - morte" nao contem "app morte" — as tres
// coberturas caiam sem classificacao e disparavam aviso na revisao em toda
// cotacao Allianz. Aviso que sempre aparece deixa de ser lido.
test('REGRESSAO: as tres coberturas com sigla sao classificadas', () => {
  const cot = parse('Completo')
  const por = nome => cot.coberturas.find(c => c.nome_original_seguradora.includes(nome))
  assert.equal(por('Danos Materiais').categoria, 'terceiros')
  assert.equal(por('Gastos com Defesa').categoria, 'terceiros')
  assert.equal(por('Morte').categoria, 'adicional')
  assert.equal(cot.coberturas.every(c => c.categoria), true, 'nenhuma cobertura sem categoria')
})

// ─── Campos escalares ──────────────────────────────────────────────────

test('extrai os dados do segurado, do veiculo e da vigencia', () => {
  const cot = parse('Completo')
  assert.equal(cot.cotacao.numero, '493446723')
  assert.equal(cot.cotacao.tipo_operacao, 'renovacao')
  assert.equal(cot.cotacao.validade, '2026-08-07')
  assert.equal(cot.cotacao.data_emissao, '2026-07-31')
  assert.equal(cot.segurado.nome, 'AGOSTINHO FERNANDES PERNA JUNIOR')
  assert.equal(cot.veiculo.marca_modelo, 'VOLKSWAGEN FOX 1.0 8v(G2)(TotalFlex) 2p')
  assert.equal(cot.veiculo.placa, 'EYD8891')
  assert.equal(cot.veiculo.ano_modelo, '2012')
  assert.equal(cot.veiculo.cep_pernoite, '07172-100')
  assert.equal(cot.veiculo.uso, 'Utilização Empresarial')
  assert.deepEqual(cot.vigencia, { inicio: '2026-08-30', fim: '2027-08-30' })
  assert.equal(cot.condicoes_gerais.referencia, '07/2026')
})

// REGRESSAO: "Nome:" aparece em SUAS INFORMACOES (o segurado) e em INFORMACOES
// DO CONDUTOR PRINCIPAL (o condutor). Sem o corte por secao, os dois campos
// sairiam com o mesmo nome e o card diria que quem dirige e quem contratou.
test('REGRESSAO: segurado e condutor principal sao pessoas diferentes', () => {
  const cot = parse('Completo')
  assert.equal(cot.segurado.nome, 'AGOSTINHO FERNANDES PERNA JUNIOR')
  assert.equal(cot.condutor_principal.nome, 'TATIANE FERNANDES PERNA')
  assert.equal(cot.condutor_principal.estado_civil, 'Solteiro[a]')
  assert.notEqual(cot.segurado.cpf_cnpj, cot.condutor_principal.cpf)
})

// REGRESSAO: a resposta sobre condutor jovem quebra em duas linhas fisicas
// ("Não. Estou" / "ciente que não haverá cobertura..."). Lida como celula, o
// campo saia "Não. Estou" — que nao e frase nenhuma e nao responde a pergunta.
test('REGRESSAO: a resposta sobre condutor de 18 a 25 anos nao sai cortada', () => {
  assert.equal(parse('Completo').veiculo.condutor_18_25, 'Sem cobertura')
})

test('a franquia vem da secao de participacao obrigatoria', () => {
  assert.deepEqual(extrairFranquia(linhas()), { tipo: '50% da Normal', valor: 3161.89 })
})

// REGRESSAO (mesma armadilha ja pega na HDI): o LMI do Casco e "100% FIPE", nao
// dinheiro. Formatado como moeda imprimia "Casco: R$ 100,00" no documento do
// cliente — um valor de indenizacao falso, e milhares de vezes menor que o real.
test('REGRESSAO: "100% FIPE" nao e formatado como moeda', () => {
  const cot = parse('Completo')
  const casco = cot.coberturas.find(c => /^Casco/.test(c.nome_original_seguradora))
  assert.match(casco.observacoes, /100% FIPE$/)
  assert.doesNotMatch(semNbsp(casco.observacoes), /R\$\s*100,00/)
  assert.deepEqual(cot.indenizacao_integral, { incluida: true, percentual_fipe: 100, observacao: '' })
})

// ─── Parcelamento ──────────────────────────────────────────────────────

test('o parcelamento e o da oferta escolhida, meio a meio', () => {
  assert.deepEqual(textoParcelamento(extrairParcelamento(linhas(), 3)).map(semNbsp), [
    'Boleto Bancário: à vista R$ 4.236,87',
    'Débito em Conta: até 6x de R$ 706,14 sem juros',
    'Cartão de Crédito: até 10x de R$ 423,68 sem juros',
  ])
})

// O boleto so e sem juros na parcela unica: da 2a em diante a coluna "Juros" diz
// 5,00%. Anunciar "ate 10x sem juros" no boleto seria propaganda falsa impressa.
test('o boleto para na parcela unica, porque da 2a em diante tem juros', () => {
  const boleto = extrairParcelamento(linhas(), 3).find(p => /Boleto/.test(p.meio))
  assert.equal(boleto.maximo_sem_juros, 1)
})

test('cada oferta tem a propria tabela de parcelas', () => {
  const barata = extrairParcelamento(linhas(), 0).find(p => /Cartão/.test(p.meio))
  const cara = extrairParcelamento(linhas(), 5).find(p => /Cartão/.test(p.meio))
  assert.equal(barata.valor_parcela, 245.30)
  assert.equal(cara.valor_parcela, 486.65)
})

// ─── A escolha da oferta ───────────────────────────────────────────────

// O PDF diz "o preco por cobertura da Oferta A SER CONTRATADA": nenhuma das seis
// vem marcada. Escolher por conta propria poria um premio errado num documento
// que vai para o cliente — entre a primeira e a ultima oferta ha R$ 2.413,47 de
// diferenca, e nada no card indicaria o erro.
test('sem oferta escolhida nao ha premio, e a geracao trava', () => {
  const cot = parse(null)
  assert.equal(cot.oferta, null)
  assert.equal(cot.valores.premio_total, null)
  assert.deepEqual(cot.coberturas, [])
  assert.equal(cot.escolha_pendente.campo, 'oferta')
  assert.equal(cot.escolha_pendente.opcoes.length, 6)
})

// A pendencia tem de ser UMA, e a verdadeira. Antes saiam oito, e as das
// categorias diziam "a cotacao nao informa" — mentira: a cotacao informa, seis
// vezes, uma por oferta.
test('a escolha pendente produz uma unica pendencia, e nao oito', () => {
  const v = validarCotacao(parse(null))
  assert.equal(v.podeGerar, false)
  assert.equal(v.bloqueios.length, 1)
  assert.match(v.bloqueios[0].label, /mais de uma oferta/i)
  assert.equal(v.bloqueios[0].opcoes.length, 6)
  assert.equal(v.pendencias.some(p => /não informa/i.test(p.label)), false)
})

test('as opcoes oferecidas na revisao ja trazem o preco de cada uma', () => {
  const opcoes = parse(null).escolha_pendente.opcoes
  assert.deepEqual(opcoes.map(o => o.nome), [
    'Roubo e Furto', 'Básico', 'Ampliado', 'Completo', 'Master', 'Exclusivo',
  ])
  assert.equal(opcoes[0].premio_total, 2453.03)
  assert.equal(opcoes[5].premio_total, 4866.50)
})

test('a oferta pode ser pedida por nome ou por indice, com ou sem acento', () => {
  assert.equal(parse('Completo').valores.premio_total, 4236.87)
  assert.equal(parse(3).valores.premio_total, 4236.87)
  assert.equal(parse('basico').valores.premio_total, 3982.08)
  assert.equal(parse('Oferta Inexistente').oferta, null)
})

// Mesmo sem oferta escolhida, o que NAO depende dela ja vem preenchido: o
// corretor ve tudo o que falta de uma vez, em vez de descobrir aos poucos.
test('os campos que independem da oferta vem preenchidos mesmo sem escolha', () => {
  const cot = parse(null)
  assert.equal(cot.segurado.nome, 'AGOSTINHO FERNANDES PERNA JUNIOR')
  assert.equal(cot.veiculo.placa, 'EYD8891')
  assert.equal(cot.valores.franquia, 3161.89)
  assert.equal(cot.condicoes_gerais.referencia, '07/2026')
})

// ─── Fecho: a cotacao inteira ──────────────────────────────────────────

test('com a oferta escolhida a cotacao fecha sem bloqueio nenhum', () => {
  const v = validarCotacao(parse('Completo'))
  assert.deepEqual(v.pendencias, [])
  assert.equal(v.podeGerar, true)
})

test('as sete categorias saem preenchidas, e nenhuma fica NAO_INFORMADO', () => {
  const { categorias } = montarCategorias(parse('Completo'))
  assert.equal(categorias.some(c => c.estado === ESTADO_COBERTURA.NAO_INFORMADO), false)
  for (const key of ['colisao', 'terceiros', 'assistencia', 'vidros']) {
    assert.equal(categorias.find(c => c.key === key).estado, ESTADO_COBERTURA.INCLUIDA, key)
  }
})

test('cada uma das seis ofertas fecha por si so', () => {
  for (const nome of ['Roubo e Furto', 'Básico', 'Ampliado', 'Completo', 'Master', 'Exclusivo']) {
    const v = validarCotacao(parse(nome))
    assert.equal(v.podeGerar, true, `${nome}: ${v.bloqueios.map(b => b.label).join(', ')}`)
  }
})
