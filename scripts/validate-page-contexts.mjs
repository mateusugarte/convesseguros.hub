import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pagesDir = path.join(root, 'src', 'pages')

function walkJsxFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkJsxFiles(full, acc)
    } else if (entry.isFile() && entry.name.endsWith('.jsx')) {
      acc.push(full)
    }
  }
  return acc
}

function hasContextFor(pageFile) {
  const dir = path.dirname(pageFile)
  const base = path.basename(pageFile, '.jsx')
  const sameDir = path.join(dir, 'CONTEXT.md')
  const nested = path.join(dir, base, 'CONTEXT.md')
  return fs.existsSync(sameDir) || fs.existsSync(nested)
}

const pages = walkJsxFiles(pagesDir)
const missing = pages
  .filter((page) => !hasContextFor(page))
  .map((page) => path.relative(root, page).replaceAll('\\', '/'))

if (missing.length > 0) {
  console.error('Missing CONTEXT.md for the following pages:')
  for (const item of missing) console.error(`- ${item}`)
  process.exitCode = 1
} else {
  console.log(`OK - ${pages.length} page files have CONTEXT.md coverage.`)
}
