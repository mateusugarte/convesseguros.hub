import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAutoCardColor,
  getAutoEmissionRequirement,
  resolveAutoEmissionDestination,
  setAutoCardColor,
  setAutoEmissionRequirement,
} from './autoCardCustomization.js'

test('cor personalizada convive com etiquetas cadastradas', () => {
  const tags = setAutoCardColor(['tag-uuid', '__emission_requirement__:vistoria'], '#12abef')
  assert.equal(getAutoCardColor(tags), '#12ABEF')
  assert.deepEqual(tags, ['tag-uuid', '__emission_requirement__:vistoria', '__card_color__:#12ABEF'])
  assert.deepEqual(setAutoCardColor(tags, ''), ['tag-uuid', '__emission_requirement__:vistoria'])
})

test('pendencia operacional define a coluna posterior a transmissao', () => {
  assert.equal(resolveAutoEmissionDestination('proposta_transmitida', 'nenhuma'), 'proposta_transmitida')
  assert.equal(resolveAutoEmissionDestination('proposta_transmitida', 'vistoria'), 'aguardando_vistoria')
  assert.equal(resolveAutoEmissionDestination('aguardando_vistoria', 'rastreador'), 'aguardando_vistoria')
  assert.equal(resolveAutoEmissionDestination('apolice_emitida', 'vistoria'), 'apolice_emitida')
})

test('marcacao de vistoria ou rastreador preserva as demais tags', () => {
  const tags = setAutoEmissionRequirement(['tag-uuid', '__card_color__:#10B981'], 'rastreador')
  assert.equal(getAutoEmissionRequirement(tags), 'rastreador')
  assert.deepEqual(setAutoEmissionRequirement(tags, 'nenhuma'), ['tag-uuid', '__card_color__:#10B981'])
})
