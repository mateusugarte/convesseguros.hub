import * as XLSXModule from 'xlsx'
import { limparNomeSegurado } from './autoHistoricoImport.js'
import { splitInsuredAndVehicle } from './autoPolicyImport.js'

const XLSX = XLSXModule.default ?? XLSXModule

function normalizeHeaderCell(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function excelDateToISO(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return ''
}

// Planilha guarda percentual como fracao (0.2 = 20%); a convencao do modulo
// Auto (ver auto.js: calcularValorComissaoAuto) e sempre percentual inteiro.
function percentToWholeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value * 100 : value
  const raw = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed * 100 : parsed
}

function findColumn(headerRow, labels) {
  for (let col = 0; col < headerRow.length; col += 1) {
    const header = normalizeHeaderCell(headerRow[col])
    // Exact match takes priority
    if (labels.some(label => header === label)) return col
    // Substring match only for labels longer than 3 chars (avoid false positives with 'cia')
    if (labels.some(label => label.length > 3 && header.includes(label))) return col
  }
  return -1
}

export function extrairLinhasComissaoDaAba(rows) {
  if (!rows.length) return []
  const headerRow = rows[0]
  const corretor = findColumn(headerRow, ['corretor'])
  const cols = {
    vigencia: findColumn(headerRow, ['vigencia']),
    segurado: findColumn(headerRow, ['segurado']),
    seguradora: findColumn(headerRow, ['seguradora', 'cia']),
    premio: findColumn(headerRow, ['premio liquido']),
    pctComissao: findColumn(headerRow, ['comissao']),
    // Abas mais antigas da planilha real (ex.: MAIO-SETEMBRO 2025) tem essa
    // coluna sem rotulo (celula em branco), mas o dado continua na mesma
    // posicao de sempre: logo apos "CORRETOR". Sem esse fallback, extrair
    // dessas abas retorna todo mundo com tipo vazio e nunca acha renovacao.
    tipo: findColumn(headerRow, ['o que e']),
  }
  if (cols.tipo < 0 && corretor >= 0) cols.tipo = corretor + 1
  if (cols.segurado < 0) return []

  const result = []
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const rawName = cleanText(row[cols.segurado])
    const identity = splitInsuredAndVehicle(rawName)
    const nome = identity.separated ? identity.insured : limparNomeSegurado(rawName)
    if (!nome) continue

    // Linhas de endosso guardam o texto "ENDOSSO" na coluna VIGENCIA em vez
    // de uma data — nao entram no "puxar renovacoes" (fora de escopo aqui).
    const vigenciaFim = cols.vigencia >= 0 ? excelDateToISO(row[cols.vigencia]) : ''
    if (!vigenciaFim) continue

    result.push({
      linha: rowIndex + 1,
      nome_cliente: nome,
      identificacao_veiculo: identity.separated && !/^(?:equipe|captacao|captação)$/i.test(identity.vehicle) ? identity.vehicle : '',
      seguradora: cols.seguradora >= 0 ? cleanText(row[cols.seguradora]) : '',
      vigencia_fim: vigenciaFim,
      premio_liquido: cols.premio >= 0 && row[cols.premio] !== '' ? Number(row[cols.premio]) : null,
      pct_comissao: cols.pctComissao >= 0 ? percentToWholeNumber(row[cols.pctComissao]) : null,
      tipo: normalizeHeaderCell(cols.tipo >= 0 ? row[cols.tipo] : ''),
    })
  }
  return result
}

export function parseAutoComissaoPlanilha(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Aba "${sheetName}" nao encontrada na planilha.`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return extrairLinhasComissaoDaAba(rows).filter(item => item.tipo === 'renovacao')
}
