import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const [pdfPath, outputPath] = process.argv.slice(2)

if (!pdfPath || !outputPath) {
  console.error('Uso: node scripts/extract-orcamento-fixture.mjs <entrada.pdf> <fixture.json>')
  process.exit(1)
}

const data = new Uint8Array(fs.readFileSync(pdfPath))
const pdf = await getDocument({ data }).promise
const itens = []
let texto = ''

for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
  const page = await pdf.getPage(pagina)
  const content = await page.getTextContent()
  texto += `${content.items.map(item => item.str).join(' ')}\n`

  for (const item of content.items) {
    const valor = String(item.str || '').trim()
    if (!valor) continue
    itens.push({
      texto: valor,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      pagina,
    })
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify({ itens, texto }))
console.log(`${path.basename(outputPath)}: ${pdf.numPages} pagina(s), ${itens.length} item(ns)`)
