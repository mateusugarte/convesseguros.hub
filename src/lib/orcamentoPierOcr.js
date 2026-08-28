import { createWorker, PSM } from 'tesseract.js'

import { formatarMoeda, moeda, percentual } from './orcamentoParserUtils.js'

const PARCELAMENTO_BOLETO_PIER = 'Boleto: até 10x sem juros'

export async function lerProdutosPierViaOcr(file) {
  const { renderPdfPageCanvas } = await import('./apoliceParser.js')
  const canvas = await renderPdfPageCanvas(file, 2, { scale: 2.8 })
  const worker = await createWorker('eng')
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '220',
    })
    const { data } = await worker.recognize(canvas)
    return extrairProdutosPierOcr(data.text || '')
  } finally {
    await worker.terminate()
  }
}

export function extrairProdutosPierOcr(texto) {
  const bruto = String(texto || '')
  const valores = [...bruto.matchAll(/R\$\s*([\d.]{1,12},\d{2})/gi)]
    .map(m => moeda(m[1]))
    .filter(v => v != null)

  // A página de produto da Pier tem os dois cards lado a lado. Depois dos
  // limites e franquias, os quatro últimos valores monetários são:
  // personalizado 12x, personalizado total, completo 12x, completo total.
  const finais = valores.slice(-4)
  const [parcelaPersonalizado, totalPersonalizado, parcelaCompleto, totalCompleto] = finais
  const percentualFipe = numeroPercentual(
    bruto.match(/Cobertura\s+Pier[\s\S]{0,80}?\(([\d.,]+)\s*%\)/i)?.[1]
      || bruto.match(/\(([\d.,]+)\s*%\)/)?.[1],
  )
  const terceiros = extrairTerceirosPier(bruto)
  const carroReserva = extrairCarroReservaPier(bruto)

  return {
    personalizado: limparDadosProduto({
      premio_total: totalPersonalizado,
      premio_parcelado: textoParcelamentoPier(parcelaPersonalizado),
      percentual_fipe: percentualFipe,
      limite_terceiros: terceiros,
      carro_reserva: carroReserva,
      carro_reserva_detalhe: carroReserva,
    }),
    completo: limparDadosProduto({
      premio_total: totalCompleto,
      premio_parcelado: textoParcelamentoPier(parcelaCompleto),
      percentual_fipe: percentualFipe,
      limite_terceiros: terceiros,
      carro_reserva: carroReserva,
      carro_reserva_detalhe: carroReserva,
    }),
  }
}

function limparDadosProduto(dados) {
  return Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== '' && valor != null))
}

function numeroPercentual(valor) {
  if (valor == null || valor === '') return null
  const n = percentual(`${valor}%`)
  return Number.isFinite(n) ? n : null
}

function textoParcelamentoPier(parcela12x) {
  const cartao = parcela12x != null
    ? `Cartão de crédito: até 12x de ${formatarMoeda(parcela12x)} sem juros`
    : 'Cartão de crédito: até 12x sem juros'
  return [cartao, PARCELAMENTO_BOLETO_PIER]
}

function extrairTerceirosPier(texto) {
  const fisicos = valorDepoisDe(texto, /Danos\s+f[ií]sicos\s+a\s+pessoas/i)
  const materiais = valorDepoisDe(texto, /Danos\s+a\s+bens\s+materiais/i)
  const morais = valorDepoisDe(texto, /Danos\s+morais/i)
  const partes = [
    fisicos != null ? `${formatarMoeda(fisicos)} danos físicos a pessoas` : '',
    materiais != null ? `${formatarMoeda(materiais)} danos materiais` : '',
    morais != null ? `${formatarMoeda(morais)} danos morais` : '',
  ].filter(Boolean)
  return partes.join(' · ')
}

function valorDepoisDe(texto, rotulo) {
  const m = String(texto || '').match(new RegExp(`${rotulo.source}[\\s\\S]{0,50}?R\\$\\s*([\\d.]{1,12},\\d{2})`, 'i'))
  return moeda(m?.[1])
}

function extrairCarroReservaPier(texto) {
  const m = String(texto || '').match(/Carro\s+reserva[\s\S]{0,80}?(?:por\s+)?(\d{1,2})\s*dias/i)
  return m ? `Veículo básico por ${m[1]} dias` : ''
}
