import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CATEGORIAS_COBERTURA,
  classificarCobertura,
  criarCotacaoOrcamento,
  detectarTipoOperacao,
  corDaSeguradora,
  distanciaCor,
  DISTANCIA_COR_MINIMA,
  ESTADO_COBERTURA,
  tomClaro,
  contrasteSobre,
  textoColisao,
  montarCard,
  montarComparativo,
  validarCotacao,
  formatarReferencia,
  formatarMoeda,
  normalizarTexto, casarSeguradora, textoTerceiros, extrairLimiteReboqueKm,
} from './orcamentoComparativo.js'

// ─── Dicionario de coberturas ──────────────────────────────────────────

test('classifica sinonimos de assistencia 24h de seguradoras diferentes', () => {
  for (const nome of ['Assistência 24 Horas', 'SOS Automóvel', 'Guincho / Reboque', 'Socorro Mecânico']) {
    assert.equal(classificarCobertura(nome), 'assistencia', `falhou em "${nome}"`)
  }
})

test('vidros vence casco quando os dois termos aparecem', () => {
  // "Casco + Vidros" tem que cair em vidros, senao a franquia por peca some do card.
  assert.equal(classificarCobertura('Cobertura de Casco + Vidros'), 'vidros')
  assert.equal(classificarCobertura('Vidros, retrovisores, lanternas e faróis'), 'vidros')
})

test('classifica RCF-V escrito de varias formas', () => {
  for (const nome of ['RCF-V Danos Materiais', 'Responsabilidade Civil Facultativa', 'Danos morais a terceiros']) {
    assert.equal(classificarCobertura(nome), 'terceiros', `falhou em "${nome}"`)
  }
})

test('classifica a cobertura principal das duas cotacoes reais', () => {
  assert.equal(classificarCobertura('Indenização por Valor Referenciado'), 'colisao')   // Tokio
  assert.equal(classificarCobertura('Cobertura Compreensiva'), 'colisao')                // Porto
})

test('nome desconhecido devolve null em vez de chutar categoria', () => {
  assert.equal(classificarCobertura('Cobertura Inventada XPTO'), null)
  assert.equal(classificarCobertura(''), null)
  assert.equal(classificarCobertura(null), null)
})

test('normalizarTexto remove acento sem apagar as letras', () => {
  // Regressao do bug do Code Node do n8n, onde o range de combinantes corrompido
  // apagava o texto inteiro.
  assert.equal(normalizarTexto('Assistência 24 Horas'), 'assistencia 24 horas')
  assert.equal(normalizarTexto('  RENOVAÇÃO   DA  CIA '), 'renovacao da cia')
})

test('extrai o limite de KM do reboque em formatos de seguradoras diferentes', () => {
  assert.equal(extrairLimiteReboqueKm('ASSISTÊNCIA GRATUITA - 200 KM'), 200)
  assert.equal(extrairLimiteReboqueKm('Assist Auto Dia/Noite - Passeio 400 KM'), 400)
  assert.equal(extrairLimiteReboqueKm('Plano 2 Serviços Reparo no local ou reboque: 500 Km'), 500)
  assert.equal(extrairLimiteReboqueKm('Proteção para Terceiros, guincho com KM ilimitado.'), 'Sem limite de KM')
  assert.equal(extrairLimiteReboqueKm('raio de guincho conforme selecionado'), null)
})

// ─── Tipo de operacao ──────────────────────────────────────────────────

test('reconhece o tipo de operacao como as seguradoras escrevem', () => {
  assert.equal(detectarTipoOperacao('Renovação Congênere'), 'renovacao')   // Tokio
  assert.equal(detectarTipoOperacao('RENOVAÇÃO DA CIA'), 'renovacao')      // Porto
  assert.equal(detectarTipoOperacao('Seguro Novo'), 'novo')
  assert.equal(detectarTipoOperacao('Endosso de inclusão'), 'endosso')
  assert.equal(detectarTipoOperacao('texto qualquer'), null)
})

