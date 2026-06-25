/**
 * Parser de apólices PDF por seguradora.
 * Extrai campos do texto bruto via pdfjs-dist e regex específicos para cada layout.
 */
import * as pdfjsLib from 'pdfjs-dist'
import { sanitizeProprietarioNome } from './text.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

function parseDateBR(str) {
  if (!str) return ''
  const parts = String(str).trim().split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseMoneyBR(str) {
  if (!str) return null
  const s = String(str).trim()
  const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const val = parseFloat(clean)
  return Number.isNaN(val) ? null : val
}

function fmt(val) {
  if (val == null) return ''
  return String(val)
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

const EMAIL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i

function extractOwnerEmail(text, sectionRegexes = []) {
  for (const regex of sectionRegexes) {
    const match = text.match(regex)
    if (!match) continue
    const start = typeof match.index === 'number' ? match.index : text.search(regex)
    const snippet = start >= 0 ? text.slice(start, start + 420) : text
    const email = snippet.match(EMAIL_RE)
    if (email) return email[1].trim()
  }

  const generic = text.match(/\b(?:E-?MAIL|EMAIL)\b\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  return generic ? generic[1].trim() : null
}

export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText
}

function parsePortoSeguro(text) {
  const r = {}
  const normalized = normalizeText(text)

  const ap = normalized.match(/59\s*\.?\s*0746\s*\.?\s*0000000\s*([0-9. ]{6,})/i)
  if (ap) {
    const candidate = ap[1].trim().replace(/\s+/g, '').replace(/^\.+|\.+$/g, '').split('.')[0]
    if (candidate) r.numero_apolice = candidate
  } else {
    const header = normalized.match(/AP[ÓO]LICE\s+N[º°]\s*([0-9.\s]{16,})/i)
    if (header) {
      const cleaned = header[1].replace(/\s+/g, '')
      const tail = cleaned.match(/^59\.0746\.0000000(\d+)(?:\.\d{4})?$/i)
      if (tail) r.numero_apolice = tail[1]
    }
  }

  const vig = normalized.match(/a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eé] as 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia = parseDateBR(vig[2])
  }

  const end = normalized.match(/LOCAL DE RISCO\s+(.+?)(?=\s+PRIMEIRO LOCAT|\s+CPF\/CNPJ|\s+ESTIPULANTE)/i)
  if (end) r.endereco = end[1].trim()
  if (r.endereco) {
    const cep = r.endereco.match(/\b(\d{8})\b/)
    if (cep) r.cep = cep[1]
  }

  const tipo = normalized.match(/TIPO DE LOCA(?:ÇÃO|CAO)\s+\d+\s*[-–]\s*(\w+)/i)
  if (tipo) r.tipo_imovel = tipo[1].trim()

  const alug = normalized.match(/Aluguel\s+R\$\s*([\d.,]+)\s+\d+x/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  const premioSec = normalized.match(/Pr[êe]mio Tarif[áa]rio[\s\S]{1,300}?Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i)
  if (premioSec) r.premio_liquido = parseMoneyBR(premioSec[1])

  const ptot = normalized.match(/Pre[çc]o Total do Seguro\s+R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  const parc = normalized.match(/Valor da Parcela\s+R\$\s*([\d.,]+)/i)
  if (parc) r.valor_parcela = parseMoneyBR(parc[1])

  const nparc = normalized.match(/Fatura\s+sem\s+entrada\s*(\d+)X/i)
    || normalized.match(/Tipo de Pagamento\s+Fatura sem entrada\s*(\d+)X/i)
    || normalized.match(/(\d+)X\s*(?:sem juros)?/i)
  if (nparc) r.parcelamento = parseInt(nparc[1], 10)

  const prop = normalized.match(/PROPOSTA N[º°]\s+([\w.-]+)/i)
  if (prop && /^[0-9./-]+$/.test(prop[1].trim())) r.numero_proposta = prop[1].trim()

  const locatario = normalized.match(
    /PRIMEIRO\s+LOCAT[ÁA]RIO\s+CPF\/CNPJ\s+([\d./-]+)\s+NOME\/RAZ(?:ÃO|AO)\s+SOCIAL\s+(.+?)(?=\s+NOME SOCIAL|\s+PROFISS(?:ÃO|AO)|\s+ESTIPULANTE)/i
  )
  if (locatario) {
    r.documento_locatario = locatario[1].trim()
    r.nome_locatario = locatario[2].trim()
  }

  const locador = normalized.match(/\bLOCADOR\b\s+(.+?)(?=\s+CPF\/CNPJ|\s+CNPJ|\s+CPF|\s+SEGUNDO|\s+TERCEIRO)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  if (!r.nome_proprietario) {
    const segurado =
      normalized.match(/\bDADOS?\s+DO\s+SEGURADO\b[\s\S]{0,250}?NOME\/RAZ(?:ÃO|AO)\s+SOCIAL\s+(.+?)(?=\s+NOME SOCIAL|\s+CPF\/CNPJ|\s+CEP|\s+ENDEREÇO)/i) ||
      normalized.match(/\bSEGURADO\b\s*:?\s*(.+?)(?=\s*(?:CPF|CNPJ|DATA DE NASCIMENTO|NASCIMENTO|CELULAR|TELEFONE|FONE|E-?MAIL|ENDERE|LOCAL DE RISCO))/i)
    if (segurado) r.nome_proprietario = segurado[1].trim()
  }

  const email = extractOwnerEmail(normalized, [
    /DADOS?\s+DO\s+SEGURADO[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bSEGURADO\b[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bLOCADOR\b[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ])
  if (email) r.email_proprietario = email

  const celSegurado =
    normalized.match(/\b(?:CELULAR|TELEFONE|FONE)\b\s*:?\s*(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i) ||
    normalized.match(/\b(?:CELULAR|TELEFONE|FONE)\b[\s\S]{0,60}?(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i)
  if (celSegurado) r.proprietario_cel = celSegurado[1].trim()

  r.forma_pagamento = 'fatura_sem_entrada'
  return r
}

function parsePottencial(text) {
  const r = {}
  const normalized = normalizeText(text)

  const ap = normalized.match(/N[º°]\s*DA\s*AP[ÓO]LICE\s+(\d{10,})/i)
  if (ap) r.numero_apolice = ap[1].trim()

  const prop = normalized.match(/N[º°]\s*DA\s*PROPOSTA\s+(\d+)/i)
  if (prop) r.numero_proposta = prop[1].trim()

  const vig = normalized.match(/Das 0h do dia (\d{2}\/\d{2}\/\d{4})\s+[àa]s 0h do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia = parseDateBR(vig[2])
  }

  if (!r.inicio_vigencia) {
    const vigAlt = normalized.match(/Vig[êe]ncia do contrato de loca[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})\s*[àa]\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (vigAlt) {
      r.inicio_vigencia = parseDateBR(vigAlt[1])
      r.fim_vigencia = parseDateBR(vigAlt[2])
    }
  }

  const end = normalized.match(/Local do Risco:\s*(.+?)(?=\s*Vig[êe]ncia|\s*LOCAT[ÁA]RIO|\s*LOCADOR|\s*LOCAT[ÁA]RIOS|\n\n)/i)
  if (end) r.endereco = end[1].trim()
  if (r.endereco) {
    const cep = r.endereco.match(/\b(\d{8})\b/)
    if (cep) r.cep = cep[1]
  }

  const tipo = normalized.match(/Tipo de loca[çc][ãa]o:\s*(\w+)/i)
  if (tipo) r.tipo_imovel = tipo[1].trim()

  const locatario =
    normalized.match(/LOCAT[ÁA]RIOS?\s*\(?(?:Garantid[oa]s?)?\)?\s+Nome:\s+(.+?)\s+CPF:\s*([\d./-]+)/i) ||
    normalized.match(/Locat[áa]rio\s*\(Garantido\)\s+(.+?)\s+CPF:\s*([\d./-]+)/i)
  if (locatario) {
    r.nome_locatario = locatario[1].trim()
    r.documento_locatario = locatario[2].trim()
  }

  const locador = normalized.match(/LOCADOR\s*(?:\(Segurado\))?\s*Nome:\s+(.+?)\s+CPF:\s*([\d./-]+)/i)
    || normalized.match(/LOCADOR\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*E-mail|\s*Celular|\s*Endere)/i)
    || normalized.match(/PROPRIET[ÁA]RIO\s+Nome:\s+(.+?)\s+(?:CPF|CNPJ):\s*([\d./-]+)/i)
    || normalized.match(/PROPRIET[ÁA]RIO\s*:?\s*(.+?)(?=\s*CPF|\s*CNPJ|\s*E-mail|\s*Celular)/i)
  if (locador) {
    r.nome_proprietario = locador[1].trim()
    if (locador[2] && !r.proprietario_documento) r.proprietario_documento = locador[2].trim()
  }

  const email = extractOwnerEmail(normalized, [
    /LOCADOR\s*(?:\(Segurado\))?[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /PROPRIET[ÁA]RIO[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /DADOS?\s+DO\s+SEGURADO[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ])
  if (email) r.email_proprietario = email

  const alug = normalized.match(/Aluguel\s+R\$\s*([\d.,]+)\s+R\$/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  const premioSec = normalized.match(/VALOR DO SEGURO[\s\S]{1,100}?Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i)
  if (premioSec) r.premio_liquido = parseMoneyBR(premioSec[1])

  const ptot = normalized.match(/Pr[êe]mio Total:?\s+R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  const pag = normalized.match(/Fatura mensal em (\d+)\s*x\s*sem juros:?\s+R\$\s*([\d.,]+)/i)
  if (pag) {
    r.parcelamento = parseInt(pag[1], 10)
    r.valor_parcela = parseMoneyBR(pag[2])
  }

  r.forma_pagamento = 'fatura_sem_entrada'
  return r
}

function parseTokioMarine(text) {
  const r = {}
  const normalized = normalizeText(text)

  const ap = normalized.match(/Ap[óo]lice:\s*(\d+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  const vig = normalized.match(/Vig[êe]ncia:\s*a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eé] [àa]s 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia = parseDateBR(vig[2])
  }

  const local = normalized.match(/Local do Risco:\s*(.+?)(?=\s+Complemento:|\s+N[uú]mero|\s+Bairro:|$)/i)
  const numero = normalized.match(/N[uú]mero Logradouro:\s*(\d+)/i)
  const compl = normalized.match(/Complemento:\s*(.+?)(?=\s+N[uú]mero|\s+Bairro:|$)/i)
  const bairro = normalized.match(/Bairro:\s*(.+?)(?=\s+Cidade:|$)/i)
  const cidade = normalized.match(/Cidade:\s*(.+?)(?=\s+CEP:|$)/i)
  if (local) {
    let end = local[1].trim()
    if (numero) end += ', ' + numero[1]
    if (compl) end += ' ' + compl[1].trim()
    if (bairro) end += ' - ' + bairro[1].trim()
    if (cidade) end += ' - ' + cidade[1].trim()
    r.endereco = end
  }

  const cep = normalized.match(/CEP:\s*([\d]{5}-?[\d]{3})/i)
  if (cep) r.cep = cep[1].replace('-', '')

  const tipoIm = normalized.match(/Tipo de Im[óo]vel:\s*(\w+)/i)
  if (tipoIm) r.tipo_imovel = tipoIm[1]

  const alug = normalized.match(/Aluguel\s+At[eé] \d+ vezes a verba declarada\s+([\d.,]+)\s+([\d.,]+)/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[2])

  const locador = normalized.match(/(?:Locador|Propriet[áa]rio)[:\s]+(.+?)(?=\s+CPF|\s+Data de Nasc|\s+Tipo|\s+Bairro)/i)
  if (locador) r.nome_proprietario = locador[1].trim()

  const premioTot = normalized.match(/Pr[êe]mio L[íi]quido Total R\$[:\s]+([\d.,]+)/i)
  if (premioTot) r.premio_liquido = parseMoneyBR(premioTot[1])

  const ptot = normalized.match(/Pr[êe]mio Total:\s*R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  const parc1 = normalized.match(/\b0?1\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/i)
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  const allRows = [...normalized.matchAll(/\b(\d{2})\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/gi)]
  if (allRows.length > 0) r.parcelamento = parseInt(allRows[allRows.length - 1][1], 10)

  return r
}

function parseTokioMarineV2(text) {
  const r = {}
  const normalized = normalizeText(text)

  const ap = normalized.match(/Ap[Ã³o]lice:\s*(\d+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  const vig = normalized.match(/Vig[Ãªe]ncia:\s*a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eÃ©] [Ã a]s 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia = parseDateBR(vig[2])
  }

  const localSection = normalized.match(
    /Local do Risco:\s*(.+?)\s+N[uÃº]mero Logradouro:\s*(\d+)\s+Complemento:\s*(.+?)\s+Bairro:\s*(.+?)\s+Cidade:\s*(.+?)\s+CEP:\s*([\d]{5}-?[\d]{3})\s+UF:\s*([A-Z]{2})/i
  )
  if (localSection) {
    const [, logradouro, numero, complemento, bairro, cidade, cep, uf] = localSection
    r.endereco = [logradouro.trim(), numero.trim(), complemento.trim(), bairro.trim(), cidade.trim(), uf.trim()]
      .filter(Boolean)
      .join(', ')
    r.cep = cep.replace('-', '')
  }

  const tipoIm = normalized.match(/Tipo de Im[Ã³o]vel:\s*(\w+)/i)
  if (tipoIm) r.tipo_imovel = tipoIm[1]

  const alug = normalized.match(/Aluguel\s+At[eÃ©] \d+ vezes a verba declarada\s+([\d.,]+)\s+([\d.,]+)/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[2])

  const headerNames = normalized.match(
    /\d+\/\d+\s+(.+?)\s+Nome Social:\s+(.+?)\s+Nome Social:\s+Tokio Marine Aluguel - Ap[Ã³o]lice de Seguro/i
  )
  const cpfs = [...normalized.matchAll(/CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/gi)].map(match => match[1].trim())
  const celulares = [...normalized.matchAll(/Celular:\s*(\(\d{2}\)\s*\d{4,5}-\d{4})/gi)].map(match => match[1].trim())

  if (headerNames) {
    r.nome_proprietario = headerNames[1].trim()
    r.nome_locatario = headerNames[2].trim()
    if (cpfs[0]) r.proprietario_documento = cpfs[0]
    if (cpfs[1]) r.documento_locatario = cpfs[1]
    if (celulares[0]) r.proprietario_cel = celulares[0]
    if (celulares[1]) r.celular_locatario = celulares[1]
  }

  const premioTot = normalized.match(/Pr[Ãªe]mio L[Ã­i]quido Total R\$[:\s]+([\d.,]+)/i)
  if (premioTot) r.premio_liquido = parseMoneyBR(premioTot[1])

  const ptot = normalized.match(/Pr[Ãªe]mio Total:\s*R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  const parc1 = normalized.match(/\b0?1\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/i)
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  const allRows = [...normalized.matchAll(/\b(\d{2})\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/gi)]
  if (allRows.length > 0) r.parcelamento = parseInt(allRows[allRows.length - 1][1], 10)

  if (/Cobran[çc]a:\s*Ficha/i.test(normalized)) {
    r.forma_pagamento = 'fatura_sem_entrada'
  }

  return r
}

function parseTokioMarineV3(text) {
  const r = {}
  const normalized = normalizeText(text)
  const page3Index = normalized.indexOf('3/7 ')
  const page3Text = page3Index >= 0 ? normalized.slice(page3Index) : normalized

  const ap = normalized.match(/Ap\S*lice:\s*(\d+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  const vig = normalized.match(/Vig\S*ncia:\s*a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at\S* [\S]*s 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vig) {
    r.inicio_vigencia = parseDateBR(vig[1])
    r.fim_vigencia = parseDateBR(vig[2])
  }

  const localSection = normalized.match(
    /Local do Risco:\s*(.+?)\s+N\S*mero Logradouro:\s*(\d+)\s+Complemento:\s*(.+?)\s+Bairro:\s*(.+?)\s+Cidade:\s*(.+?)\s+CEP:\s*([\d]{5}-?[\d]{3})\s+UF:\s*([A-Z]{2})/i
  )
  if (localSection) {
    const [, logradouro, numero, complemento, bairro, cidade, cep, uf] = localSection
    r.endereco = [logradouro.trim(), numero.trim(), complemento.trim(), bairro.trim(), cidade.trim(), uf.trim()]
      .filter(Boolean)
      .join(', ')
    r.cep = cep.replace('-', '')
  }

  const tipoIm = normalized.match(/Tipo de Im\S*vel:\s*(\w+)/i)
  if (tipoIm) r.tipo_imovel = tipoIm[1]

  const alug = normalized.match(/Aluguel\s+At\S* \d+ vezes a verba declarada\s+([\d.,]+)\s+([\d.,]+)/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[2])

  const proprietarioMatch = page3Text.match(/\d+\/\d+\s+(.+?)\s+Nome Social:/i)
  const locatarioMatch = page3Text.match(/Nome Social:\s+(.+?)\s+Nome Social:\s+Tokio Marine Aluguel/i)
  const cpfs = [...page3Text.matchAll(/CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/gi)].map(match => match[1].trim())
  const celulares = [...page3Text.matchAll(/Celular:\s*(\(\d{2}\)\s*\d{4,5}-\d{4})/gi)].map(match => match[1].trim())

  if (proprietarioMatch && locatarioMatch) {
    r.nome_proprietario = proprietarioMatch[1].trim()
    r.nome_locatario = locatarioMatch[1].trim()
    if (cpfs[0]) r.proprietario_documento = cpfs[0]
    if (cpfs[1]) r.documento_locatario = cpfs[1]
    if (celulares[0]) r.proprietario_cel = celulares[0]
    if (celulares[1]) r.celular_locatario = celulares[1]
  }

  const email = extractOwnerEmail(page3Text, [
    /Nome Social:[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /PROPRIET[ÁA]RIO[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ])
  if (email) r.email_proprietario = email

  const premioTot = normalized.match(/Pr\S*mio L\S*quido Total R\$[:\s]+([\d.,]+)/i)
  if (premioTot) r.premio_liquido = parseMoneyBR(premioTot[1])

  const ptot = normalized.match(/Pr\S*mio Total:\s*R\$\s*([\d.,]+)/i)
  if (ptot) r.premio_total = parseMoneyBR(ptot[1])

  const parc1 = normalized.match(/\b0?1\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/i)
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  const allRows = [...normalized.matchAll(/\b(\d{2})\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}\s+Ficha/gi)]
  if (allRows.length > 0) r.parcelamento = parseInt(allRows[allRows.length - 1][1], 10)

  if (/Cobran[çc]a:\s*Ficha/i.test(normalized)) {
    r.forma_pagamento = 'fatura_sem_entrada'
  }

  return r
}

function parseTooSeguros(text) {
  const r = {}
  const normalized = normalizeText(text)

  const ap = normalized.match(/AP[ÓO]LICE N[º°]\s+([\d]+)/i)
  if (ap) r.numero_apolice = ap[1].trim()

  const prop = normalized.match(/PROPOSTA N[º°]\s+([\d]+)/i)
  if (prop) r.numero_proposta = prop[1].trim()

  const vigI = normalized.match(/IN[IÍ]CIO DE VIG[ÊE]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  const vigF = normalized.match(/T[ÉE]RMINO DE VIG[ÊE]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (vigI) r.inicio_vigencia = parseDateBR(vigI[1])
  if (vigF) r.fim_vigencia = parseDateBR(vigF[1])

  const segurado =
    normalized.match(/DADOS DO SEGURADO[\s\S]{0,250}?\bSegurado:\s*(.+?)(?=\s+CPF\/CNPJ|\s+CPF|\s+CNPJ)/i) ||
    normalized.match(/\bSEGURADO\b\s*:?\s*(.+?)(?=\s*(?:CPF|CNPJ|CELULAR|TELEFONE|FONE|E-?MAIL|ENDERE|Local do Risco|Bairro|Cidade))/i)
  if (segurado) r.nome_proprietario = segurado[1].trim()

  const seguradoDoc =
    normalized.match(/DADOS DO SEGURADO[\s\S]{0,250}?\bCPF\/CNPJ:\s*([\d./-]+)/i) ||
    normalized.match(/\bSEGURADO\b[\s\S]{0,120}?\bCPF\/CNPJ:\s*([\d./-]+)/i)
  if (seguradoDoc) r.proprietario_documento = seguradoDoc[1].trim()

  const garantido =
    normalized.match(/DADOS DO GARANTIDO[\s\S]{0,160}?\bGarantido:\s*(.+?)(?=\s+CPF:|\s+CPF\/CNPJ:)/i) ||
    normalized.match(/\bGarantido:\s*(.+?)(?=\s+CPF:|\s+CPF\/CNPJ:)/i)
  if (garantido) r.nome_locatario = garantido[1].trim()

  const garantidoDoc =
    normalized.match(/DADOS DO GARANTIDO[\s\S]{0,200}?\bCPF(?:\/CNPJ)?:\s*([\d./-]+)/i) ||
    normalized.match(/\bGarantido:\s*.+?\s+CPF(?:\/CNPJ)?:\s*([\d./-]+)/i)
  if (garantidoDoc) r.documento_locatario = garantidoDoc[1].trim()

  const email = extractOwnerEmail(normalized, [
    /DADOS DO SEGURADO[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bSEGURADO\b[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bLOCADOR\b[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bGARANTIDO\b[\s\S]{0,260}?(?:E-?MAIL|EMAIL)[:\s]*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ])
  if (email) r.email_proprietario = email

  const localRisco = normalized.match(/Local do Risco:\s*(.+?)(?=\s+Bairro:|\s+Tipo de LOCA|$)/i)
  const bairro = normalized.match(/Bairro:\s*(.+?)(?=\s+Cidade:|$)/i)
  const cidade = normalized.match(/Cidade:\s*(.+?)(?=\s+UF:|$)/i)
  const estado = normalized.match(/UF:\s*([A-Z]{2})/i)
  const cep = normalized.match(/CEP:\s*([\d.]+(?:-[\d]+)?)/i)
  if (localRisco) r.endereco_linha = localRisco[1].trim()
  if (bairro) r.bairro = bairro[1].trim()
  if (cidade) r.cidade = cidade[1].trim()
  if (estado) r.estado = estado[1].trim().toUpperCase()
  if (cep) r.cep = cep[1].replace(/[.\-]/g, '')

  r.endereco = [r.endereco_linha, r.bairro, r.cidade, r.estado].filter(Boolean).join(', ')

  const tipo =
    normalized.match(/TIPO DE LOCA(?:ÇÃO|CAO)[\s\S]{0,80}?\bIm[óo]vel\s*-\s*(Residencial|Comercial)/i) ||
    normalized.match(/Im[óo]vel\s*-\s*(Residencial|Comercial)/i)
  if (tipo) r.tipo_imovel = tipo[1]

  if (!r.proprietario_cel) {
    const celSegurado =
      normalized.match(/\b(?:CELULAR|TELEFONE|FONE)\b\s*:?\s*(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i) ||
      normalized.match(/\b(?:CELULAR|TELEFONE|FONE)\b[\s\S]{0,60}?(\(?\d{2}\)?\s*\d{4,5}-?\d{4})/i)
    if (celSegurado) r.proprietario_cel = celSegurado[1].trim()
  }

  const alug = normalized.match(/Aluguel\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/i)
  if (alug) r.valor_aluguel = parseMoneyBR(alug[1])

  const prem = normalized.match(/PR[ÊE]MIO L[ÍI]QUIDO:\s*([\d.,]+)/i)
  if (prem) r.premio_liquido = parseMoneyBR(prem[1])

  const ptotAll = [...normalized.matchAll(/PR[ÊE]MIO TOTAL:\s*([\d.,]+)/gi)]
  if (ptotAll.length > 0) r.premio_total = parseMoneyBR(ptotAll[ptotAll.length - 1][1])

  const parc1 = normalized.match(/\b1\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}/i)
  if (parc1) r.valor_parcela = parseMoneyBR(parc1[1])

  const allRows = [...normalized.matchAll(/\b(\d+)\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}/gi)]
  if (allRows.length > 0) {
    const last = parseInt(allRows[allRows.length - 1][1], 10)
    if (last > 0) r.parcelamento = last
  }

  return r
}

const PARSERS = {
  porto: parsePortoSeguro,
  'porto seguro': parsePortoSeguro,
  pottencial: parsePottencial,
  tokio: parseTokioMarineV3,
  'tokio marine': parseTokioMarineV3,
  too: parseTooSeguros,
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

export async function parseApolice(seguradora, file) {
  const text = await extractPdfText(file)
  const parser = findParser(seguradora)

  if (!parser) {
    return { campos: {}, extras: {}, semParser: true, _text: text }
  }

  const raw = parser(text)
  if (raw.nome_proprietario) raw.nome_proprietario = sanitizeProprietarioNome(raw.nome_proprietario)

  const { cep, tipo_imovel, valor_aluguel, forma_pagamento, ...camposForm } = raw

  return {
    campos: {
      ...camposForm,
      premio_liquido: raw.premio_liquido != null ? fmt(raw.premio_liquido) : '',
      premio_total: raw.premio_total != null ? fmt(raw.premio_total) : '',
      valor_parcela: raw.valor_parcela != null ? fmt(raw.valor_parcela) : '',
      parcelamento: raw.parcelamento != null ? fmt(raw.parcelamento) : '',
      forma_pagamento: forma_pagamento || '',
    },
    extras: {
      cep: cep || null,
      tipo_imovel: tipo_imovel || null,
      valor_aluguel: valor_aluguel != null ? valor_aluguel : null,
    },
    semParser: false,
    _text: text,
  }
}
