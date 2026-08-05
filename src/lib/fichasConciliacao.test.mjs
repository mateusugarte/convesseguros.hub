import test from 'node:test'
import assert from 'node:assert/strict'

import {
  soDigitos,
  normalizarTexto,
  valorPorRotulo,
  extrairCampos,
  chaveContato,
  conciliarFichas,
  inicioDaBusca,
  TOLERANCIA_DIAS,
  MARGEM_BUSCA_DIAS,
} from './fichasConciliacao.js'

const DIA = 24 * 60 * 60 * 1000

// Rotulos reais do Forms residencial, iguais aos que o Code Node do n8n espera.
function linhaForms({ linha = 2, quando, nome = 'Maria Souza', cpf = '123.456.789-09', celular = '(19) 99999-1234', imobiliaria = 'Abelha' } = {}) {
  return {
    linha,
    timestamp: quando ? new Date(quando).toISOString() : null,
    dados: {
      'Carimbo de data/hora': '01/08/2026 10:00:00',
      'IMOBILIÁRIA': imobiliaria,
      'Nome completo do interessado no imóvel': nome,
      'CPF': cpf,
      'Celular': celular,
      'E-mail': 'maria@exemplo.com',
      'CEP': '13000-000',
      'Valor do Aluguel': '2500',
      'Valor do IPTU': '120',
      'Tipo de imóvel': 'Casa',
      'Observações': '',
      'Orçamentista': 'Davi',
    },
  }
}

function ficha({ id = 'f1', cpf = '12345678909', nome = 'Maria Souza', celular = '19999991234', quando, status = 'pendente' } = {}) {
  return {
    id,
    cpf,
    nome_interessado: nome,
    celular,
    status,
    produto: 'residencial_pf',
    created_at: new Date(quando).toISOString(),
  }
}

test('soDigitos remove mascara de CPF e telefone', () => {
  assert.equal(soDigitos('123.456.789-09'), '12345678909')
  assert.equal(soDigitos('(19) 99999-1234'), '19999991234')
  assert.equal(soDigitos(null), '')
})

test('normalizarTexto dobra acento, caixa e pontuacao sem comer letras', () => {
  assert.equal(normalizarTexto('IMOBILIÁRIA'), 'imobiliaria')
  assert.equal(normalizarTexto('Nome completo do interessado no imóvel'), 'nome completo do interessado no imovel')
  assert.equal(normalizarTexto('E-mail'), 'e mail')
  // Regressao do bug do n8n: o range de acentos nao pode apagar as letras.
  assert.equal(normalizarTexto('Orçamentista'), 'orcamentista')
  assert.notEqual(normalizarTexto('CPF'), '')
})

test('valorPorRotulo casa rotulo com acento, caixa e pontuacao diferentes', () => {
  const dados = { 'IMOBILIÁRIA': 'Abelha', 'E-mail': 'a@b.com' }
  assert.equal(valorPorRotulo(dados, ['imobiliaria']), 'Abelha')
  assert.equal(valorPorRotulo(dados, ['e mail', 'email']), 'a@b.com')
  assert.equal(valorPorRotulo(dados, ['inexistente']), '')
  assert.equal(valorPorRotulo(null, ['imobiliaria']), '')
})

test('valorPorRotulo prefere o rotulo exato ao rotulo com sufixo', () => {
  const dados = { 'CPF do condutor': '111', 'CPF': '222' }
  assert.equal(valorPorRotulo(dados, ['cpf']), '222')
})

test('extrairCampos le a linha real do Forms residencial', () => {
  const campos = extrairCampos(linhaForms({ quando: Date.now() }).dados)
  assert.equal(campos.nome, 'Maria Souza')
  assert.equal(campos.cpf, '123.456.789-09')
  assert.equal(campos.imobiliaria, 'Abelha')
  assert.equal(campos.orcamentista, 'Davi')
  assert.equal(campos.tipoImovel, 'Casa')
})

test('chaveContato usa os 8 ultimos digitos, tolerando DDD/nono digito', () => {
  assert.equal(chaveContato('Maria Souza', '(19) 99999-1234'), chaveContato('MARIA SOUZA', '9999-1234'))
  assert.equal(chaveContato('', '19999991234'), '')
})

test('resposta sem ficha correspondente aparece como faltante', () => {
  const agora = Date.now()
  const r = conciliarFichas({ linhas: [linhaForms({ quando: agora })], fichas: [] })
  assert.equal(r.resumo.faltantes, 1)
  assert.equal(r.resumo.encontradas, 0)
  assert.equal(r.faltantes[0].motivo, 'sem_ficha_no_sistema')
  assert.equal(r.faltantes[0].campos.nome, 'Maria Souza')
})