// ─── Cores ─────────────────────────────────────────────────────────────

test('usa a cor cadastrada da seguradora quando existe', () => {
  assert.equal(corDaSeguradora({ nome: 'Qualquer', cor_destaque: '#AB12CD' }), '#ab12cd')
})

test('cai no mapa por nome canonico quando nao ha cor cadastrada', () => {
  assert.equal(corDaSeguradora({ nome: 'Tokio Marine' }), '#956e26')
  assert.equal(corDaSeguradora({ nome: 'PORTO SEGURO' }), '#1b4782')
})

// Os nomes abaixo sao as razoes sociais como aparecem nos PDFs de cotacao
// reais recebidos em 25/08/2026. Com casamento por igualdade exata nenhum
// deles achava a cor e todos caiam no fallback POR PAPEL — a cor da seguradora
// mudava conforme ela fosse a "atual" ou a "outra" no comparativo.
test('acha a cor mesmo quando o nome canonico traz a razao social inteira', () => {
  assert.equal(corDaSeguradora({ nome: 'Mitsui Sumitomo Seguros S.A.' }), '#201060')
  assert.equal(corDaSeguradora({ nome: 'Allianz Seguros S.A.' }), '#003781')
  assert.equal(corDaSeguradora({ nome: 'HDI SEGUROS S.A.' }), '#00723f')
  assert.equal(corDaSeguradora({ nome: 'SUHAI SEGURADORA S.A.' }), '#6b2fa0')
  assert.equal(corDaSeguradora({ nome: 'Yelum Seguros S.A.' }), '#00a0af')
  assert.equal(corDaSeguradora({ nome: 'Bradesco Auto/RE Companhia de Seguros' }), '#cc092f')
})

test('avisa quando as duas seguradoras tem cores parecidas demais', () => {
  // Porto (#1b4782) e Allianz (#003781) sao os dois azul-marinho: da 50 numa
  // escala onde o par ja validado Tokio x Porto da 252. Bradesco e Mapfre sao
  // os dois vermelhos e dao 23. Nos dois casos a faixa colorida deixa de dizer
  // de relance qual card e de quem, que e a unica funcao dela no documento.
  const comparativo = montarComparativo({
    atual: criarCotacaoOrcamento({ seguradora: { nome: 'Porto Seguro' } }),
    outra: criarCotacaoOrcamento({ seguradora: { nome: 'Allianz Seguros S.A.' } }),
  })
  assert.ok(comparativo.cores_proximas, 'devia ter avisado')
  assert.ok(comparativo.cores_proximas.distancia < DISTANCIA_COR_MINIMA)
  assert.match(comparativo.cores_proximas.mensagem, /Porto Seguro/)

  // Nao pode bloquear: e problema de cadastro, nao de extracao. O aviso vive
  // fora de `validacao`, entao nenhum bloqueio pode falar de cor.
  const bloqueios = [
    ...comparativo.validacao.atual.bloqueios,
    ...comparativo.validacao.outra.bloqueios,
  ]
  assert.equal(bloqueios.some(b => /cor/i.test(b.mensagem || '')), false)
})

test('nao avisa quando as cores dao para diferenciar', () => {
  const comparativo = montarComparativo({
    atual: criarCotacaoOrcamento({ seguradora: { nome: 'Tokio Marine' } }),
    outra: criarCotacaoOrcamento({ seguradora: { nome: 'Porto Seguro' } }),
  })
  assert.equal(comparativo.cores_proximas, null)
})

test('os dois rosas provisorios de Darwin e Pier dao para diferenciar', () => {
  // Foram escolhidos afastados de proposito justamente por isso; se alguem
  // trocar por dois rosas vizinhos, este teste avisa antes do cliente.
  const comparativo = montarComparativo({
    atual: criarCotacaoOrcamento({ seguradora: { nome: 'Darwin Seguros' } }),
    outra: criarCotacaoOrcamento({ seguradora: { nome: 'Pier Seguros' } }),
  })
  assert.equal(comparativo.cores_proximas, null)
})

