import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { agruparLinhas, celulaEm, colunasPeloCabecalho, fatiar } from './pdfLayout.js'
import {
  parseCotacaoPorto, ehLayoutPorto, detectarMarca, detectarMarcaDetalhado,
  evidenciasMarcaPorto, marcaPortoPorId, MARCAS_PORTO, extrairCoberturas,
  extrairIndenizacaoIntegral, extrairValores, extrairAdicionais,
  extrairPagamento, moeda, percentual, humanizar,
} from './orcamentoPortoParser.js'
import { montarCategorias, validarCotacao, ESTADO_COBERTURA } from './orcamentoComparativo.js'

// Fixtures capturados dos PDFs reais recebidos em 25/08/2026
// (`documentos_automacao/orçamentos/`), com as coordenadas preservadas.
const FX = JSON.parse(fs.readFileSync(new URL('./__fixtures__/porto-familia.json', import.meta.url)))
const MARCAS = ['AZUL', 'ITAU', 'MITSUI']
const parse = nome => parseCotacaoPorto({ itens: FX[nome].itens, texto: FX[nome].texto })

// ─── pdfLayout ─────────────────────────────────────────────────────────

test('agruparLinhas junta pelo Y e ordena da esquerda para a direita', () => {
  const linhas = agruparLinhas([
    { texto: 'B', x: 200, y: 100, pagina: 1 },
    { texto: 'A', x: 60, y: 101, pagina: 1 },   // 1pt de diferenca = mesma linha
    { texto: 'C', x: 60, y: 80, pagina: 1 },
  ])
  assert.equal(linhas.length, 2)
  assert.equal(linhas[0].texto, 'A B')
  assert.equal(linhas[1].texto, 'C')
})

test('colunasPeloCabecalho exige o cabecalho inteiro', () => {
  const linhas = agruparLinhas([
    { texto: 'Franquia', x: 348, y: 500, pagina: 1 },   // so metade
    { texto: 'LMI', x: 265, y: 400, pagina: 1 },
    { texto: 'Franquia', x: 348, y: 400, pagina: 1 },
  ])
  assert.equal(colunasPeloCabecalho(linhas, { f: 'Franquia' }).f, 348)
  const duas = colunasPeloCabecalho(linhas, { lmi: 'LMI', f: 'Franquia' })
  assert.equal(duas.lmi, 265)
  assert.equal(duas.f, 348)
  assert.equal(colunasPeloCabecalho(linhas, { x: 'Inexistente' }), null)
})

test('fatiar recorta a secao entre dois marcadores', () => {
  const linhas = agruparLinhas([
    { texto: 'antes', x: 60, y: 300, pagina: 1 },
    { texto: 'COBERTURAS AUTO', x: 60, y: 200, pagina: 1 },
    { texto: 'meio', x: 60, y: 150, pagina: 1 },
    { texto: 'COBERTURAS RE', x: 60, y: 100, pagina: 1 },
  ])
  assert.deepEqual(fatiar(linhas, { de: 'COBERTURAS AUTO', ate: 'COBERTURAS RE' }).map(l => l.texto),
    ['COBERTURAS AUTO', 'meio'])
})

test('celulaEm pega a celula sob a coluna, nao a vizinha', () => {
  const [linha] = agruparLinhas([
    { texto: 'R$ 3.600,00', x: 338, y: 100, pagina: 1 },
    { texto: 'R$ 1.320,61', x: 525, y: 100, pagina: 1 },
  ])
  assert.equal(celulaEm(linha, 348), 'R$ 3.600,00')   // coluna Franquia
  assert.equal(celulaEm(linha, 522), 'R$ 1.320,61')   // coluna Premio
})

// ─── Numeros ───────────────────────────────────────────────────────────

