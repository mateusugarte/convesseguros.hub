import test from 'node:test'
import assert from 'node:assert/strict'

const {
  parseMoneyBR,
  parseDateBR,
  extrairPlaca,
  extrairChassi,
  extrairVigencia,
  extrairParcelamento,
  extrairFormaPagamento,
  extrairPctComissao,
  extrairCep,
  extrairCondutor,
  detectarSeguradora,
  parseOrcamentoAutoText,
  parsePropostaAutoText,
} = await import('./autoPdfParser.js')

// ─── Normalizadores ────────────────────────────────────────────────────

test('parseMoneyBR entende o formato pt-BR e nao quebra o formato com ponto decimal', () => {
  assert.equal(parseMoneyBR('3.450,00'), 3450)
  assert.equal(parseMoneyBR('1.234.567,89'), 1234567.89)
  assert.equal(parseMoneyBR('12,5'), 12.5)
  // Percentuais as vezes ja vem com ponto decimal no PDF — nao pode virar 125.
  assert.equal(parseMoneyBR('12.5'), 12.5)
  assert.equal(parseMoneyBR(''), null)
})

test('parseDateBR completa ano de 2 digitos', () => {
  assert.equal(parseDateBR('05/03/2026'), '2026-03-05')
  assert.equal(parseDateBR('05/03/26'), '2026-03-05')
  assert.equal(parseDateBR(''), '')
})

// ─── Placa ─────────────────────────────────────────────────────────────

test('extrairPlaca aceita Mercosul e o formato antigo', () => {
  assert.equal(extrairPlaca('Placa: ABC1D23 Chassi'), 'ABC1D23')
  assert.equal(extrairPlaca('Placa: ABC-1234'), 'ABC1234')
  assert.equal(extrairPlaca('PLACA DO VEICULO: XYZ9A88'), 'XYZ9A88')
})

test('extrairPlaca nao devolve o comeco de um chassi como placa', () => {
  // Regressao: um chassi tem 17 caracteres e seus 7 primeiros casam com o
  // formato de placa. Sem remover os chassis antes, a busca solta devolvia lixo.
  const texto = 'DADOS DO VEICULO Chassi 9BW1D23456789012 Ano 2022'
  assert.equal(extrairPlaca(texto), null)
})

test('extrairPlaca prioriza o rotulo sobre qualquer token parecido antes dele', () => {
  // O numero da cotacao vem antes e casa com o formato de placa por acidente.
  const texto = 'Cotacao ABC1D99 emitida em 01/02/2026 Placa: XYZ2B34'
  assert.equal(extrairPlaca(texto), 'XYZ2B34')
})

test('extrairChassi respeita o alfabeto de chassi (sem I, O, Q)', () => {
  assert.equal(extrairChassi('Chassi: 9BWZZZ377VT004251'), '9BWZZZ377VT004251')
})

// ─── Vigencia ──────────────────────────────────────────────────────────

test('extrairVigencia entende intervalo explicito', () => {
  const v = extrairVigencia('VIGENCIA 01/03/2026 a 01/03/2027')
  assert.equal(v.inicio, '2026-03-01')
  assert.equal(v.fim, '2027-03-01')
})

test('extrairVigencia entende o jargao de 24 horas', () => {
  const v = extrairVigencia('Vigencia: a partir das 24 horas do dia 15/04/2026 ate as 24 horas do dia 15/04/2027')
  assert.equal(v.inicio, '2026-04-15')
  assert.equal(v.fim, '2027-04-15')
})

test('extrairVigencia entende rotulos separados', () => {
  const v = extrairVigencia('Inicio de vigencia: 10/01/2026 Termino de vigencia: 10/01/2027')
  assert.equal(v.inicio, '2026-01-10')
  assert.equal(v.fim, '2027-01-10')
})

// ─── Valores ───────────────────────────────────────────────────────────