test('a cor nao depende do papel no comparativo', () => {
  // Regra do modulo: inverter atual/outra nao pode trocar as cores. Uma
  // seguradora conhecida tem que devolver o mesmo hex nos dois papeis.
  for (const nome of ['Mitsui Sumitomo Seguros S.A.', 'Itaú Seguros', 'Azul Seguros']) {
    assert.equal(
      corDaSeguradora({ nome }, 'atual'),
      corDaSeguradora({ nome }, 'outra'),
      `${nome} mudou de cor conforme o papel`,
    )
  }
})

test('seguradora desconhecida cai no fallback pelo papel', () => {
  assert.equal(corDaSeguradora({ nome: 'Seguradora Nova' }, 'atual'), '#956e26')
  assert.equal(corDaSeguradora({ nome: 'Seguradora Nova' }, 'outra'), '#1b4782')
})

test('tomClaro reproduz os tons do mockup validado', () => {
  // No mockup o numerao da Tokio sai claro sobre o navy; o importante e o tom
  // continuar legivel (bem mais claro que a cor cheia), nao o hex exato.
  const claro = tomClaro('#956e26')
  assert.match(claro, /^#[0-9a-f]{6}$/)
  assert.ok(parseInt(claro.slice(1, 3), 16) > 0x95)
})

test('contraste escolhe texto branco sobre cor escura e tinta sobre clara', () => {
  assert.equal(contrasteSobre('#1b4782'), '#ffffff')
  assert.equal(contrasteSobre('#ffd400'), '#101f33')
})

// ─── Indenizacao integral: o campo critico ─────────────────────────────

test('indenizacao integral inclusa nomeia o percentual da FIPE', () => {
  const cot = criarCotacaoOrcamento()
  cot.indenizacao_integral = { incluida: true, percentual_fipe: 100, observacao: '' }
  assert.match(textoColisao(cot), /inclusa a 100% da tabela FIPE/)
})

test('indenizacao integral ausente e dita com todas as letras', () => {
  const cot = criarCotacaoOrcamento()
  cot.indenizacao_integral = { incluida: false, percentual_fipe: null, observacao: '' }
  assert.match(textoColisao(cot), /não possui \(somente parcial, com franquia\)/)
})

test('indenizacao integral nao confirmada nao vira texto nenhum', () => {
  // Nunca inventar a favor da seguradora: sem confirmacao, silencio (e a
  // validacao abaixo impede gerar o PDF nesse estado).
  const cot = criarCotacaoOrcamento()
  assert.doesNotMatch(textoColisao(cot), /integral/)
})

test('indenizacao integral nao confirmada bloqueia a geracao', () => {
  const cot = cotacaoCompleta()
  cot.indenizacao_integral = { incluida: null, percentual_fipe: null, observacao: '' }
  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, false)
  assert.ok(v.bloqueios.some(b => b.caminho === 'indenizacao_integral.incluida'))
})

// ─── Validacao ─────────────────────────────────────────────────────────