test('moeda e percentual tratam o traco como ausencia, nao como zero', () => {
  assert.equal(moeda('R$ 3.600,00'), 3600)
  assert.equal(moeda('R$ 1.320,61'), 1320.61)
  assert.equal(moeda('-'), null)
  assert.equal(moeda('*'), null)
  assert.equal(moeda(''), null)
  assert.equal(percentual('100.00%'), 100)
  assert.equal(percentual('-'), null)
})

// ─── A regressao que motivou o parser posicional ───────────────────────

test('REGRESSAO: franquia e premio nao podem sair trocados', () => {
  // O texto plano do PDF entrega a linha do Casco assim:
  //   "COMPREENSIVA 100.00% R$ 1.320,61 0.00% 0.00% R$ 3.600,00"
  // Lida na ordem do cabecalho (LMI | Franquia | ... | Premio), a franquia
  // sairia R$ 1.320,61 e o premio R$ 3.600,00 — os dois invertidos. Pela
  // posicao real na pagina, franquia = R$ 3.600,00 e premio = R$ 1.320,61.
  // Franquia e um dos numeros que o cliente mais olha, e sairia errado num
  // documento entregue a ele.
  const cot = parse('AZUL')
  const casco = cot.coberturas.find(c => /compreensiva/i.test(c.nome_original_seguradora))
  assert.equal(casco.franquia, 3600)
  assert.equal(casco.premio, 1320.61)
  assert.equal(cot.valores.franquia, 3600)
})

// ─── Identificacao do layout ───────────────────────────────────────────

test('reconhece a familia pelo CNPJ do emissor, nao pelo nome da marca', () => {
  for (const m of MARCAS) assert.equal(ehLayoutPorto(FX[m].texto), true, m)
  assert.equal(ehLayoutPorto('Cotacao HDI Seguros'), false)
})

test('distingue as tres marcas dentro do mesmo layout', () => {
  assert.equal(detectarMarca(FX.AZUL.texto).id, 'azul')
  assert.equal(detectarMarca(FX.ITAU.texto).id, 'itau')
  assert.equal(detectarMarca(FX.MITSUI.texto).id, 'mitsui')
})

// ─── Coberturas ────────────────────────────────────────────────────────

test('o nome da cobertura vem inteiro, juntando a linha de continuacao', () => {
  // No PDF o nome quebra em duas linhas. Lendo so a linha de dados, o card do
  // cliente saia com "Danos aos Vidros e Retrovisores e".
  const vidros = parse('AZUL').coberturas.find(c => /vidros/i.test(c.nome_original_seguradora))
  assert.match(vidros.nome_original_seguradora, /FARÓIS E LANTERNAS - REFERENCIADA$/)
})

test('captura o rotulo do grupo que fica acima da linha', () => {
  const cot = parse('AZUL')
  assert.equal(cot.coberturas.find(c => /compreensiva/i.test(c.nome_original_seguradora)).grupo, 'Casco')
  assert.equal(cot.coberturas.find(c => /vidros/i.test(c.nome_original_seguradora)).grupo, 'Vidros')
})

test('as tres marcas trazem as mesmas 5 coberturas de auto', () => {
  for (const m of MARCAS) {
    const nomes = parse(m).coberturas.map(c => c.nome_original_seguradora).join(' | ')
    assert.equal(parse(m).coberturas.length, 5, `${m}: ${nomes}`)
    assert.match(nomes, /COMPREENSIVA/)
    assert.match(nomes, /RCF-V DANOS CORPORAIS/)
    assert.match(nomes, /RCF-V DANOS MATERIAIS/)
    assert.match(nomes, /CUSTOS DE DEFESA/)
  }
})

test('nao invade as coberturas RE (seguro residencial vendido junto)', () => {
  const nomes = parse('AZUL').coberturas.map(c => c.nome_original_seguradora).join(' ')
  assert.doesNotMatch(nomes, /INC[ÊE]NDIO, EXPLOS[ÃA]O/i)
  assert.doesNotMatch(nomes, /PAGAMENTO DE ALUGUEL/i)
})

// ─── Assistencia: cada marca batiza de um jeito ────────────────────────