test('resposta que virou ficha no mesmo instante e considerada encontrada', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [linhaForms({ quando: agora })],
    fichas: [ficha({ quando: agora + 4000 })],
  })
  assert.equal(r.resumo.encontradas, 1)
  assert.equal(r.resumo.faltantes, 0)
  assert.equal(r.encontradas[0].ficha.id, 'f1')
})

test('CPF com mascara diferente entre planilha e banco ainda casa', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [linhaForms({ quando: agora, cpf: '123.456.789-09' })],
    fichas: [ficha({ cpf: '12345678909', quando: agora })],
  })
  assert.equal(r.resumo.encontradas, 1)
})

test('ficha do mesmo CPF em data distante vira incerta, nao faltante', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [linhaForms({ quando: agora })],
    fichas: [ficha({ quando: agora - 20 * DIA })],
  })
  assert.equal(r.resumo.incertas, 1)
  assert.equal(r.resumo.faltantes, 0)
  assert.equal(r.incertas[0].motivo, 'ficha_do_mesmo_cpf_em_outra_data')
  assert.ok(r.incertas[0].diff_dias > TOLERANCIA_DIAS)
})

test('duas respostas do mesmo CPF com apenas uma ficha nao passam batido', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [
      linhaForms({ linha: 2, quando: agora - 5 * DIA }),
      linhaForms({ linha: 3, quando: agora - 1 * DIA }),
    ],
    fichas: [ficha({ id: 'f1', quando: agora - 5 * DIA })],
  })
  // A ficha e reivindicada pela primeira resposta; a segunda precisa sobrar.
  assert.equal(r.resumo.encontradas, 1)
  assert.equal(r.encontradas[0].linha, 2)
  assert.equal(r.resumo.faltantes + r.resumo.incertas, 1)
})

test('duas respostas do mesmo CPF com duas fichas fecham certo', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [
      linhaForms({ linha: 2, quando: agora - 5 * DIA }),
      linhaForms({ linha: 3, quando: agora - 1 * DIA }),
    ],
    fichas: [
      ficha({ id: 'f1', quando: agora - 5 * DIA }),
      ficha({ id: 'f2', quando: agora - 1 * DIA }),
    ],
  })
  assert.equal(r.resumo.encontradas, 2)
  assert.equal(r.resumo.faltantes, 0)
  assert.equal(r.resumo.incertas, 0)
  // Cada resposta ficou com a ficha da sua propria data.
  assert.equal(r.encontradas.find(e => e.linha === 2).ficha.id, 'f1')
  assert.equal(r.encontradas.find(e => e.linha === 3).ficha.id, 'f2')
})

test('linha sem CPF casa pelo nome + celular', () => {
  const agora = Date.now()
  const r = conciliarFichas({
    linhas: [linhaForms({ quando: agora, cpf: '' })],
    fichas: [ficha({ cpf: '', quando: agora })],
  })
  assert.equal(r.resumo.encontradas, 1)
})

test('linha sem CPF e sem ficha equivalente e sinalizada com motivo proprio', () => {
  const r = conciliarFichas({
    linhas: [linhaForms({ quando: Date.now(), cpf: '' })],
    fichas: [],
  })
  assert.equal(r.faltantes[0].motivo, 'sem_cpf_e_sem_ficha')
})

test('linha sem carimbo de data casa pelo CPF sem exigir proximidade', () => {
  const linha = linhaForms({ quando: Date.now() })
  linha.timestamp = null
  const r = conciliarFichas({
    linhas: [linha],
    fichas: [ficha({ quando: Date.now() - 100 * DIA })],
  })
  assert.equal(r.resumo.encontradas, 1)
  assert.equal(r.encontradas[0].motivo, 'sem_data_na_planilha')
})

test('faltante carrega o payload cru para reimportacao pelo webhook', () => {
  const r = conciliarFichas({ linhas: [linhaForms({ quando: Date.now() })], fichas: [] })
  const dados = r.faltantes[0].dados
  // O n8n le por rotulo cru; perder o rotulo original quebraria a importacao.
  assert.equal(dados['IMOBILIÁRIA'], 'Abelha')
  assert.equal(dados['Nome completo do interessado no imóvel'], 'Maria Souza')
  assert.equal(dados['Orçamentista'], 'Davi')
})

test('entrada vazia nao quebra', () => {
  const r = conciliarFichas()
  assert.deepEqual(r.resumo, { total: 0, faltantes: 0, encontradas: 0, incertas: 0 })
})

test('inicioDaBusca recua a janela mais a margem de seguranca', () => {
  const agora = new Date('2026-08-05T12:00:00.000Z')
  const inicio = inicioDaBusca(30, agora)
  assert.equal(Math.round((agora - inicio) / DIA), 30 + MARGEM_BUSCA_DIAS)
})