function cotacaoCompleta(patch = {}) {
  const cot = criarCotacaoOrcamento()
  cot.seguradora = { id: 'x', nome: 'Tokio Marine', logo_url: 'logo.png', cor_destaque: '' }
  cot.cotacao = { numero: '1056418301', tipo_operacao: 'renovacao', validade: '2026-08-29', data_emissao: '2026-08-24' }
  cot.segurado = { nome: 'Priscila Cunha dos Santos', cpf_cnpj: '000', data_nascimento: null }
  cot.condutor_principal = { nome: 'Aguinosvan A. dos Santos', cpf: '111', estado_civil: null }
  cot.veiculo = {
    marca_modelo: 'Ford EcoSport SE 1.5 12V Flex Aut.', ano_modelo: '2018/2018',
    placa: 'GAO-1151', uso: 'Particular, sem fim comercial',
    cep_pernoite: '04849-015', condutor_18_25: 'Sem cobertura',
  }
  cot.valores = {
    premio_liquido: 4200, iof: 460.7, premio_total: 4660.7,
    premio_parcelado: 'Em até 12x sem juros no cartão (R$ 388,29)',
    descontos_aplicados: [], franquia: 3373, franquia_tipo: 'Parcial reduzida a 50%',
  }
  cot.indenizacao_integral = { incluida: false, percentual_fipe: null, observacao: 'Indenização por Valor Referenciado — 100% da tabela FIPE.' }
  // As 6 categorias fixas, com o texto que o card da Tokio traz no mockup
  // validado. Antes dos tres estados este fixture nao declarava cobertura
  // nenhuma e ainda assim "passava": as linhas simplesmente sumiam do PDF.
  // Agora uma cotacao so e completa quando diz, de cada categoria, se tem ou
  // nao tem — que e a regra que o documento entregue ao cliente precisa cumprir.
  cot.coberturas = [
    { nome_padronizado: 'Danos a terceiros (RCF-V)', incluida: true, categoria: 'terceiros',
      observacoes: 'R$ 150.000 danos materiais + R$ 150.000 danos corporais + R$ 5.000 danos morais.' },
    { nome_padronizado: 'Carro reserva', incluida: true, categoria: 'carro_reserva',
      observacoes: '7 diárias, categoria básica (mecânico).' },
    { nome_padronizado: 'Vidros', incluida: true, categoria: 'vidros',
      observacoes: 'Cobertura completa — franquia por peça (para-brisa R$ 365, retrovisor R$ 380).' },
  ]
  cot.assistencias = [
    { tipo: 'Assistência 24 Horas', incluida: true,
      detalhes: 'Completa, com guincho — reboque de até 500 km por acionamento.' },
  ]
  return Object.assign(cot, patch)
}

test('cotacao completa passa na validacao', () => {
  const v = validarCotacao(cotacaoCompleta())
  assert.equal(v.podeGerar, true, JSON.stringify(v.bloqueios))
})

test('premio total ausente bloqueia', () => {
  const cot = cotacaoCompleta()
  cot.valores.premio_total = null
  assert.equal(validarCotacao(cot).podeGerar, false)
})

test('parcelamento e franquia ausentes bloqueiam o documento do cliente', () => {
  for (const caminho of ['premio_parcelado', 'franquia', 'franquia_tipo']) {
    const cot = cotacaoCompleta()
    cot.valores[caminho] = caminho === 'franquia' ? null : ''
    assert.equal(validarCotacao(cot).podeGerar, false, caminho)
  }
})

test('assistencia inclusa sem limite de reboque bloqueia a geracao', () => {
  const cot = cotacaoCompleta()
  cot.assistencias = [{ tipo: 'Assistência 24 Horas', incluida: true, detalhes: 'Serviços de guincho e pane.' }]
  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, false)
  assert.ok(v.bloqueios.some(b => b.caminho === 'assistencia_24h.limite_reboque_km'))
})

test('danos a terceiros usa o LMI estruturado e sempre o formata em dinheiro', () => {
  const texto = textoTerceiros([{
    nome_original_seguradora: 'Danos Materiais',
    valor_lmi: 150000,
    observacoes: 'Danos causados a terceiros',
  }])
  assert.match(texto, /Danos Materiais: R\$\s*150\.000,00/)
})

test('percentual nao vale como limite monetario de danos a terceiros', () => {
  const cot = cotacaoCompleta()
  cot.coberturas = cot.coberturas.map(item => item.categoria === 'terceiros'
    ? { ...item, valor_lmi: null, observacoes: 'Cobertura para terceiros: 100%' }
    : item)
  assert.equal(validarCotacao(cot).podeGerar, false)
})

