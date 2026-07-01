import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from './relatorioCobranca.js'

test('buildAprovadaPatch limpa marcas de cobrança e recuperação', () => {
  const ficha = { raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, foo: 'bar' } }
  const patch = buildAprovadaPatch(ficha)
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, false)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.recovered_after_cobranca_em, null)
  assert.equal(patch.raw_data.retorno_enviado_em, null)
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildCobrancaPatch marca envio com o timestamp informado', () => {
  const ficha = { raw_data: { foo: 'bar' } }
  const patch = buildCobrancaPatch(ficha, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, true)
  assert.equal(patch.raw_data.retorno_enviado_em, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.raw_data.foo, 'bar')
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

test('buildCobrancaHistoricoPatch não mexe em retorno_enviado nem status', () => {
  const ficha = { raw_data: {} }
  const patch = buildCobrancaHistoricoPatch(ficha, true, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.status, undefined)
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.raw_data.retorno_enviado_em, '2026-07-01T09:00:00.000Z')

  const off = buildCobrancaHistoricoPatch(ficha, false)
  assert.equal(off.raw_data.cobranca_started_at, null)
  assert.equal(off.raw_data.retorno_enviado_em, null)
})

test('isCobrancaEnviadaVisivel só é true para enviado_cobranca e recuperados', () => {
  assert.equal(isCobrancaEnviadaVisivel('enviado_cobranca'), true)
  assert.equal(isCobrancaEnviadaVisivel('recuperados'), true)
  assert.equal(isCobrancaEnviadaVisivel('aprovada'), false)
  assert.equal(isCobrancaEnviadaVisivel('emitida'), false)
  assert.equal(isCobrancaEnviadaVisivel('expirada'), false)
})

test('getCobrancaEnviadaDisplay usa retorno_enviado em Enviado Cobrança e histórico em Recuperados', () => {
  const emCobranca = { retorno_enviado: true, raw_data: {} }
  assert.equal(getCobrancaEnviadaDisplay(emCobranca, 'enviado_cobranca'), true)

  const recuperada = { retorno_enviado: false, raw_data: { cobranca_started_at: '2026-01-01' } }
  assert.equal(getCobrancaEnviadaDisplay(recuperada, 'recuperados'), true)

  const recuperadaSemHistorico = { retorno_enviado: false, raw_data: {} }
  assert.equal(getCobrancaEnviadaDisplay(recuperadaSemHistorico, 'recuperados'), false)
})

test('getImobiliariaRetornouDisplay reflete raw_data.imobiliaria_retornou', () => {
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: { imobiliaria_retornou: true } }), true)
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: {} }), false)
  assert.equal(getImobiliariaRetornouDisplay({}), false)
})
