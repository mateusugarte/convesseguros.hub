import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildImobiliariasMappingState,
  normalizeImobiliariaKey,
  sanitizeImobiliariaAliasList,
} from './imobiliariasMapeamento.js'

test('normalizeImobiliariaKey ignora acentos, case e espacos extras', () => {
  assert.equal(normalizeImobiliariaKey('  Ápice   Imóveis  '), 'apice imoveis')
  assert.equal(normalizeImobiliariaKey('APICE IMOVEIS'), 'apice imoveis')
})

test('sanitizeImobiliariaAliasList remove duplicatas normalizadas e alias igual ao nome canonico', () => {
  const out = sanitizeImobiliariaAliasList(
    ['Alpha', ' alpha  ', 'ALPHA IMÓVEIS', 'Alpha Imoveis', '', 'Beta'],
    'Alpha Imóveis'
  )

  assert.deepEqual(out, ['Alpha', 'Beta'])
})

test('buildImobiliariasMappingState soma contagens do nome canonico e dos aliases', () => {
  const { mapeadasList, naoMapeadasList } = buildImobiliariasMappingState({
    contagemPorNome: {
      'Alpha Imóveis': 2,
      ' ALPHA IMOVEIS ': 3,
      Alpha: 1,
      Beta: 4,
    },
    imobiData: [
      {
        id: '1',
        nome_canonico: 'Alpha Imóveis',
        imobiliaria_aliases: [{ alias: 'Alpha' }],
      },
    ],
  })

  assert.equal(mapeadasList[0].totalFichas, 6)
  assert.deepEqual(naoMapeadasList, [{ nome: 'Beta', totalFichas: 4 }])
})