test('revisao pode confirmar que danos a terceiros nao estao inclusos', () => {
  const cot = cotacaoCompleta()
  cot.textos_revisados = { terceiros: 'Não incluso nesta cotação.' }
  const terceiros = montarCard(cot).categorias.find(item => item.key === 'terceiros')
  assert.equal(terceiros.estado, ESTADO_COBERTURA.NAO_INCLUIDA)
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('tipo de operacao ausente bloqueia', () => {
  const cot = cotacaoCompleta()
  cot.cotacao.tipo_operacao = ''
  assert.equal(validarCotacao(cot).podeGerar, false)
})

test('campo de atencao nao bloqueia, mas aparece na lista', () => {
  const cot = cotacaoCompleta()
  cot.veiculo.placa = ''
  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, true)
  assert.ok(v.pendencias.some(p => p.caminho === 'veiculo.placa' && p.severidade === 'atencao'))
})

test('cobertura nao classificada e reportada sem bloquear', () => {
  const cot = cotacaoCompleta()
  cot.coberturas.push({ nome_padronizado: 'Cobertura Inventada XPTO', incluida: true, categoria: null })
  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, true)
  assert.ok(v.pendencias.some(p => /não classificada/.test(p.label)))
})

// ─── Montagem do card ──────────────────────────────────────────────────

test('cobertura nao inclusa sai das categorias e vai para "nao incluso"', () => {
  const cot = cotacaoCompleta()
  cot.coberturas = [
    { nome_padronizado: 'Assistência 24 Horas', incluida: true, categoria: null, observacoes: 'Reboque de até 500 km.' },
    { nome_padronizado: 'Acidentes Pessoais de Passageiros', incluida: false, categoria: null, observacoes: 'Não contratados.' },
  ]
  const card = montarCard(cot)
  const assistencia = card.categorias.find(c => c.key === 'assistencia')
  assert.match(assistencia.texto, /500 km/)
  assert.ok(card.nao_incluso.some(i => i.titulo === 'Acidentes Pessoais de Passageiros'))
  // e nao pode ter vazado para nenhuma categoria
  assert.ok(!card.categorias.some(c => c.itens.some(i => i.nome_padronizado === 'Acidentes Pessoais de Passageiros')))
})

test('cobertura inclusa sem categoria reconhecida cai em adicional', () => {
  const cot = cotacaoCompleta()
  cot.coberturas = [{ nome_padronizado: 'Cobertura Inventada XPTO', incluida: true, categoria: null, observacoes: 'detalhe' }]
  const card = montarCard(cot)
  assert.ok(card.categorias.find(c => c.key === 'adicional'))
})

test('categoria adicional some do card quando nao ha nada nela', () => {
  const card = montarCard(cotacaoCompleta())
  assert.equal(card.categorias.find(c => c.key === 'adicional'), undefined)
})

test('as 6 categorias fixas sempre aparecem, na mesma ordem, nos dois cards', () => {
  const fixas = CATEGORIAS_COBERTURA.filter(c => c.key !== 'adicional').map(c => c.key)
  const a = montarCard(cotacaoCompleta(), { papel: 'atual' })
  const b = montarCard(cotacaoCompleta(), { papel: 'outra' })
  for (const card of [a, b]) {
    assert.deepEqual(card.categorias.filter(c => c.key !== 'adicional').map(c => c.key), fixas)
  }
})

// ─── Os tres estados ───────────────────────────────────────────────────

test('cobertura negada pela cotacao vira NAO INCLUIDA na propria linha', () => {
  // "Carro reserva" negado tem que aparecer na LINHA de carro reserva dizendo
  // que nao tem — nao sumir da lista e reaparecer so no painel do rodape.
  const cot = cotacaoCompleta()
  cot.coberturas = cot.coberturas.filter(c => c.categoria !== 'carro_reserva')
  cot.nao_incluso = [{ titulo: 'Carro reserva', detalhe: 'Não contratado nesta cotação.' }]

  const card = montarCard(cot)
  const reserva = card.categorias.find(c => c.key === 'carro_reserva')
  assert.equal(reserva.estado, ESTADO_COBERTURA.NAO_INCLUIDA)
  assert.match(reserva.texto, /Não contratado/)
  // e nao pode ficar duplicado no painel
  assert.ok(!card.nao_incluso.some(i => i.titulo === 'Carro reserva'))
  // negar cobertura nao impede gerar: a cotacao se pronunciou
  assert.equal(validarCotacao(cot).podeGerar, true)
})