test('acha a assistencia 24h nas tres marcas, apesar dos nomes diferentes', () => {
  assert.equal(parse('AZUL').assistencias[0].tipo, 'ASSISTÊNCIA GRATUITA - 200 KM')
  assert.equal(parse('ITAU').assistencias[0].tipo, 'ITAÚ ESSENCIAL 600 KM')
  assert.equal(parse('MITSUI').assistencias[0].tipo, '34 - REDE REFERENCIADA - 400KM')
})

test('beneficio sem quilometragem nao vira assistencia', () => {
  for (const m of MARCAS) {
    assert.ok(parse(m).servicos_adicionais.some(s => /EXTENS[ÃA]O DE PER[ÍI]METRO/i.test(s)), m)
    assert.ok(!parse(m).assistencias.some(a => /PER[ÍI]METRO/i.test(a.tipo)), m)
  }
})

test('o titulo da secao nao entra na lista como se fosse um item', () => {
  for (const m of MARCAS) {
    const todos = [...parse(m).assistencias.map(a => a.tipo), ...parse(m).servicos_adicionais]
    assert.ok(!todos.some(s => /COBERTURAS ADICIONAIS|ERTURAS/i.test(s)), `${m}: ${todos.join(' | ')}`)
  }
})

// ─── Campos fora da tabela ─────────────────────────────────────────────

test('indenizacao integral vem da frase, com o percentual da FIPE', () => {
  for (const m of MARCAS) {
    assert.deepEqual(parse(m).indenizacao_integral, { incluida: true, percentual_fipe: 100, observacao: '' })
  }
})

test('sem a frase da indenizacao integral o campo fica null, nunca false', () => {
  // `null` bloqueia a geracao; `false` afirmaria ao cliente que nao tem.
  assert.deepEqual(extrairIndenizacaoIntegral('cotacao sem essa frase'),
    { incluida: null, percentual_fipe: null, observacao: '' })
})

test('separa premio liquido, IOF e total do bloco unico', () => {
  assert.deepEqual(extrairValores(FX.AZUL.texto), { premio_liquido: 2683.72, iof: 198.06, premio_total: 2881.78 })
  const soma = 2683.72 + 198.06
  assert.equal(Math.round(soma * 100) / 100, 2881.78)
})

test('REGRESSAO: Azul, Itau e Mitsui levam o parcelamento do PDF para o comparativo', () => {
  const esperado = { AZUL: 10, ITAU: 5, MITSUI: 10 }
  for (const marca of MARCAS) {
    const linhas = extrairPagamento(FX[marca].texto)
    assert.match(linhas[0], new RegExp(`até ${esperado[marca]}x`), marca)
    assert.match(linhas.join(' '), /Boleto: à vista R\$\s*[\d.]+,\d{2}/, marca)
    assert.deepEqual(parse(marca).valores.premio_parcelado, linhas, marca)
  }
})

test('as tres cotacoes sao do mesmo risco com precos diferentes', () => {
  // Mesmo cliente, mesmo carro, cotado nas tres marcas no mesmo dia — e o que
  // permite conferir o parser cruzando os tres documentos.
  const cots = MARCAS.map(parse)
  for (const c of cots) {
    assert.equal(c.segurado.nome, 'DAVID MATEO RIOS CONDORENA')
    assert.equal(c.veiculo.placa, 'CSI3640')
    assert.equal(c.veiculo.cep_pernoite, '07183-320')
    assert.equal(c.vigencia.inicio, '2026-08-24')
    assert.equal(c.cotacao.tipo_operacao, 'novo')
  }
  const totais = cots.map(c => c.valores.premio_total)
  assert.equal(new Set(totais).size, 3, `precos deviam diferir: ${totais}`)
})

