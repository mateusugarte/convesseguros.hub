import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarChaveFormulario, valorFormularioAuto } from './autoFormPayload.js'

test('normaliza rotulos do formulario com acento e pontuacao', () => {
  assert.equal(normalizarChaveFormulario('Veículo tem passagem por leilão:'), 'veiculo tem passagem por leilao')
})

test('le os campos complementares pelos rotulos reais do Forms', () => {
  const quote = {
    payload_origem: {
      'Tipo de residência:': 'Casa',
      'Veículo tem passagem por leilão:': 'Não',
    },
  }

  assert.equal(valorFormularioAuto(quote, 'tipo_residencia'), 'Casa')
  assert.equal(valorFormularioAuto(quote, 'passagem_leilao'), 'Não')
})

test('prefere valor canonico gravado pelo n8n e aceita payload aninhado', () => {
  const quote = {
    payload_origem: {
      body: {
        _conves: { tipo_residencia: 'Apartamento' },
        'Tipo de residência:': 'Casa',
      },
    },
  }

  assert.equal(valorFormularioAuto(quote, 'tipo_residencia'), 'Apartamento')
})

