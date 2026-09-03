// ─── Reconstrucao de tabela a partir da posicao no PDF ─────────────────
//
// POR QUE ISTO EXISTE, e nao mais um regex sobre `extractPdfText`:
//
// `extractPdfText` junta os fragmentos do PDF na ordem em que o arquivo manda
// desenhar, que NAO e a ordem em que eles aparecem na pagina. Na cotacao da
// familia Porto isso inverte duas colunas da tabela de coberturas. Medido no
// orcamento 6065143265-0-4 (Azul), linha do Casco:
//
//   posicao real  ->  LMI 100,00% | Franquia R$ 3.600,00 | ... | Premio R$ 1.320,61
//   texto plano   ->  100.00% R$ 1.320,61 0.00% 0.00% R$ 3.600,00
//
// Lido do texto plano na ordem do cabecalho, a franquia vira R$ 1.320,61 e o
// premio R$ 3.600,00 — os dois trocados. Franquia e um dos numeros que o
// cliente mais olha no comparativo, e sairia errado num documento entregue a
// ele, sem nada indicando erro. Por isso a coluna e decidida por COORDENADA.
//
// Este modulo e puro: recebe itens ja posicionados e nao conhece pdfjs. Quem
// faz a ponte com o pdfjs e `extractPdfLayout` em `apoliceParser.js`.

/**
 * Agrupa itens soltos em linhas, pelo Y.
 *
 * @param itens [{ texto, x, y, pagina }] — Y no sistema do PDF (cresce para cima)
 * @returns [{ pagina, y, celulas: [{ texto, x }], texto }] ordenado como se le
 */
export function agruparLinhas(itens, { tolerancia = 3 } = {}) {
  const linhas = []

  for (const item of itens || []) {
    const texto = String(item?.texto ?? '').trim()
    if (!texto) continue
    const pagina = item.pagina ?? 1
    const y = Number(item.y) || 0
    const x = Number(item.x) || 0

    // A tolerancia existe porque fontes de tamanhos diferentes na mesma linha
    // saem com baseline levemente diferente. Sem ela, o rotulo e o numero da
    // mesma celula viram duas linhas e a tabela se desmonta.
    let linha = linhas.find(l => l.pagina === pagina && Math.abs(l.y - y) <= tolerancia)
    if (!linha) {
      linha = { pagina, y, celulas: [] }
      linhas.push(linha)
    }
    linha.celulas.push({ texto, x })
  }

  for (const linha of linhas) {
    linha.celulas.sort((a, b) => a.x - b.x)
    linha.texto = linha.celulas.map(c => c.texto).join(' ')
  }

  // Ordem de leitura: pagina crescente, Y decrescente (topo primeiro).
  return linhas.sort((a, b) => a.pagina - b.pagina || b.y - a.y)
}

/**
 * Celula de uma linha que cai sob determinada coluna.
 *
 * A janela e assimetrica de proposito: no PDF os numeros sao alinhados a
 * direita e os rotulos do cabecalho a esquerda, entao o X de um valor cai
 * DEPOIS do X do seu proprio cabecalho e antes do cabecalho seguinte.
 */
export function celulaEm(linha, x, { antes = 30, depois = 60 } = {}) {
  if (!linha) return ''
  const candidatas = linha.celulas.filter(c => c.x >= x - antes && c.x <= x + depois)
  if (!candidatas.length) return ''
  candidatas.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))
  return candidatas[0].texto
}

/**
 * Celula confinada a uma coluna real da tabela.
 *
 * Diferente de uma simples busca por proximidade, os pontos medios entre os
 * cabecalhos viram limites intransponiveis. Assim, se o LMI estiver vazio, a
 * busca devolve vazio em vez de atravessar para a coluna de premio.
 */
export function celulaNaFaixa(linha, x, {
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
  const candidatas = (linha.celulas || [])
    .filter(c => c.x >= limiteEsquerdo && c.x < limiteDireito)
    .sort((a, b) => Math.abs(a.x - centro) - Math.abs(b.x - centro))
  return candidatas[0]?.texto || ''
}

/**
 * Posicao X de cada coluna, lida do proprio cabecalho da tabela.
 *
 * Deliberadamente nao ha X fixo em lugar nenhum deste projeto: Azul, Itau e
 * Mitsui saem do mesmo sistema mas com larguras levemente diferentes, e a
 * seguradora pode mexer no layout sem avisar. Ancorar no texto do cabecalho
 * sobrevive a isso; ancorar em pixel, nao.
 *
 * @param rotulos { chave: 'texto do cabecalho' }
 * @returns { chave: x } | null se o cabecalho nao foi encontrado
 */
export function colunasPeloCabecalho(linhas, rotulos) {
  const chaves = Object.keys(rotulos)
  const alvo = chaves.map(k => normalizar(rotulos[k]))

  for (const linha of linhas || []) {
    const achadas = {}
    for (let i = 0; i < chaves.length; i += 1) {
      const celula = linha.celulas.find(c => normalizar(c.texto) === alvo[i])
      if (celula) achadas[chaves[i]] = celula.x
    }
    // Exige o cabecalho INTEIRO. Meio cabecalho quase sempre significa que
    // casou com outro trecho do documento, e ai as colunas sairiam tortas.
    if (Object.keys(achadas).length === chaves.length) return achadas
  }
  return null
}

/**
 * Valor que acompanha um rotulo do tipo "Para-Brisa: 314,00".
 *
 * Cobre as duas formas que o mesmo documento usa, as vezes na mesma linha:
 *   - rotulo e valor em celulas separadas  -> "Para-Brisa:"@76 | "314,00"@120
 *   - rotulo e valor na mesma celula       -> "Assist. Funeral: 0,00"@217
 *
 * IMPORTANTE: passe `linhas` ja recortadas na secao certa. O mesmo rotulo se
 * repete com significados diferentes em secoes diferentes — na cotacao Bradesco
 * "Veiculo:" vale "Valor de Mercado Referenciado" na secao de LMI e
 * "2.497,72 (Reduzida)" na de franquias. Buscar no documento inteiro devolve o
 * primeiro que aparecer, que e quase sempre o errado.
 */
export function valorAposRotulo(linhas, rotulo) {
  const alvo = normalizar(rotulo).replace(/:$/, '')

  for (const linha of linhas || []) {
    for (let i = 0; i < linha.celulas.length; i += 1) {
      const bruto = linha.celulas[i].texto
      const norm = normalizar(bruto)

      // Rotulo e valor grudados na mesma celula.
      if (norm.startsWith(`${alvo}:`)) {
        const resto = bruto.slice(bruto.indexOf(':') + 1).trim()
        if (resto) return resto
      }

      // Celula e so o rotulo: o valor e a proxima celula a direita.
      if (norm === alvo || norm === `${alvo}:`) {
        const proxima = linha.celulas[i + 1]
        if (proxima) return proxima.texto
      }
    }
  }
  return ''
}

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Linhas entre dois marcadores de texto, para recortar uma secao do documento. */
export function fatiar(linhas, { de, ate }) {
  const lista = linhas || []
  const bate = (linha, alvo) => alvo && normalizar(linha.texto).includes(normalizar(alvo))

  let inicio = 0
  if (de) {
    const i = lista.findIndex(l => bate(l, de))
    if (i < 0) return []
    inicio = i
  }

  let fim = lista.length
  if (ate) {
    const i = lista.slice(inicio + 1).findIndex(l => bate(l, ate))
    if (i >= 0) fim = inicio + 1 + i
  }

  return lista.slice(inicio, fim)
}
