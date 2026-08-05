import test from 'node:test'
import assert from 'node:assert/strict'

const {
  dobrarAcentos,
  normalizarRotulo,
  normalizarValor,
  construirVocabulario,
  extrairPares,
  melhorVariante,
  extrairValorTipado,
  extrairCandidatosTipados,
  pontuarRotulo,
  sugerirMapeamento,
  aplicarMapeamento,
  mapeamentoInicial,
  resumirMapeamento,
  encontrarOcorrenciasRotulo,
} = await import('./autoPdfMapeamento.js')

const { CAMPOS_COTACAO, CAMPOS_APOLICE, camposDoTipo, agruparCampos } = await import('./autoPdfCampos.js')

// Amostra no formato dominante dos portais: rotulo, dois-pontos e valor em linha.
const PDF_APOLICE = `
PORTO SEGURO COMPANHIA DE SEGUROS GERAIS
Apolice: 0531.12.3456789-0   Proposta: 998877665   Data de Emissao: 12/03/2026
Segurado: MARIA APARECIDA DE SOUZA  CPF: 123.456.789-09  Celular: (11) 98765-4321
E-mail: maria.souza@exemplo.com.br
Principal Condutor: JOAO PEDRO DE SOUZA  CPF do condutor: 987.654.321-00
Marca / Modelo: FIAT ARGO DRIVE 1.3  Placa: EAJ0B74  Chassi: 9BD19712MP1234567
Ano / Modelo: 2022/2023  Categoria: PASSEIO
Vigencia: das 24 horas do dia 01/04/2026 as 24 horas do dia 01/04/2027
Inicio de Vigencia: 01/04/2026   Fim de Vigencia: 01/04/2027
Premio Liquido: R$ 2.480,55   Premio Total: R$ 2.734,20   Comissao: 18,00 %
Forma de Pagamento: CARTAO DE CREDITO   Parcelamento: 10x sem juros
`

const PDF_COTACAO = `
AZUL SEGUROS - ORCAMENTO DE SEGURO AUTO
Proponente: CARLOS EDUARDO LIMA  CPF: 111.222.333-44  Telefone: (16) 99888-7766
Marca / Modelo: VW GOL 1.0 MPI  Placa: ABC1D23
CEP de pernoite: 14020-330  Uso do veiculo: PARTICULAR
Garagem na residencia: SIM  Garagem no trabalho: NAO  Garagem no local de estudo: NAO
Jovens de 18 a 26 anos: NAO  Veiculo financiado: SIM  Kit gas: NAO  Blindagem: NAO
Inicio de Vigencia: 10/05/2026  Fim de Vigencia: 10/05/2027
Premio Liquido: R$ 1.980,00  Premio Total: R$ 2.150,40  Comissao: 15 %
Forma de Pagamento: BOLETO  Parcelamento: 4x sem juros
`

function campo(chave) {
  return CAMPOS_APOLICE.find(item => item.key === chave) || CAMPOS_COTACAO.find(item => item.key === chave)
}

function sugestaoDe(sugestoes, chave) {
  return sugestoes.find(item => item.key === chave)?.sugestao || null
}

// ─── Normalizacao ──────────────────────────────────────────────────────

test('dobrarAcentos preserva o comprimento da string', () => {
  const original = 'VIGÊNCIA DA APÓLICE — PRÊMIO LÍQUIDO'
  const dobrado = dobrarAcentos(original)
  assert.equal(dobrado.length, original.length)
  assert.ok(dobrado.includes('VIGENCIA'))
  assert.ok(dobrado.includes('APOLICE'))
  assert.ok(dobrado.includes('PREMIO LIQUIDO'))
})

test('normalizarRotulo remove acento, pontuacao e caixa', () => {
  assert.equal(normalizarRotulo('  Prêmio  Líquido: '), 'PREMIO LIQUIDO')
  assert.equal(normalizarRotulo('Marca / Modelo'), 'MARCA MODELO')
  assert.equal(normalizarRotulo('% Comissão'), '% COMISSAO')
})

