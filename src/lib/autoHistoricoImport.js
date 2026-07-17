import XLSX from 'xlsx'

const GREEN_FILL_COLORS = new Set(['00B050', '92D050'])

export function limparNomeSegurado(value) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
  const cutIndex = clean.indexOf('-')
  if (cutIndex === -1) return clean
  return clean.slice(0, cutIndex).trim()
}

export function normalizeCompareText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function somarUmAno(dataISO) {
  const match = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, anoStr, mesStr, diaStr] = match
  const ano = Number(anoStr) + 1
  const mes = Number(mesStr)
  const diaMax = new Date(ano, mes, 0).getDate()
  const dia = Math.min(Number(diaStr), diaMax)
  return `${ano}-${mesStr}-${String(dia).padStart(2, '0')}`
}

export function isCelulaVerde(cellStyle) {
  const rgb = cellStyle?.fgColor?.rgb
  if (!rgb) return false
  return GREEN_FILL_COLORS.has(String(rgb).toUpperCase())
}

function normalizeHeaderCell(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findColumn(headerRow, start, end, labels) {
  for (let col = start; col < end; col += 1) {
    const header = normalizeHeaderCell(headerRow[col])
    if (labels.some(label => header === label || header.includes(label))) return col
  }
  return -1
}

function excelValueToISO(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return ''
}

function percentValue(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value : value / 100
  const raw = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed : parsed / 100
}

export function extrairLinhasHistoricoDaAba(sheetName, worksheet, rows) {
  const result = []
  rows.forEach((headerRow, headerIndex) => {
    const dataColumns = headerRow
      .map((cell, index) => (normalizeHeaderCell(cell) === 'data' ? index : -1))
      .filter(index => index >= 0)

    dataColumns.forEach((dataCol, blockIndex) => {
      const end = dataColumns[blockIndex + 1] ?? headerRow.length
      const ciaCol = findColumn(headerRow, dataCol, end, ['cia', 'seguradora'])
      const seguradoCol = findColumn(headerRow, dataCol, end, ['segurado', 'cliente'])
      const comissaoCol = findColumn(headerRow, dataCol, end, ['comissao'])
      const comissaoPassadaCol = findColumn(headerRow, dataCol, end, ['com passada', 'comissao passada'])
      if (seguradoCol < 0) return

      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (normalizeHeaderCell(row[dataCol]) === 'data') break

        const addr = XLSX.utils.encode_cell({ r: rowIndex, c: seguradoCol })
        const cell = worksheet[addr]
        if (!isCelulaVerde(cell?.s)) continue

        const nome = limparNomeSegurado(row[seguradoCol])
        const vigenciaInicio = excelValueToISO(row[dataCol])
        if (!nome || !vigenciaInicio) continue

        result.push({
          aba: sheetName,
          linha: rowIndex + 1,
          nome_cliente: nome,
          seguradora: String(ciaCol >= 0 ? row[ciaCol] : '').replace(/\s+/g, ' ').trim(),
          vigencia_inicio: vigenciaInicio,
          pct_comissao: percentValue(comissaoCol >= 0 ? row[comissaoCol] : null),
          comissao_passada: percentValue(comissaoPassadaCol >= 0 ? row[comissaoPassadaCol] : null),
        })
      }
    })
  })
  return result
}

export function parseAutoHistoricoPlanilha(workbook) {
  return workbook.SheetNames.flatMap(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    return extrairLinhasHistoricoDaAba(sheetName, sheet, rows)
  })
}