test('extrairParcelamento monta a descricao com valor da parcela', () => {
  assert.equal(extrairParcelamento('Parcelamento: 10x de R$ 250,00 sem juros'), '10x de R$ 250,00 sem juros')
  assert.equal(extrairParcelamento('Pagamento a vista'), 'À vista')
})

test('extrairFormaPagamento ignora mencao solta no rodape quando existe rotulo', () => {
  // "boleto" aparece nas condicoes gerais de quase todo PDF; a forma escolhida
  // nesta cotacao e a que esta ao lado do rotulo.
  const texto = 'Forma de pagamento: Cartao de credito. Condicoes gerais: o boleto sera enviado por e-mail.'
  assert.equal(extrairFormaPagamento(texto), 'Cartão de crédito')
})

test('extrairPctComissao pega o percentual e nao o valor em reais', () => {
  assert.equal(extrairPctComissao('Comissao do corretor: 20,00 % Valor R$ 690,00'), 20)
})

test('extrairCep aceita o rotulo de pernoite', () => {
  assert.equal(extrairCep('CEP de pernoite: 01310-100'), '01310100')
})

test('extrairCondutor separa nome e CPF da secao do condutor', () => {
  const texto = 'SEGURADO MARIA SOUZA CPF 111.222.333-44 PRINCIPAL CONDUTOR JOAO DA SILVA CPF 555.666.777-88 Data de nascimento'
  const c = extrairCondutor(texto)
  assert.equal(c.nome, 'JOAO DA SILVA')
  assert.equal(c.cpf, '555.666.777-88')
})

// ─── Deteccao de seguradora ────────────────────────────────────────────

test('detectarSeguradora identifica pelo nome comercial', () => {
  assert.equal(detectarSeguradora('PORTO SEGURO CIA DE SEGUROS GERAIS')?.id, 'porto')
  assert.equal(detectarSeguradora('Tokio Marine Seguradora S.A.')?.id, 'tokio')
  assert.equal(detectarSeguradora('documento sem marca nenhuma'), null)
})

// ─── Orcamento ─────────────────────────────────────────────────────────

const ORCAMENTO = [
  'PORTO SEGURO CIA DE SEGUROS GERAIS',
  'ORCAMENTO DE SEGURO AUTO',
  'Segurado: MARIA APARECIDA SOUZA CPF: 123.456.789-00',
  'Celular: (11) 98765-4321 E-mail: maria@exemplo.com.br',
  'CEP de pernoite: 04567-000',
  'DADOS DO VEICULO',
  'Marca/Modelo: FIAT ARGO DRIVE 1.0 Placa: ABC1D23 Ano/Modelo: 2022/2023',
  'PRINCIPAL CONDUTOR JOAO PEDRO SOUZA CPF: 987.654.321-00 Data de nascimento 10/05/1990',
  'Vigencia: 01/03/2026 a 01/03/2027',
  'Premio Liquido: R$ 3.450,00',
  'Premio Total: R$ 3.795,00',
  'Comissao do corretor: 20,00 %',
  'Forma de pagamento: Cartao de credito 10x de R$ 379,50 sem juros',
].join(' ')

test('parseOrcamentoAutoText preenche a linha do comparativo de seguradoras', () => {
  const r = parseOrcamentoAutoText(ORCAMENTO)

  assert.equal(r.tipo, 'orcamento')
  assert.equal(r.layout, 'porto')
  // O formato bate com NOVA_SEGURADORA em AutoEmissoes.jsx, sem traducao.
  assert.equal(r.seguradora_cotada.nome, 'Porto Seguro')
  assert.equal(r.seguradora_cotada.premio_liquido, '3450')
  assert.equal(r.seguradora_cotada.valor_total, '3795')
  assert.equal(r.seguradora_cotada.pct_comissao, '20')
  assert.equal(r.seguradora_cotada.forma_pagamento, 'Cartão de crédito')
  assert.match(r.seguradora_cotada.parcelamentos, /^10x de R\$ 379,50/)
})

