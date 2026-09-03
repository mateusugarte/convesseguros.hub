import { normalizarTexto } from './orcamentoComparativo.js'

export function moeda(texto) {
  const bruto = String(texto ?? '').trim()
  if (!bruto || /^(-|n[ãa]o contratado|n[ãa]o se aplica)$/i.test(bruto)) return null
  const match = bruto.match(/-?[\d.]*\d,\d{2}/)
  if (!match) return null
  const numero = Number(match[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

export function percentual(texto) {
  const match = String(texto ?? '').match(/(-?[\d.,]+)\s*%/)
  if (!match) return null
  const numero = Number(match[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

export function paraIso(dataBr) {
  const match = String(dataBr ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return ''
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

export function adicionarDias(dataBr, dias) {
  const iso = paraIso(dataBr)
  if (!iso) return ''
  const data = new Date(`${iso}T12:00:00Z`)
  data.setUTCDate(data.getUTCDate() + Number(dias || 0))
  return data.toISOString().slice(0, 10)
}

export function formatarMoeda(valor) {
  if (valor == null) return ''
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

export function formatarCep(valor) {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : String(valor ?? '').trim()
}

/**
 * Le grades em que os rotulos ficam numa linha e os valores imediatamente
 * abaixo, mantendo a mesma coluna visual. Darwin, Pier e Yelum usam esse
 * padrao para os dados do segurado e do veiculo.
 */
export function valorAbaixoRotulo(linhas, rotulo, { maxY = 100, maxX = 110, ocorrencia = 0 } = {}) {
  const alvo = normalizarTexto(rotulo).replace(/:$/, '')
  const encontrados = []

  for (let i = 0; i < (linhas || []).length; i += 1) {
    const linha = linhas[i]
    const celulas = linha.celulas || []
    for (let c = 0; c < celulas.length; c += 1) {
      let texto = ''
      for (let fim = c; fim < celulas.length; fim += 1) {
        texto = `${texto} ${celulas[fim].texto}`.trim()
        const normal = normalizarTexto(texto).replace(/:$/, '')
        if (!alvo.startsWith(normal)) break
        if (normal !== alvo) continue
        encontrados.push({
          linha,
          celula: celulas[c],
          indice: i,
          limiteDireita: celulas[fim + 1]?.x ?? null,
        })
        break
      }
    }
  }

  const achado = encontrados[ocorrencia]
  if (!achado) return ''

  let melhor = null
  for (let i = achado.indice + 1; i < linhas.length; i += 1) {
    const linha = linhas[i]
    if (linha.pagina !== achado.linha.pagina) {
      if (linha.pagina > achado.linha.pagina) break
      continue
    }
    const dy = achado.linha.y - linha.y
    if (dy <= 0) continue
    if (dy > maxY) break
    const dentroDaColuna = achado.limiteDireita == null ? [] : (linha.celulas || [])
      .filter(c => c.x >= achado.celula.x - 5)
      .filter(c => c.x < achado.limiteDireita - 8)
    if (dentroDaColuna.length) {
      const texto = dentroDaColuna.map(c => c.texto).join(' ').replace(/\s+/g, ' ').trim()
      const score = dy * 1000
      if (texto && (!melhor || score < melhor.score)) melhor = { score, texto }
      continue
    }

    for (const celula of linha.celulas || []) {
      const dx = Math.abs(celula.x - achado.celula.x)
      if (dx > maxX) continue
      const score = dy * 1000 + dx
      if (!melhor || score < melhor.score) melhor = { score, texto: celula.texto }
    }
  }
  return melhor?.texto || ''
}

/** Celula mais proxima de um X na linha, com janela explicita. */
export function textoNaColuna(linha, x, tolerancia = 45) {
  const candidatas = (linha?.celulas || [])
    .filter(c => Math.abs(c.x - x) <= tolerancia)
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
  return candidatas[0]?.texto || ''
}

/** Versao textual de `celulaNaFaixa`: nunca invade a coluna vizinha. */
export function textoNaFaixaDaColuna(linha, x, {
  anterior = null, proxima = null, antes = 80, depois = 80,
} = {}) {
  if (!linha || !Number.isFinite(Number(x))) return ''
  const centro = Number(x)
  const limiteEsquerdo = Number.isFinite(Number(anterior))
    ? (Number(anterior) + centro) / 2
    : centro - antes
  const limiteDireito = Number.isFinite(Number(proxima))
    ? (centro + Number(proxima)) / 2
    : centro + depois
  return (linha.celulas || [])
    .filter(c => c.x >= limiteEsquerdo && c.x < limiteDireito)
    .sort((a, b) => Math.abs(a.x - centro) - Math.abs(b.x - centro))[0]?.texto || ''
}