test('normalizarValor converte cada tipo para o formato do formulario', () => {
  assert.equal(normalizarValor('01/04/2026', 'data'), '2026-04-01')
  assert.equal(normalizarValor('R$ 2.480,55', 'moeda'), '2480.55')
  assert.equal(normalizarValor('18,00 %', 'percentual'), '18')
  assert.equal(normalizarValor('12345678909', 'cpf'), '123.456.789-09')
  assert.equal(normalizarValor('eaj-0b74', 'placa'), 'EAJ0B74')
  assert.equal(normalizarValor('14020-330', 'cep'), '14020330')
  assert.equal(normalizarValor('NAO', 'sim_nao'), 'nao')
  assert.equal(normalizarValor('Sim', 'sim_nao'), 'sim')
})

test('normalizarValor recusa data impossivel', () => {
  assert.equal(normalizarValor('45/13/2026', 'data'), '')
})

// ─── Pares e valores ───────────────────────────────────────────────────

test('extrairPares encontra rotulo e valor separados por dois-pontos', () => {
  const vocab = construirVocabulario(CAMPOS_APOLICE)
  const pares = extrairPares(PDF_APOLICE, vocab)
  const variantes = pares.flatMap(par => par.variantes)
  assert.ok(variantes.includes('PREMIO LIQUIDO'))
  assert.ok(variantes.includes('PLACA'))
  assert.ok(variantes.includes('CPF DO CONDUTOR'))
})

test('extrairPares nao deixa o rotulo cruzar o par anterior', () => {
  const vocab = construirVocabulario(CAMPOS_APOLICE)
  const pares = extrairPares('Segurado: MARIA DE SOUZA CPF: 123.456.789-09', vocab)
  const parDoCpf = pares[1]
  assert.equal(parDoCpf.variantes[0], 'CPF')
  assert.ok(!parDoCpf.segmento.includes('SEGURADO'))
})

test('melhorVariante escolhe o rotulo mais especifico do par', () => {
  const vocab = construirVocabulario(CAMPOS_APOLICE)
  const pares = extrairPares(PDF_APOLICE, vocab)
  const parDoCondutor = pares.find(par => par.variantes.includes('CPF DO CONDUTOR'))
  assert.equal(melhorVariante(parDoCondutor, campo('condutor_cpf')).rotulo, 'CPF DO CONDUTOR')
})

test('extrairValorTipado corta o texto quando o proximo rotulo comeca', () => {
  const vocab = construirVocabulario(CAMPOS_APOLICE)
  const lido = extrairValorTipado(' MARIA APARECIDA DE SOUZA CPF: 123.456.789-09', 'texto', vocab)
  assert.equal(lido.valor, 'MARIA APARECIDA DE SOUZA')
})

test('extrairCandidatosTipados devolve todas as ocorrencias com contexto', () => {
  const cpfs = extrairCandidatosTipados(PDF_APOLICE, 'cpf')
  assert.equal(cpfs.length, 2)
  assert.equal(cpfs[0].valor, '123.456.789-09')
  assert.equal(cpfs[1].valor, '987.654.321-00')
  assert.ok(cpfs[1].contexto.includes('condutor'))
})

// ─── Pontuacao ─────────────────────────────────────────────────────────

test('pontuarRotulo premia o rotulo exato e pune o termo proibido', () => {
  const nome = campo('nome_cliente')
  assert.ok(pontuarRotulo('SEGURADO', nome) >= 100)
  assert.ok(pontuarRotulo('NOME DO CONDUTOR', nome) < 40)
})

test('pontuarRotulo separa premio liquido de premio total', () => {
  const liquido = campo('premio_liquido')
  const total = campo('valor_total')
  assert.ok(pontuarRotulo('PREMIO LIQUIDO', liquido) > pontuarRotulo('PREMIO TOTAL', liquido))
  assert.ok(pontuarRotulo('PREMIO TOTAL', total) > pontuarRotulo('PREMIO LIQUIDO', total))
})

// ─── Sugestao ──────────────────────────────────────────────────────────