test('parseOrcamentoAutoText extrai cliente, veiculo e condutor', () => {
  const r = parseOrcamentoAutoText(ORCAMENTO)

  assert.equal(r.campos.cpf_cliente, '123.456.789-00')
  assert.equal(r.campos.celular_cliente, '(11) 98765-4321')
  assert.equal(r.campos.email_cliente, 'maria@exemplo.com.br')
  assert.equal(r.campos.cep_pernoite, '04567000')
  assert.equal(r.campos.placa, 'ABC1D23')
  assert.equal(r.campos.condutor_nome, 'JOAO PEDRO SOUZA')
  assert.equal(r.campos.condutor_cpf, '987.654.321-00')
  assert.equal(r.campos.vigencia_inicio, '2026-03-01')
  assert.equal(r.campos.vigencia_fim, '2027-03-01')
})

test('parseOrcamentoAutoText lista os campos extraidos para o front destacar', () => {
  const r = parseOrcamentoAutoText(ORCAMENTO)

  assert.ok(r.extraidos.includes('placa'))
  assert.ok(r.extraidos.includes('seguradora_cotada.premio_liquido'))
  // Campo nao encontrado nunca some do objeto: vem como '' e fora de `extraidos`,
  // para o form conseguir renderizar o input vazio e editavel.
  assert.equal(typeof r.campos.modelo_veiculo, 'string')
})

test('parseOrcamentoAutoText avisa quando nao reconhece a seguradora nem acha valores', () => {
  const r = parseOrcamentoAutoText('documento qualquer sem marca e sem valores')

  assert.equal(r.layout, null)
  assert.equal(r.seguradora, '')
  assert.equal(r.avisos.length, 2)
  assert.match(r.avisos[0], /Seguradora não identificada/)
  assert.match(r.avisos[1], /prêmio/)
})

// ─── Proposta ──────────────────────────────────────────────────────────

const PROPOSTA = [
  'TOKIO MARINE SEGURADORA S.A.',
  'PROPOSTA N 987654321',
  'Apolice N 1234567890',
  'Data de emissao: 20/02/2026',
  'Segurado: CARLOS EDUARDO LIMA CPF: 222.333.444-55',
  'Celular: (21) 91234-5678',
  'Marca/Modelo: HONDA CIVIC EXL Placa: XYZ2B34',
  'Vigencia: a partir das 24 horas do dia 01/03/2026 ate as 24 horas do dia 01/03/2027',
  'Premio Liquido: R$ 2.800,00 Premio Total: R$ 3.080,00',
  'Comissao: 15,00 %',
  'Forma de pagamento: Boleto 12x de R$ 256,67',
].join(' ')

test('parsePropostaAutoText preenche os campos da emissao', () => {
  const r = parsePropostaAutoText(PROPOSTA)

  assert.equal(r.tipo, 'proposta')
  assert.equal(r.layout, 'tokio')
  assert.equal(r.campos.seguradora, 'Tokio Marine')
  assert.equal(r.campos.numero_apolice, '1234567890')
  assert.equal(r.campos.numero_proposta, '987654321')
  assert.equal(r.campos.data_emissao, '2026-02-20')
  assert.equal(r.campos.cpf_cliente, '222.333.444-55')
  assert.equal(r.campos.placa, 'XYZ2B34')
  assert.equal(r.campos.vigencia_inicio, '2026-03-01')
  assert.equal(r.campos.vigencia_fim, '2027-03-01')
  assert.equal(r.campos.premio_liquido, '2800')
  assert.equal(r.campos.pct_comissao, '15')
  assert.equal(r.campos.forma_pagamento, 'Boleto')
})

test('parsePropostaAutoText avisa quando falta numero de apolice e proposta', () => {
  const r = parsePropostaAutoText('PORTO SEGURO Premio Liquido: R$ 100,00')

  assert.ok(r.avisos.some(a => /apólice\/proposta/.test(a)))
})
