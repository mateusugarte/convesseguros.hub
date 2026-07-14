import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  buildRelatorioMovePatch,
  buildDesistiuPatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from './relatorioCobranca.js'
import { getFichaOperationalState, isFichaExpiredOperational } from './fichaOperational.js'

test('buildAprovadaPatch limpa marcas de cobrança, recuperação e expiração manual', () => {
  const ficha = { raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, imobiliaria_retornou: true, manually_expired: true, foo: 'bar' } }
  const patch = buildAprovadaPatch(ficha)
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.recovered_after_cobranca_em, null)
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
  assert.equal(patch.raw_data.imobiliaria_retornou_em, null)
  assert.equal(patch.raw_data.manually_expired, false)
  assert.equal(patch.raw_data.manually_expired_em, null)
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

test('buildImobiliariaRetornoPatch grava e limpa o retorno', () => {
  const ficha = { raw_data: {} }
  const ligado = buildImobiliariaRetornoPatch(ficha, true, '2026-07-01T12:00:00.000Z')
  assert.equal(ligado.raw_data.imobiliaria_retornou, true)
  assert.equal(ligado.raw_data.imobiliaria_retornou_em, '2026-07-01T12:00:00.000Z')

  const desligado = buildImobiliariaRetornoPatch(ficha, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou_em, null)
})

test('buildCobrancaHistoricoPatch só mexe no histórico de cobrança', () => {
  const ficha = { raw_data: {} }
  const patch = buildCobrancaHistoricoPatch(ficha, true, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.status, undefined)
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T09:00:00.000Z')

  const off = buildCobrancaHistoricoPatch(ficha, false)
  assert.equal(off.raw_data.cobranca_started_at, null)
})

test('buildRelatorioMovePatch move para expirada sem alterar o status real da ficha', () => {
  const ficha = { status: 'aprovado', raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, imobiliaria_retornou: true } }
  const patch = buildRelatorioMovePatch(ficha, 'expirada', '2026-07-01T08:00:00.000Z')
  assert.equal(patch.status, undefined)
  assert.equal(patch.raw_data.manually_expired, true)
  assert.equal(patch.raw_data.manually_expired_em, '2026-07-01T08:00:00.000Z')
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
})

test('buildRelatorioMovePatch com coluna desconhecida retorna null em vez de gravar status arbitrario', () => {
  assert.equal(buildRelatorioMovePatch({ status: 'aprovado' }, 'coluna_inexistente'), null)
})

test('buildDesistiuPatch marca cancelado, grava finalizada_em e limpa marcas de cobranca/expiracao', () => {
  const ficha = { status: 'aprovado', raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, imobiliaria_retornou: true, manually_expired: true, foo: 'bar' } }
  const patch = buildDesistiuPatch(ficha, '2026-07-10T12:00:00.000Z')
  assert.equal(patch.status, 'cancelado')
  assert.equal(patch.finalizada_em, '2026-07-10T12:00:00.000Z')
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.imobiliaria_retornou, false)
  assert.equal(patch.raw_data.manually_expired, false)
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildRelatorioMovePatch com coluna desistiu delega para buildDesistiuPatch', () => {
  const patch = buildRelatorioMovePatch({ status: 'aprovado', raw_data: {} }, 'desistiu', '2026-07-10T12:00:00.000Z')
  assert.equal(patch.status, 'cancelado')
  assert.equal(patch.finalizada_em, '2026-07-10T12:00:00.000Z')
})

test('ficha movida para expirada continua com status buscavel pelo relatorio (nao some do REPORT_STATUSES)', () => {
  const ficha = { status: 'aprovado', created_at: '2026-07-01T00:00:00.000Z', raw_data: {} }
  const patch = buildRelatorioMovePatch(ficha, 'expirada', '2026-07-05T00:00:00.000Z')
  const depoisDoMove = { ...ficha, raw_data: patch.raw_data }

  assert.equal(depoisDoMove.status, 'aprovado')
  assert.equal(getFichaOperationalState(depoisDoMove, { now: new Date('2026-07-06T00:00:00.000Z') })?.id, 'expirada')
})

test('restaurar para aprovada limpa o marcador manual mas nao revive ficha genuinamente vencida (45+ dias)', () => {
  const now = new Date('2026-08-20T00:00:00.000Z')
  const fichaAntiga = { status: 'aprovado', created_at: '2026-06-01T00:00:00.000Z', raw_data: { manually_expired: true } }

  assert.equal(isFichaExpiredOperational({ ...fichaAntiga, raw_data: { ...fichaAntiga.raw_data, manually_expired: false } }, { now }), true)

  const restaurada = buildAprovadaPatch(fichaAntiga)
  const depoisRestaurar = { ...fichaAntiga, ...restaurada, raw_data: restaurada.raw_data }
  assert.equal(getFichaOperationalState(depoisRestaurar, { now })?.id, 'expirada')
})

test('isCobrancaEnviadaVisivel só é true para enviado_cobranca e recuperados', () => {
  assert.equal(isCobrancaEnviadaVisivel('enviado_cobranca'), true)
  assert.equal(isCobrancaEnviadaVisivel('recuperados'), true)
  assert.equal(isCobrancaEnviadaVisivel('aprovada'), false)
  assert.equal(isCobrancaEnviadaVisivel('emitida'), false)
  assert.equal(isCobrancaEnviadaVisivel('expirada'), false)
})

test('getCobrancaEnviadaDisplay usa apenas o histórico de cobrança', () => {
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