test('sugerirMapeamento acerta os campos principais de uma apolice', () => {
  const sugestoes = sugerirMapeamento(PDF_APOLICE, CAMPOS_APOLICE)

  assert.equal(sugestaoDe(sugestoes, 'nome_cliente').valor, 'MARIA APARECIDA DE SOUZA')
  assert.equal(sugestaoDe(sugestoes, 'cpf_cliente').valor, '123.456.789-09')
  assert.equal(sugestaoDe(sugestoes, 'condutor_cpf').valor, '987.654.321-00')
  assert.equal(sugestaoDe(sugestoes, 'placa').valor, 'EAJ0B74')
  assert.equal(sugestaoDe(sugestoes, 'chassi').valor, '9BD19712MP1234567')
  assert.equal(sugestaoDe(sugestoes, 'premio_liquido').valor, '2480.55')
  assert.equal(sugestaoDe(sugestoes, 'valor_total').valor, '2734.2')
  assert.equal(sugestaoDe(sugestoes, 'pct_comissao').valor, '18')
  assert.equal(sugestaoDe(sugestoes, 'vigencia_inicio').valor, '2026-04-01')
  assert.equal(sugestaoDe(sugestoes, 'vigencia_fim').valor, '2027-04-01')
  assert.equal(sugestaoDe(sugestoes, 'data_emissao').valor, '2026-03-12')
  assert.equal(sugestaoDe(sugestoes, 'email_cliente').valor, 'maria.souza@exemplo.com.br')
})

test('sugerirMapeamento nao confunde segurado com condutor', () => {
  const sugestoes = sugerirMapeamento(PDF_APOLICE, CAMPOS_APOLICE)
  assert.equal(sugestaoDe(sugestoes, 'condutor_nome').valor, 'JOAO PEDRO DE SOUZA')
  assert.notEqual(sugestaoDe(sugestoes, 'nome_cliente').valor, sugestaoDe(sugestoes, 'condutor_nome').valor)
  assert.notEqual(sugestaoDe(sugestoes, 'cpf_cliente').valor, sugestaoDe(sugestoes, 'condutor_cpf').valor)
})

test('sugerirMapeamento le as perguntas de risco da cotacao', () => {
  const sugestoes = sugerirMapeamento(PDF_COTACAO, CAMPOS_COTACAO)
  assert.equal(sugestaoDe(sugestoes, 'cep_pernoite').valor, '14020330')
  assert.equal(sugestaoDe(sugestoes, 'garagem_residencia').valor, 'sim')
  assert.equal(sugestaoDe(sugestoes, 'garagem_trabalho').valor, 'nao')
  assert.equal(sugestaoDe(sugestoes, 'veiculo_financiado').valor, 'sim')
  assert.equal(sugestaoDe(sugestoes, 'uso_veiculo').valor, 'PARTICULAR')
})

test('sugerirMapeamento oferece alternativas para o usuario corrigir', () => {
  const sugestoes = sugerirMapeamento(PDF_APOLICE, CAMPOS_APOLICE)
  const cpf = sugestoes.find(item => item.key === 'cpf_cliente')
  assert.ok(cpf.candidatos.length > 1)
  assert.ok(cpf.candidatos.some(item => item.valor === '987.654.321-00'))
})

test('sugerirMapeamento devolve um item por campo do sistema', () => {
  const sugestoes = sugerirMapeamento(PDF_COTACAO, CAMPOS_COTACAO)
  assert.equal(sugestoes.length, CAMPOS_COTACAO.length)
})

// ─── Aplicacao do mapeamento salvo ─────────────────────────────────────

test('encontrarOcorrenciasRotulo tolera acento e pontuacao entre as palavras', () => {
  const texto = 'PREMIO LIQUIDO: R$ 10,00 PREMIO-LIQUIDO: R$ 20,00'
  assert.equal(encontrarOcorrenciasRotulo(texto, 'Prêmio Líquido').length, 2)
})

test('aplicarMapeamento extrai um PDF novo usando as ancoras confirmadas', () => {
  const sugestoes = sugerirMapeamento(PDF_APOLICE, CAMPOS_APOLICE)
  const campos = mapeamentoInicial(sugestoes)
  const outroPdf = PDF_APOLICE
    .replace('MARIA APARECIDA DE SOUZA', 'ANTONIO CARLOS PEREIRA')
    .replace('R$ 2.480,55', 'R$ 3.111,90')
    .replace('EAJ0B74', 'RGT4H88')

  const resultado = aplicarMapeamento(outroPdf, { campos }, CAMPOS_APOLICE)
  assert.equal(resultado.campos.nome_cliente, 'ANTONIO CARLOS PEREIRA')
  assert.equal(resultado.campos.premio_liquido, '3111.9')
  assert.equal(resultado.campos.placa, 'RGT4H88')
  assert.ok(resultado.encontrados.includes('cpf_cliente'))
})