test('humanizar preserva sigla do ramo e minuscula preposicao', () => {
  assert.equal(humanizar('RCF-V DANOS CORPORAIS'), 'RCF-V Danos Corporais')
  assert.equal(humanizar('DANOS AOS VIDROS E RETROVISORES'), 'Danos aos Vidros e Retrovisores')
  assert.equal(humanizar('Cobertura Compreensiva'), 'Cobertura Compreensiva')  // ja mista, nao mexe
})

// ─── Integracao com o comparativo ──────────────────────────────────────

test('as coberturas extraidas chegam classificadas no card', () => {
  const { categorias } = montarCategorias(parse('AZUL'))
  const estado = key => categorias.find(c => c.key === key).estado
  for (const key of ['colisao', 'terceiros', 'assistencia', 'franquia', 'vidros']) {
    assert.equal(estado(key), ESTADO_COBERTURA.INCLUIDA, key)
  }
})

test('custos de defesa e cobertura de terceiros, nao beneficio adicional', () => {
  const { categorias } = montarCategorias(parse('ITAU'))
  assert.match(categorias.find(c => c.key === 'terceiros').texto, /Custos de Defesa/i)
  const adicional = categorias.find(c => c.key === 'adicional')
  if (adicional) assert.doesNotMatch(adicional.texto, /Custos de Defesa/i)
})

test('carro reserva ausente nas tres bloqueia a geracao', () => {
  // Nenhuma das tres cotacoes menciona carro reserva. O certo e BLOQUEAR ate o
  // corretor confirmar — nunca imprimir "nao tem" por conta propria.
  for (const m of MARCAS) {
    const cot = parse(m)
    assert.equal(montarCategorias(cot).categorias.find(c => c.key === 'carro_reserva').estado,
      ESTADO_COBERTURA.NAO_INFORMADO, m)
    const v = validarCotacao(cot)
    assert.equal(v.podeGerar, false, m)
    assert.ok(v.bloqueios.some(b => b.caminho === 'coberturas.carro_reserva'), m)
  }
})

test('a logo e a cor vem do cadastro, nunca do PDF', () => {
  const cot = parseCotacaoPorto({
    itens: FX.AZUL.itens,
    texto: FX.AZUL.texto,
    seguradoraMeta: { id: 'abc', nome_canonico: 'Azul Seguros', logo_url: 'https://cdn/azul.png', cor_destaque: '#0a58ca' },
  })
  assert.equal(cot.seguradora.id, 'abc')
  assert.equal(cot.seguradora.logo_url, 'https://cdn/azul.png')
  assert.equal(cot.seguradora.cor_destaque, '#0a58ca')
})

test('sem cadastro, cai para a marca lida do PDF em vez de ficar vazio', () => {
  assert.equal(parse('MITSUI').seguradora.nome, 'Mitsui Sumitomo Seguros')
  assert.equal(parse('MITSUI').seguradora.logo_url, '')
})


// ─── Identificacao da marca dentro da familia Porto ────────────────────
//
// Bug de 31/08/2026 relatado pelo usuario: uma cotacao da Porto e uma da Azul
// anexadas juntas sairam as duas como Azul Seguros no orcamento gerado. A causa
// era a varredura do documento INTEIRO em busca do nome da marca — e os quatro
// nomes aparecem em todos os PDFs da familia (origem do bonus "APOLICE PORTO,
// ITAU OU AZUL CANCELADA", "Desconto Correntista Itau", "Cartao Porto Bank" e o
// rodape da Porto em todas as paginas).

const CABECALHO_PORTO = 'Orçamento de Seguro Auto CNPJ: 61.198.164.0001/60 - Porto Seguro Orçamento válido'

/** Documento sintetico da familia, com os campos que identificam a marca. */
function documentoFamilia({ segmento, cg, sufixo, ruido = '' }) {
  return [
    CABECALHO_PORTO,
    `Orçamento: 6065143265-0-${sufixo} 08/09/2026 Realizado em 24/08/2026`,
    `Versão Condições Gerais: ${cg} ${segmento} e PROTEÇÃO COMBINADA v1.0`,
    'SEGURO Tipo de Operação SEGURO NOVO',
    `Segmento ${segmento} Sucursal - - - Apólice Item Bônus`,
    ruido,
  ].join(' ')
}