test('categoria que a cotacao nao menciona bloqueia a geracao', () => {
  const cot = cotacaoCompleta()
  cot.coberturas = cot.coberturas.filter(c => c.categoria !== 'vidros')

  const card = montarCard(cot)
  const vidros = card.categorias.find(c => c.key === 'vidros')
  assert.equal(vidros.estado, ESTADO_COBERTURA.NAO_INFORMADO)

  const v = validarCotacao(cot)
  assert.equal(v.podeGerar, false)
  assert.ok(v.bloqueios.some(b => b.caminho === 'coberturas.vidros'))
})

test('as 6 linhas saem nos dois cards mesmo quando um lado nao tem a cobertura', () => {
  // O motivo de o comparativo existir: as linhas tem que alinhar lado a lado.
  // Antes, a categoria sem dado sumia de um card so e tudo desalinhava.
  const completa = cotacaoCompleta()
  const semReserva = cotacaoCompleta()
  semReserva.coberturas = semReserva.coberturas.filter(c => c.categoria !== 'carro_reserva')
  semReserva.nao_incluso = [{ titulo: 'Carro reserva', detalhe: 'Não contratado.' }]

  const [a, b] = montarComparativo({ atual: completa, outra: semReserva }).cards
  const chaves = card => card.categorias.map(c => c.key)
  assert.deepEqual(chaves(a), chaves(b))
  assert.equal(a.categorias.find(c => c.key === 'carro_reserva').estado, ESTADO_COBERTURA.INCLUIDA)
  assert.equal(b.categorias.find(c => c.key === 'carro_reserva').estado, ESTADO_COBERTURA.NAO_INCLUIDA)
})

test('"Beneficios adicionais" continua podendo sumir — ausencia nao e lacuna', () => {
  const card = montarCard(cotacaoCompleta())
  assert.ok(!card.categorias.some(c => c.key === 'adicional'))
  assert.equal(validarCotacao(cotacaoCompleta()).podeGerar, true)
})

test('a franquia usa tipo e valor do bloco de valores', () => {
  const card = montarCard(cotacaoCompleta())
  const franquia = card.categorias.find(c => c.key === 'franquia')
  assert.match(franquia.texto, /Parcial reduzida a 50%/)
  assert.match(franquia.texto, /3\.373,00/)
})

test('rodape cita as condicoes gerais e o numero da cotacao', () => {
  const cot = cotacaoCompleta()
  cot.condicoes_gerais = { referencia: 'Porto Seguro Auto Sênior CG144', anexada_em: '2026-08-17' }
  assert.equal(montarCard(cot).rodape, 'Porto Seguro Auto Sênior CG144, anexada em 17/08/2026 · Cotação nº 1056418301')
})

test('seguradora sem condicoes gerais nao trava o card (spec secao 8)', () => {
  const card = montarCard(cotacaoCompleta())
  assert.equal(card.rodape, 'Cotação nº 1056418301')
})

// ─── Comparativo ───────────────────────────────────────────────────────

test('comparativo monta dois cards e a barra unica do cliente', () => {
  const atual = cotacaoCompleta()
  const outra = cotacaoCompleta()
  outra.seguradora = { id: 'y', nome: 'Porto Seguro', logo_url: 'p.png', cor_destaque: '' }
  outra.condutor_principal.nome = 'José Antônio dos Santos'
  outra.valores.premio_total = 5970.31

  const comp = montarComparativo({ atual, outra, referencia: 'CV-2026-0817', emitidoEm: '2026-08-24' })

  assert.equal(comp.cards.length, 2)
  assert.equal(comp.cards[0].seguradora.cor, '#956e26')
  assert.equal(comp.cards[1].seguradora.cor, '#1b4782')
  assert.equal(comp.cliente.segurado, 'Priscila Cunha dos Santos')
  assert.equal(comp.cliente.placa, 'GAO-1151')
  assert.equal(comp.cliente.tipo_operacao_label, 'Renovação')
  assert.equal(comp.cards[1].valores.total_formatado, formatarMoeda(5970.31))
  assert.equal(comp.validacao.podeGerar, true)
})

