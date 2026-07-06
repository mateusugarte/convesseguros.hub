import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildCobrancaResetPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  buildRelatorioMovePatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from './relatorioCobranca.js'
import { getFichaOperationalState } from './fichaOperational.js'

test('buildAprovadaPatch limpa marcas de cobranÃ§a e recuperaÃ§Ã£o', () => {
  const ficha = { raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, imobiliaria_retornou: true, foo: 'bar' } }
  const patch = buildAprovadaPatch(ficha)
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.recovered_after_cobranca_em, null)
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
  assert.equal(patch.raw_data.imobiliaria_retornou_em, null)
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildCobrancaPatch marca envio com o timestamp informado sem mexer em retorno_enviado', () => {
  const ficha = { raw_data: { foo: 'bar', imobiliaria_retornou: true } }
  const patch = buildCobrancaPatch(ficha, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
  assert.equal(patch.raw_data.imobiliaria_retornou_em, null)
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildCobrancaResetPatch limpa cobranÃ§a sem alterar o status original nem retorno_enviado', () => {
  const ficha = { status: 'emitido', raw_data: { cobranca_started_at: '2026-06-15', imobiliaria_retornou: true } }
  const patch = buildCobrancaResetPatch(ficha)
  assert.equal(patch.status, undefined)
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
  assert.equal(patch.raw_data.imobiliaria_retornou_em, null)
})

test('buildImobiliariaRetornoPatch grava e limpa o retorno', () => {
  const ficha = { raw_data: {} }
  const ligado = buildImobiliariaRetornoPatch(ficha, true, '2026-07-01T12:00:00.000Z')
  assert.equal(ligado.raw_data.imobiliaria_retornou, true)
  assert.equal(ligado.raw_data.imobiliaria_retornou_em, '2026-07-01T12:00:00.000Z')

  const desligado = buildImobiliariaRetornoPatch(ficha, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou_em, null)
})

test('buildCobrancaHistoricoPatch sÃ³ mexe no histÃ³rico de cobranÃ§a', () => {
  const ficha = { raw_data: {} }
  const patch = buildCobrancaHistoricoPatch(ficha, true, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.status, undefined)
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T09:00:00.000Z')

  const off = buildCobrancaHistoricoPatch(ficha, false)
  assert.equal(off.raw_data.cobranca_started_at, null)
})

test('buildRelatorioMovePatch permite mover para expirada sem acionar cobrança', () => {
  const ficha = { raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, imobiliaria_retornou: true } }
  const patch = buildRelatorioMovePatch(ficha, 'expirada')
  assert.equal(patch.status, 'expirada')
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
})
test('isCobrancaEnviadaVisivel sÃ³ Ã© true para enviado_cobranca e recuperados', () => {
  assert.equal(isCobrancaEnviadaVisivel('enviado_cobranca'), true)
  assert.equal(isCobrancaEnviadaVisivel('recuperados'), true)
  assert.equal(isCobrancaEnviadaVisivel('aprovada'), false)
  assert.equal(isCobrancaEnviadaVisivel('emitida'), false)
  assert.equal(isCobrancaEnviadaVisivel('expirada'), false)
})

test('getCobrancaEnviadaDisplay usa apenas o histÃ³rico de cobranÃ§a', () => {
  const emCobranca = { raw_data: { cobranca_started_at: '2026-01-01' } }
  assert.equal(getCobrancaEnviadaDisplay(emCobranca, 'enviado_cobranca'), true)

  const recuperada = { raw_data: { cobranca_started_at: '2026-01-01' } }
  assert.equal(getCobrancaEnviadaDisplay(recuperada, 'recuperados'), true)

  const semHistorico = { raw_data: {} }
  assert.equal(getCobrancaEnviadaDisplay(semHistorico, 'recuperados'), false)
})

test('getImobiliariaRetornouDisplay reflete raw_data.imobiliaria_retornou', () => {
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: { imobiliaria_retornou: true } }), true)
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: {} }), false)
  assert.equal(getImobiliariaRetornouDisplay({}), false)
})

test('getFichaOperationalState só projeta Enviado Cobrança para fichas aprovadas sem apólice e com cobrança iniciada', () => {
  assert.equal(getFichaOperationalState({ status: 'aprovado', raw_data: { cobranca_started_at: '2026-07-01' } })?.id, 'enviado_cobranca')
  assert.equal(getFichaOperationalState({ status: 'expirada' })?.id, 'expirada')
  assert.equal(getFichaOperationalState({ status: 'recusado', raw_data: { cobranca_started_at: '2026-07-01' } })?.id, 'recusada')
  assert.equal(getFichaOperationalState({ status: 'cancelado', raw_data: { cobranca_started_at: '2026-07-01' } })?.id, 'desistiu')
})