test('cada marca da familia e identificada pelo proprio campo Segmento', () => {
  for (const [nome, marca] of Object.entries({ AZUL: 'azul', ITAU: 'itau', MITSUI: 'mitsui' })) {
    assert.equal(detectarMarca(FX[nome].texto)?.id, marca, `${nome} deveria ser ${marca}`)
  }
})

test('cotacao da Porto nao vira Azul por causa das mencoes soltas no documento', () => {
  // Todo o ruido abaixo existe nos PDFs reais desta familia e era o que fazia a
  // deteccao antiga apontar Azul, Itau ou Mitsui num documento da Porto.
  const ruido = [
    'Origem do Bônus APÓLICE PORTO, ITAÚ OU AZUL CANCELADA',
    'Desconto Correntista Itaú: 5.00% Desconto Cartão Porto Bank - Proponente: 10.00%',
    'TODAS CARTÃO DE CRÉDITO PORTO BANK (EXISTENTE)',
    'Azul Seguro Auto e Itaú Seguro Auto são marcas licenciadas do grupo.',
    'Mitsui Sumitomo Seguros S.A. integra o mesmo grupo segurador.',
  ].join(' ')
  const porto = documentoFamilia({ segmento: 'PORTO SEGURO AUTO', cg: 'CG022', sufixo: 1, ruido })

  assert.equal(detectarMarca(porto)?.id, 'porto')
  assert.equal(detectarMarca(porto)?.nome, 'Porto Seguro')
})

test('a marca vem do campo, nao da ordem em que as marcas aparecem no texto', () => {
  const azul = documentoFamilia({
    segmento: 'AZUL TRADICIONAL', cg: 'CG023', sufixo: 4,
    ruido: 'PORTO SEGURO MITSUI SUMITOMO ITAÚ TRADICIONAL citados antes no rodapé.',
  })
  assert.equal(detectarMarca(azul)?.id, 'azul')
})

test('cabecalho Azul operado pela Porto continua sendo Azul', () => {
  const azul = [
    CABECALHO_PORTO,
    'azul OPERADO PELA PortoSeguro Orçamento de Seguro Auto',
    'AZUL TRADICIONAL e PROTEÇÃO COMBINADA',
    // O sufixo e deliberadamente igual ao do exemplo que antes gerava conflito.
    'Orçamento: 6065143265-0-1',
  ].join(' ')
  const detalhe = detectarMarcaDetalhado(azul)
  assert.equal(detalhe.marca?.id, 'azul')
  assert.equal(detalhe.fonte, 'produto_cabecalho')
  assert.equal(detalhe.conflito, null)
})

test('cabecalho Porto Auto Senior nao vira Azul pelo numero do orcamento', () => {
  const porto = [
    CABECALHO_PORTO,
    'PortoSeguro Orçamento de Seguro Auto',
    'AUTO SÊNIOR e PROTEÇÃO COMBINADA',
    // -0-4 era tratado como Azul; o produto visível no cabeçalho deve vencer.
    'Orçamento: 6065143265-0-4',
  ].join(' ')
  const detalhe = detectarMarcaDetalhado(porto)
  assert.equal(detalhe.marca?.id, 'porto')
  assert.equal(detalhe.fonte, 'produto_cabecalho')
  assert.equal(detalhe.conflito, null)
})

test('layout da familia sem nenhuma marca em campo cai na dona do layout', () => {
  // Porto e a emissora do layout; Azul, Itau e Mitsui so aparecem quando se
  // anunciam em campo proprio.
  const semMarca = `${CABECALHO_PORTO} Segmento TRADICIONAL Sucursal - - -`
  assert.equal(detectarMarca(semMarca)?.id, 'porto')
})