test('comparativo aponta divergencia de placa entre os dois PDFs', () => {
  // Upload trocado: duas cotacoes de veiculos diferentes no mesmo comparativo.
  const atual = cotacaoCompleta()
  const outra = cotacaoCompleta()
  outra.veiculo.placa = 'XXX-0000'
  const comp = montarComparativo({ atual, outra })
  assert.ok(comp.divergencias.some(d => d.caminho === 'veiculo.placa'))
})

test('comparativo nao pode ser gerado se um dos lados tem bloqueio', () => {
  const atual = cotacaoCompleta()
  const outra = cotacaoCompleta()
  outra.valores.premio_total = null
  assert.equal(montarComparativo({ atual, outra }).validacao.podeGerar, false)
})

test('referencia interna segue o formato CV-AAAA-NNNN do mockup', () => {
  assert.equal(formatarReferencia(2026, 817), 'CV-2026-0817')
  assert.equal(formatarReferencia(2026, 1), 'CV-2026-0001')
})

test('nao repete a indenizacao integral quando a observacao ja falava dela', () => {
  // A Porto embute "indenizacao integral a 100% da FIPE" dentro do proprio texto
  // da cobertura compreensiva. Sem o filtro, o card dizia duas vezes.
  const cot = criarCotacaoOrcamento()
  cot.indenizacao_integral = {
    incluida: true, percentual_fipe: 100,
    observacao: 'Cobertura Compreensiva — indenização integral inclusa a 100% da tabela FIPE.',
  }
  const texto = textoColisao(cot)
  assert.equal(texto.match(/indenização integral/gi)?.length, 1, texto)
})

// ─── Casamento com o cadastro de seguradoras (logo no PDF) ──────────────

test('REGRESSAO: casa o nome comercial do parser com a razao social do cadastro', () => {
  // Sem isso nenhuma logo era encontrada e todo card caia no nome em serifada.
  const catalogo = [
    { id: '1', nome_canonico: 'HDI SEGUROS S.A.', logo_url: '/hdi.png', aliases: [] },
    { id: '2', nome_canonico: 'Bradesco Auto/RE Companhia de Seguros', logo_url: '/b.png', aliases: [] },
    { id: '3', nome_canonico: 'Pier Seguradora S.A.', logo_url: '/p.png', aliases: ['Pier'] },
  ]
  assert.equal(casarSeguradora(catalogo, 'HDI Seguros')?.id, '1')
  assert.equal(casarSeguradora(catalogo, 'Bradesco Seguros')?.id, undefined) // nao contido nos dois sentidos
  assert.equal(casarSeguradora(catalogo, 'Pier')?.id, '3')
  assert.equal(casarSeguradora(catalogo, 'Pier Seguradora S.A.')?.id, '3')
})

test('nao casa quando nao ha relacao entre os nomes', () => {
  const catalogo = [{ id: '1', nome_canonico: 'Tokio Marine Seguradora', logo_url: '', aliases: [] }]
  assert.equal(casarSeguradora(catalogo, 'Allianz Seguros'), null)
  assert.equal(casarSeguradora(catalogo, ''), null)
  assert.equal(casarSeguradora([], 'Tokio'), null)
})

test('prefere o cadastro mais longo, nao um generico contido em tudo', () => {
  const catalogo = [
    { id: 'generico', nome_canonico: 'Seguros', aliases: [] },
    { id: 'certo', nome_canonico: 'Itau Seguros', aliases: [] },
  ]
  assert.equal(casarSeguradora(catalogo, 'Itau Seguros Auto')?.id, 'certo')
})
