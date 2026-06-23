/**
 * Parser de apólices PDF por seguradora.
 * Extrai campos do texto bruto via pdfjs-dist e regex específicos para cada layout.
 */
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateBR(str) {
  if (!str) return ''
  const parts = str.trim().split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseMoneyBR(str) {
  if (!str) return null
  const s = String(str).trim()
  let clean = s
  if (s.includes(',')) {
    // BR format: 1.234,56 → remove . then , → .
    clean = s.replace(/\./g, '').replace(',', '.')
  }
  const val = parseFloat(clean)
  return isNaN(val) ? null : val
}

function fmt(val) {
  if (val == null) return ''
  return String(val)
}

// ─── Extração de texto do PDF ─────────────────────────────────────────────────

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText
}

// ─── Porto Seguro ─────────────────────────────────────────────────────────────
// Layout: tabela de cabeçalho com APÓLICE Nº, vigência em texto corrido,
// LOCAL DE RISCO, TIPO DE LOCAÇÃO, PREÇO DO SEGURO com Valor da Parcela e 29X.

function parsePortoSeguro(text) {
  const r = {}

  // Número da apólice — linha "APÓLICE Nº 59.0746.000000010972294.0000"
  // O número útil fica entre o bloco inicial "59.0746.0000000" e o sufixo final ".0000".
  const ap = text.match(/AP[ÓO]LICE\s+N[º°]\s*([0-9.\s]+)/i)
  if (ap) {
    const cleaned = ap[1].replace(/\s+/g, '')
    const middle = cleaned.match(/^\d{2}\.\d{4}\.\d{7}(\d+)(?:\.\d{4})?$/)
    r.numero_apolice = middle?.[1] || cleaned.replace(/\.\d{4}$/, '')
  }

  // Vigência — "a partir das 24 horas do dia DD/MM/YYYY até as 24 horas do dia DD/MM/YYYY"
  const vig = text.match(
    /a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eé] as 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i
  )
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia    = parseDateBR(vig[2])
  }

  // Endereço — "LOCAL DE RISCO  AV SAULLE PAGNONCELLI 317 CASA 2, 07081170, JARDIM..."
  const end = text.match(/LOCAL DE RISCO\s+(.+?)(?=\s+PRIMEIRO LOCAT|\s+CPF\/CNPJ|\s+ESTIPULANTE)/i)
  if (end) r.endereco = end[1].trim()

  // CEP — 8 dígitos dentro do endereço
  if (r.endereco) {
    const cep = r.endereco.match(/\b(\d{8})\b/)
    if (cep) r.cep = cep[1]
  }

  // Tipo de imóvel / locação — "TIPO DE LOCAÇÃO  1 – Residencial"
  const tipo = text.match(/TIPO DE LOCA[ÇC][ÃA]O\s+\d+\s*[–\-]\s*(\w+)/i)
  if (tipo) r.tipo_imovel = tipo[1]

  // Aluguel (verba declarada) — linha "Aluguel R$ 1.500,00 30x R$ ..."
  const alug = text.match(/Aluguel\s+R\$\s*([\d.,]+)\s+\d+x/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  // Prêmio Líquido — seção "PREÇO DO SEGURO": após "Prêmio Tarifário" e "Desconto"
  const premioSec = text.match(
    /Pr[êe]mio Tarif[áa]rio[\s\S]{1,300}?Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i
  )
  if (premioSec) r.premio_liquido = parseMoneyBR(premioSec[1])

  // Prêmio Total — "Preço Total do Seguro R$ 3.687,93"
  const ptot = text.match(/Pre[çc]o Total do Seguro\s+R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  // Valor da Parcela — "Valor da Parcela R$ 127,17"
  const parc = text.match(/Valor da Parcela\s+R\$\s*([\d.,]+)/i)
  if (parc) r.valor_parcela = parseMoneyBR(parc[1])

  // Parcelamento — "Fatura sem entrada 29X" ou "29X" após tipo de pagamento
  const nparc = text.match(/Fatura\s+sem\s+entrada\s*(\d+)X/i)
    || text.match(/Tipo de Pagamento\s+Fatura sem entrada\s*\n?\s*(\d+)X/i)
    || text.match(/(\d+)X\s*(?:sem juros)?/i)
  if (nparc) r.parcelamento = parseInt(nparc[1], 10)

  // Número da proposta
  const prop = text.match(/PROPOSTA N[º°]\s+([\w-]+)/i)
  if (prop) r.numero_proposta = prop[1].trim()

  // Proprietário (locador) — "LOCADOR  FULANO DE TAL  CPF/CNPJ..."
  const locador = text.match(/\bLOCADOR\b\s+(.+?)(?=\s+CPF\/CNPJ|\s+CNPJ|\s+CPF|\s+SEGUNDO|\s+TERCEIRO)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  r.forma_pagamento = 'fatura_sem_entrada'

  return r
}

// ─── Pottencial ───────────────────────────────────────────────────────────────
// Layout: cabeçalho com "Nº DA APÓLICE" em bloco separado,
// vigência em "Das 0h do dia … às 0h do dia …",
// pagamento em "Fatura mensal em 30 x sem juros: R$ 171,26",
// dados do imóvel na pág 3 com "Local do Risco:".

function parsePottencial(text) {
  const r = {}

  // Número da apólice — longa sequência após "Nº DA APÓLICE"
  const ap = text.match(/N[º°]\s*DA\s*AP[ÓO]LICE\s+(\d{10,})/i)
  if (ap) r.numero_apolice = ap[1].trim()

  // Número da proposta
  const prop = text.match(/N[º°]\s*DA\s*PROPOSTA\s+(\d+)/i)
  if (prop) r.numero_proposta = prop[1].trim()

  // Vigência — "Das 0h do dia 25/06/2026 às 0h do dia 25/12/2028"
  const vig = text.match(/Das 0h do dia (\d{2}\/\d{2}\/\d{4})\s+[àa]s 0h do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia    = parseDateBR(vig[2])
  }

  // Alternativa: "Vigência do contrato de locação: DD/MM/YYYY à DD/MM/YYYY"
  if (!r.inicio_vigencia) {
    const vigAlt = text.match(
      /Vig[êe]ncia do contrato de loca[çc][aã]o:\s*(\d{2}\/\d{2}\/\d{4})\s*[àa]\s*(\d{2}\/\d{2}\/\d{4})/i
    )
    if (vigAlt) {
      r.inicio_vigencia = parseDateBR(vigAlt[1])
      r.fim_vigencia    = parseDateBR(vigAlt[2])
    }
  }

  // Endereço — "Local do Risco: CONDESSA AMALIA 204 AP 06 JARDIM SANTA MENA 07096010 GUARULHOS SP"
  const end = text.match(/Local do Risco:\s*(.+?)(?=\s*Vig[êe]ncia|\s*LOCAT[ÁA]RIO|\s*LOCADOR|\n\n)/i)
  if (end) r.endereco = end[1].trim()

  // CEP — 8 dígitos dentro do endereço
  if (r.endereco) {
    const cep = r.endereco.match(/\b(\d{8})\b/)
    if (cep) r.cep = cep[1]
  }

  // Tipo de locação — "Tipo de locação: Residencial"
  const tipo = text.match(/Tipo de loca[çc][aã]o:\s*(\w+)/i)
  if (tipo) r.tipo_imovel = tipo[1]

  // Proprietário (locador)
  const locador = text.match(/LOCADOR\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*E-mail|\s*Celular|\s*Endere)/i)
    || text.match(/PROPRIET[ÁA]RIO\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*E-mail|\s*Celular)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  // Aluguel — "Aluguel R$ 1.600,00 R$ 48.000,00 R$ 3.304,11"
  const alug = text.match(/Aluguel\s+R\$\s*([\d.,]+)\s+R\$/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  // Prêmio Líquido — "VALOR DO SEGURO … Prêmio Líquido R$ 4.784,66"
  const premioSec = text.match(/VALOR DO SEGURO[\s\S]{1,100}?Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i)
  if (premioSec) r.premio_liquido = parseMoneyBR(premioSec[1])

  // Prêmio Total — "Prêmio Total: R$ 5.137,77"
  const ptot = text.match(/Pr[êe]mio Total:?\s+R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  // Valor da Parcela + Parcelamento — "Fatura mensal em 30 x sem juros: R$ 171,26"
  const pag = text.match(/Fatura mensal em (\d+)\s*x\s*sem juros:?\s+R\$\s*([\d.,]+)/i)
  if (pag) {
    r.parcelamento  = parseInt(pag[1], 10)
    r.valor_parcela = parseMoneyBR(pag[2])
  }

  r.forma_pagamento = 'fatura_sem_entrada'

  return r
}

// ─── Tokio Marine ─────────────────────────────────────────────────────────────
// Layout: "Apólice: 00091477", vigência em linha "Vigência: a partir das…",
// seção "DADOS DO ITEM" com Local do Risco, CEP, Tipo de Imóvel separados,
// "Prêmio Líquido Total R$: 6.621,06", tabela de parcelas com valores pontados.

function parseTokioMarine(text) {
  const r = {}

  // Número da apólice — "Apólice: 00091477"
  const ap = text.match(/Ap[óo]lice:\s*(\d+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  // Vigência — "Vigência: a partir das 24 horas do dia 05/06/2026 até às 24 horas do dia 05/12/2028"
  const vig = text.match(
    /Vig[êe]ncia:\s*a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eé] [àa]s 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i
  )
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia    = parseDateBR(vig[2])
  }

  // Endereço composto de vários campos da seção DADOS DO ITEM
  const local   = text.match(/Local do Risco:\s*(.+?)(?=\s+Complemento:|\s+N[uú]mero|\s+Bairro:|$)/i)
  const numero  = text.match(/N[uú]mero Logradouro:\s*(\d+)/i)
  const compl   = text.match(/Complemento:\s*(.+?)(?=\s+N[uú]mero|\s+Bairro:|$)/i)
  const bairro  = text.match(/Bairro:\s*(.+?)(?=\s+Cidade:|$)/i)
  const cidade  = text.match(/Cidade:\s*(.+?)(?=\s+CEP:|$)/i)
  if (local) {
    let end = local[1].trim()
    if (numero) end += ', ' + numero[1]
    if (compl)  end += ' ' + compl[1].trim()
    if (bairro) end += ' - ' + bairro[1].trim()
    if (cidade) end += ' - ' + cidade[1].trim()
    r.endereco = end
  }

  // CEP — "CEP: 07031-000"
  const cep = text.match(/CEP:\s*([\d]{5}-?[\d]{3})/i)
  if (cep) r.cep = cep[1].replace('-', '')

  // Tipo de imóvel — "Tipo de Imóvel: Apartamento"
  const tipoIm = text.match(/Tipo de Im[óo]vel:\s*(\w+)/i)
  if (tipoIm) r.tipo_imovel = tipoIm[1]

  // Aluguel (verba declarada) — última coluna da linha Aluguel na tabela COBERTURAS
  // "Aluguel Até 30 vezes a verba declarada 4.014,50 2.000,00"
  const alug = text.match(
    /Aluguel\s+At[eé] \d+ vezes a verba declarada\s+([\d.,]+)\s+([\d.,]+)/i
  )
  if (alug) r.valor_aluguel = parseMoneyBR(alug[2]) // última coluna = verba declarada

  // Proprietário (locador)
  const locador = text.match(/(?:Locador|Propriet[áa]rio)[:\s]+(.+?)(?=\s+CPF|\s+Data de Nasc|\s+Tipo|\s+Bairro)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  // Prêmio Líquido Total — "Prêmio Líquido Total R$: 6.621,06"
  const premioTot = text.match(/Pr[êe]mio L[íi]quido Total R\$[:\s]+([\d.,]+)/i)
  if (premioTot) r.premio_liquido = parseMoneyBR(premioTot[1])

  // Prêmio Total — "Prêmio Total: R$ 7.109,68"
  const ptot = text.match(/Pr[êe]mio Total:\s*R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  // Valor da 1ª parcela na tabela: "01 245.15 10/07/2026 Ficha" ou "01 245,15 ..."
  const parc1 = text.match(/\b0?1\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/i)
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  // Parcelamento — número da última parcela antes do fim da tabela
  const allRows = [...text.matchAll(/\b(\d{2})\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/gi)]
  if (allRows.length > 0) {
    r.parcelamento = parseInt(allRows[allRows.length - 1][1], 10)
  }

  return r
}

// ─── Too Seguros ──────────────────────────────────────────────────────────────
// Layout: "APÓLICE Nº 1074600194858", vigência em "INÍCIO DE VIGÊNCIA DAS 24H",
// Local do Risco com bairro/cidade na mesma seção,
// "PRÊMIO LÍQUIDO: 3.658,23 … PRÊMIO TOTAL: 3.928,21",
// tabela de parcelas: "1 126,03 0,00 0,00 9,30 135,33 23/07/2026"

function parseTooSeguros(text) {
  const r = {}

  // Número da apólice — "APÓLICE Nº 1074600194858"
  const ap = text.match(/AP[ÓO]LICE N[º°]\s+([\d]+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  // Número da proposta — "PROPOSTA Nº 000835"
  const prop = text.match(/PROPOSTA N[º°]\s+([\d]+)/i)
  if (prop) r.numero_proposta = prop[1].trim()

  // Vigência — "INÍCIO DE VIGÊNCIA DAS 24H 25/06/2026" e "TÉRMINO DE VIGÊNCIA DAS 24H 25/12/2028"
  const vigI = text.match(/IN[IÍ]CIO DE VIG[EÊ]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  const vigF = text.match(/T[EÉ]RMINO DE VIG[EÊ]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (vigI) r.inicio_vigencia = parseDateBR(vigI[1])
  if (vigF) r.fim_vigencia    = parseDateBR(vigF[1])

  // Endereço — "Local do Risco: Avenida José Brumatti, 2856 - BLOCO 03 APTO 96"
  const end    = text.match(/Local do Risco:\s*(.+?)(?=\s*Bairro:|$)/i)
  const bairro = text.match(/Bairro:\s*(.+?)(?=\s*Cidade:|$)/i)
  const cidade = text.match(/Cidade:\s*(.+?)(?=\s*UF:|$)/i)
  if (end) {
    let e = end[1].trim()
    if (bairro) e += ' - ' + bairro[1].trim()
    if (cidade) e += ' - ' + cidade[1].trim()
    r.endereco = e
  }

  // CEP — "CEP: 07.160-445"
  const cep = text.match(/CEP:\s*([\d.]+(?:-[\d]+)?)/i)
  if (cep) r.cep = cep[1].replace(/[.\-]/g, '')

  // Tipo de imóvel — "Imóvel - Residencial"
  const tipo = text.match(/Im[óo]vel\s*-\s*(\w+)/i)
  if (tipo) r.tipo_imovel = tipo[1]

  // Proprietário (locador)
  const locador = text.match(/PROPRIET[ÁA]RIO\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*CELULAR|\s*E-MAIL|\n)/i)
    || text.match(/LOCADOR\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*CELULAR|\n)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  // Aluguel — "Aluguel 1.400,00 42.000,00 2.946,76" (verba declarada = 1ª coluna)
  const alug = text.match(/Aluguel\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  // Prêmio Líquido — "PRÊMIO LÍQUIDO: 3.658,23"
  const prem = text.match(/PR[ÊE]MIO L[ÍI]QUIDO:\s*([\d.,]+)/i)
  if (prem) r.premio_liquido = parseMoneyBR(prem[1])

  // Prêmio Total — "PRÊMIO TOTAL: 3.928,21"
  // Cuidado: existe "PRÊMIO TOTAL LÍQUIDO" antes — pegar o último match
  const ptotAll = [...text.matchAll(/PR[ÊE]MIO TOTAL:\s*([\d.,]+)/gi)]
  if (ptotAll.length > 0) r.premio_total = parseMoneyBR(ptotAll[ptotAll.length - 1][1])

  // Valor da parcela (prêmio total com IOF): coluna 6 da linha 1 da tabela
  // "1 126,03 0,00 0,00 9,30 135,33 23/07/2026"
  const parc1 = text.match(
    /\b1\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}/i
  )
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  // Parcelamento — último número de linha da tabela
  const allRows = [...text.matchAll(
    /\b(\d+)\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}/gi
  )]
  if (allRows.length > 0) {
    const last = parseInt(allRows[allRows.length - 1][1], 10)
    if (last > 0) r.parcelamento = last
  }

  return r
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

const PARSERS = {
  porto:        parsePortoSeguro,
  'porto seguro': parsePortoSeguro,
  pottencial:   parsePottencial,
  tokio:        parseTokioMarine,
  'tokio marine': parseTokioMarine,
  too:          parseTooSeguros,
  'too seguros': parseTooSeguros,
}

function findParser(seguradora) {
  if (!seguradora) return null
  const s = seguradora.toLowerCase().trim()
  if (PARSERS[s]) return PARSERS[s]
  for (const [key, fn] of Object.entries(PARSERS)) {
    if (s.includes(key) || key.includes(s)) return fn
  }
  return null
}

/**
 * Extrai campos de uma apólice PDF de acordo com a seguradora selecionada.
 * @param {string} seguradora — nome da seguradora selecionada no form
 * @param {File}   file       — arquivo PDF
 * @returns {Promise<{campos: object, extras: object, semParser: boolean}>}
 *   campos  → campos do form (numero_apolice, inicio_vigencia, etc.)
 *   extras  → informações extras não mapeadas para inputs (cep, tipo_imovel, valor_aluguel)
 *   semParser → true se seguradora sem parser configurado
 */
export async function parseApolice(seguradora, file) {
  const text = await extractPdfText(file)
  const parser = findParser(seguradora)

  if (!parser) {
    return { campos: {}, extras: {}, semParser: true, _text: text }
  }

  const raw = parser(text)

  // Separar campos que preenchem inputs dos extras informativos
  const { cep, tipo_imovel, valor_aluguel, forma_pagamento, ...camposForm } = raw

  return {
    campos: {
      ...camposForm,
      // formatação numérica como string para inputs controlados
      premio_liquido:  raw.premio_liquido != null ? fmt(raw.premio_liquido) : '',
      premio_total:    raw.premio_total   != null ? fmt(raw.premio_total)   : '',
      valor_parcela:   raw.valor_parcela  != null ? fmt(raw.valor_parcela)  : '',
      parcelamento:    raw.parcelamento   != null ? fmt(raw.parcelamento)   : '',
      forma_pagamento: forma_pagamento || '',
    },
    extras: {
      cep:          cep          || null,
      tipo_imovel:  tipo_imovel  || null,
      valor_aluguel: valor_aluguel != null ? valor_aluguel : null,
    },
    semParser: false,
    _text: text,
  }
}