test('documento de outro layout continua sem marca', () => {
  assert.equal(detectarMarca('Cotação Tokio Marine Seguradora'), null)
  assert.equal(detectarMarca(''), null)
})

test('ITAU casa mesmo com o acento no fim da palavra', () => {
  // `\b` e ASCII: nao existe fronteira depois do "Ú", entao /\bITAÚ\b/ falha.
  assert.equal(marcaPortoPorId('itau').padrao.test('ITAÚ TRADICIONAL'), true)
  assert.equal(marcaPortoPorId('itau').padrao.test('ITAU TRADICIONAL'), true)
  // Continua sem casar no meio de outra palavra.
  assert.equal(marcaPortoPorId('itau').padrao.test('ITAUNENSE'), false)
})

test('as cinco fontes concordam nos PDFs reais das tres marcas capturadas', () => {
  for (const nome of MARCAS) {
    const evidencias = evidenciasMarcaPorto(FX[nome].texto)
    assert.ok(evidencias.length >= 3, `${nome} deveria ter varias evidencias`)
    assert.equal(detectarMarcaDetalhado(FX[nome].texto).conflito, null)
  }
})

test('campos discordando viram conflito em vez de escolha silenciosa', () => {
  const torto = documentoFamilia({ segmento: 'PORTO SEGURO AUTO', cg: 'CG023', sufixo: 4 })
  const detalhe = detectarMarcaDetalhado(torto)
  assert.equal(detalhe.marca.id, 'porto')        // Segmento manda
  assert.deepEqual(detalhe.conflito, ['porto', 'azul'])
})

// ─── Marca escolhida pelo operador ─────────────────────────────────────

test('a marca escolhida vence a deteccao e define a seguradora do orcamento', () => {
  const cot = parseCotacaoPorto({ itens: FX.AZUL.itens, texto: FX.AZUL.texto, marca_id: 'porto' })
  assert.equal(cot.seguradora.nome, 'Porto Seguro')
})

test('escolher marca diferente da anunciada avisa, mas nao bloqueia', () => {
  const cot = parseCotacaoPorto({ itens: FX.AZUL.itens, texto: FX.AZUL.texto, marca_id: 'itau' })
  const aviso = cot.avisos_extracao.find(a => a.code === 'MARCA_DIVERGENTE')
  assert.ok(aviso, 'deveria avisar a divergencia')
  assert.equal(aviso.bloqueia, false)
  assert.match(aviso.mensagem, /Itaú Seguros/)
  assert.match(aviso.mensagem, /Azul Seguros/)
})

test('escolher a marca que o PDF anuncia nao gera aviso nenhum', () => {
  const cot = parseCotacaoPorto({ itens: FX.AZUL.itens, texto: FX.AZUL.texto, marca_id: 'azul' })
  assert.deepEqual(cot.avisos_extracao, [])
  assert.equal(cot.seguradora.nome, 'Azul Seguros')
})

test('sem marca escolhida a leitura continua valendo, como antes', () => {
  const cot = parseCotacaoPorto({ itens: FX.MITSUI.itens, texto: FX.MITSUI.texto })
  assert.equal(cot.seguradora.nome, 'Mitsui Sumitomo Seguros')
  assert.equal(cot.marca_detectada, 'mitsui')
  assert.deepEqual(cot.avisos_extracao, [])
})

test('marca_id invalido e ignorado em vez de zerar a seguradora', () => {
  const cot = parseCotacaoPorto({ itens: FX.AZUL.itens, texto: FX.AZUL.texto, marca_id: 'seguradora-inexistente' })
  assert.equal(cot.seguradora.nome, 'Azul Seguros')
})

test('as quatro marcas da familia estao disponiveis para escolha', () => {
  assert.deepEqual(MARCAS_PORTO.map(m => m.id), ['porto', 'azul', 'itau', 'mitsui'])
  assert.equal(marcaPortoPorId('PORTO').nome, 'Porto Seguro')
  assert.equal(marcaPortoPorId(''), null)
})