test('aplicarMapeamento ignora campo marcado como ausente', () => {
  const campos = {
    numero_proposta: { rotulo: 'PROPOSTA', tipo: 'documento', ocorrencia: 0, ausente: true },
    numero_apolice: { rotulo: 'APOLICE', tipo: 'documento', ocorrencia: 0, confirmado: true },
  }
  const resultado = aplicarMapeamento(PDF_APOLICE, { campos }, CAMPOS_APOLICE)
  assert.equal(resultado.campos.numero_proposta, undefined)
  assert.ok(resultado.campos.numero_apolice)
})

test('aplicarMapeamento reporta o campo cuja ancora sumiu do PDF', () => {
  const campos = {
    premio_liquido: { rotulo: 'VALOR DO CONSORCIO', tipo: 'moeda', ocorrencia: 0, confirmado: true },
  }
  const resultado = aplicarMapeamento(PDF_APOLICE, { campos }, CAMPOS_APOLICE)
  assert.deepEqual(resultado.faltantes, ['premio_liquido'])
})

test('aplicarMapeamento usa a ocorrencia quando o valor nao tem rotulo', () => {
  const campos = {
    condutor_cpf: { rotulo: null, tipo: 'cpf', ocorrencia: 1, confirmado: true },
  }
  const resultado = aplicarMapeamento(PDF_APOLICE, { campos }, CAMPOS_APOLICE)
  assert.equal(resultado.campos.condutor_cpf, '987.654.321-00')
})

// ─── Estado do mapeamento ──────────────────────────────────────────────

test('mapeamentoInicial preserva o que ja estava salvo', () => {
  const sugestoes = sugerirMapeamento(PDF_APOLICE, CAMPOS_APOLICE)
  const salvo = { placa: { rotulo: 'PLACA DO VEICULO', tipo: 'placa', ocorrencia: 0, confirmado: true, valor_exemplo: 'XXX0X00' } }
  const campos = mapeamentoInicial(sugestoes, salvo)
  assert.equal(campos.placa.rotulo, 'PLACA DO VEICULO')
  assert.equal(campos.placa.confirmado, true)
  assert.equal(campos.nome_cliente.confirmado, false)
})

test('resumirMapeamento so libera a conclusao com os obrigatorios resolvidos', () => {
  const definicoes = camposDoTipo('apolice')
  const vazio = resumirMapeamento({}, definicoes)
  assert.equal(vazio.podeConcluir, false)
  assert.equal(vazio.percentual, 0)

  const completo = {}
  for (const definicao of definicoes) {
    completo[definicao.key] = { confirmado: true, valor_exemplo: 'x', rotulo: definicao.label, tipo: definicao.tipo }
  }
  const cheio = resumirMapeamento(completo, definicoes)
  assert.equal(cheio.podeConcluir, true)
  assert.equal(cheio.percentual, 100)
  assert.equal(cheio.pendentes, 0)
})

test('resumirMapeamento aceita campo opcional pendente mas nao obrigatorio', () => {
  const definicoes = camposDoTipo('cotacao')
  const campos = {}
  for (const definicao of definicoes) {
    if (definicao.obrigatorio) campos[definicao.key] = { confirmado: true, valor_exemplo: 'x' }
  }
  const resumo = resumirMapeamento(campos, definicoes)
  assert.equal(resumo.obrigatoriosPendentes, 0)
  assert.equal(resumo.podeConcluir, true)
  assert.ok(resumo.pendentes > 0)
})

test('campo marcado como ausente conta como resolvido', () => {
  const definicoes = [{ key: 'chassi', label: 'Chassi', tipo: 'chassi', obrigatorio: false }]
  const resumo = resumirMapeamento({ chassi: { ausente: true } }, definicoes)
  assert.equal(resumo.ausentes, 1)
  assert.equal(resumo.pendentes, 0)
})

// ─── Catalogo de campos ────────────────────────────────────────────────

test('agruparCampos mantem a ordem dos grupos e nao perde campo', () => {
  const grupos = agruparCampos(CAMPOS_COTACAO)
  const total = grupos.reduce((soma, grupo) => soma + grupo.campos.length, 0)
  assert.equal(total, CAMPOS_COTACAO.length)
  assert.equal(grupos[0].grupo, 'Segurado')
})

test('camposDoTipo diferencia cotacao de apolice', () => {
  assert.ok(camposDoTipo('apolice').some(item => item.key === 'numero_apolice'))
  assert.ok(!camposDoTipo('cotacao').some(item => item.key === 'numero_apolice'))
  assert.ok(camposDoTipo('cotacao').some(item => item.key === 'cep_pernoite'))
})
