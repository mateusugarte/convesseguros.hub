/**
 * Conciliacao entre a planilha de respostas do Google Forms e a tabela `fichas`.
 *
 * O fluxo de entrada e Forms -> Apps Script (onFormSubmit) -> webhook n8n ->
 * INSERT em `fichas`. Quando o Apps Script falha, a resposta fica so na
 * planilha e ninguem percebe. Este modulo compara os dois lados e diz o que
 * nunca virou ficha.
 *
 * Sem I/O de proposito: recebe as linhas da planilha e as fichas ja carregadas,
 * devolve o diagnostico. Quem busca os dados e `api/verificar-fichas.js`.
 */

export const DIAS_PADRAO = 30

// Uma ficha nasce segundos depois da resposta. A folga de 2 dias cobre reenvio
// manual e fuso, sem casar respostas distintas do mesmo CPF em meses diferentes.
export const TOLERANCIA_DIAS = 2

// Margem extra ao buscar fichas no banco: uma resposta do inicio da janela pode
// ter virado ficha (manualmente) dias depois, e sem essa folga ela apareceria
// como faltante e seria importada de novo, duplicando.
export const MARGEM_BUSCA_DIAS = 15

const DIA_MS = 24 * 60 * 60 * 1000

/** Rotulos aceitos por campo, na ordem de preferencia. */
const ROTULOS = {
  nome: [
    'nome completo do interessado no imovel',
    'nome completo do interessado',
    'nome do interessado',
    'nome completo',
    'nome',
  ],
  cpf: ['cpf', 'cpf do interessado', 'cpf cnpj', 'cnpj'],
  celular: ['celular', 'telefone', 'whatsapp', 'contato'],
  email: ['e mail', 'email', 'e mail do interessado'],
  imobiliaria: ['imobiliaria', 'imobiliaria parceira'],
  orcamentista: ['orcamentista', 'orcamentista responsavel'],
  valorAluguel: ['valor do aluguel', 'valor aluguel'],
  tipoImovel: ['tipo de imovel', 'tipo do imovel'],
}

export function soDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Acha o valor de um campo logico dentro do objeto vindo da planilha, cujas
 * chaves sao os rotulos crus das perguntas do Forms ("IMOBILIÁRIA", "CPF",
 * "Nome completo do interessado no imóvel"). Rotulo mudou de acento, caixa ou
 * pontuacao continua casando; mudou de texto, cai no proximo alias.
 */
export function valorPorRotulo(dados, aliases) {
  if (!dados || typeof dados !== 'object') return ''

  const indice = new Map()
  for (const chave of Object.keys(dados)) {
    const norm = normalizarTexto(chave)
    if (norm && !indice.has(norm)) indice.set(norm, dados[chave])
  }

  for (const alias of aliases) {
    if (indice.has(alias)) return String(indice.get(alias) ?? '').trim()
  }
  // Fallback posicional: rotulo que comeca com o alias ("CPF:" com sufixo, por
  // exemplo). Exige o alias inteiro no inicio para nao casar "CPF do condutor"
  // quando existir um "CPF" proprio.
  for (const alias of aliases) {
    for (const [norm, valor] of indice) {
      if (norm.startsWith(`${alias} `)) return String(valor ?? '').trim()
    }
  }
  return ''
}

/** Extrai da linha da planilha so o que a conciliacao e a tela precisam. */
export function extrairCampos(dados) {
  return {
    nome: valorPorRotulo(dados, ROTULOS.nome),
    cpf: valorPorRotulo(dados, ROTULOS.cpf),
    celular: valorPorRotulo(dados, ROTULOS.celular),
    email: valorPorRotulo(dados, ROTULOS.email),
    imobiliaria: valorPorRotulo(dados, ROTULOS.imobiliaria),
    orcamentista: valorPorRotulo(dados, ROTULOS.orcamentista),
    valorAluguel: valorPorRotulo(dados, ROTULOS.valorAluguel),
    tipoImovel: valorPorRotulo(dados, ROTULOS.tipoImovel),
  }
}

/**
 * Chave de reserva para linhas sem CPF: nome normalizado + os 8 ultimos digitos
 * do celular. Os 8 finais ignoram divergencia de DDD/nono digito entre a
 * planilha e o que foi gravado.
 */
export function chaveContato(nome, celular) {
  const n = normalizarTexto(nome)
  if (!n) return ''
  const c = soDigitos(celular).slice(-8)
  return c ? `${n}|${c}` : n
}

function paraData(valor) {
  if (!valor) return null
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

function empurrar(mapa, chave, item) {
  if (!chave) return
  const atual = mapa.get(chave)
  if (atual) atual.push(item)
  else mapa.set(chave, [item])
}

function resumoFicha(ficha) {
  return {
    id: ficha.id,
    nome_interessado: ficha.nome_interessado || '',
    cpf: ficha.cpf || '',
    status: ficha.status || '',
    produto: ficha.produto || '',
    created_at: ficha.created_at || null,
  }
}

/**
 * Compara as linhas da planilha com as fichas do sistema.
 *
 * Cada ficha so pode satisfazer UMA linha ("claim"): sem isso, um cliente que
 * mandou duas respostas no mesmo mes (dois imoveis, mesmo CPF) casaria as duas
 * linhas com a mesma ficha e o sistema diria que esta tudo certo mesmo faltando
 * uma. As linhas sao processadas da mais antiga para a mais nova e cada uma
 * fica com a ficha de data mais proxima ainda livre.
 *
 * @returns {{faltantes: Array, encontradas: Array, incertas: Array, resumo: object}}
 */
export function conciliarFichas({ linhas = [], fichas = [], toleranciaDias = TOLERANCIA_DIAS } = {}) {
  const porCpf = new Map()
  const porContato = new Map()

  for (const ficha of fichas) {
    const registro = { ficha, usada: false, criadaEm: paraData(ficha.created_at) }
    const cpf = soDigitos(ficha.cpf)
    if (cpf) empurrar(porCpf, cpf, registro)
    empurrar(porContato, chaveContato(ficha.nome_interessado, ficha.celular), registro)
  }

  const ordenadas = [...linhas]
    .map((linha, ordem) => ({ linha, ordem, quando: paraData(linha.timestamp) }))
    .sort((a, b) => {
      if (a.quando && b.quando) return a.quando - b.quando
      if (a.quando) return -1
      if (b.quando) return 1
      return a.ordem - b.ordem
    })

  const faltantes = []
  const encontradas = []
  const incertas = []

  for (const { linha, quando } of ordenadas) {
    const campos = extrairCampos(linha.dados)
    const cpf = soDigitos(campos.cpf)
    const candidatos = cpf
      ? (porCpf.get(cpf) || [])
      : (porContato.get(chaveContato(campos.nome, campos.celular)) || [])

    const item = {
      linha: linha.linha ?? null,
      timestamp: linha.timestamp ?? null,
      timestamp_local: linha.timestamp_local ?? null,
      campos,
      dados: linha.dados,
    }

    const livres = candidatos.filter(c => !c.usada)

    if (!candidatos.length) {
      faltantes.push({ ...item, motivo: cpf ? 'sem_ficha_no_sistema' : 'sem_cpf_e_sem_ficha' })
      continue
    }

    if (!livres.length) {
      // Todas as fichas desse CPF ja foram reivindicadas por respostas
      // anteriores — sobrou resposta sem ficha correspondente.
      incertas.push({
        ...item,
        motivo: 'respostas_repetidas_sem_ficha_equivalente',
        fichas: candidatos.map(c => resumoFicha(c.ficha)),
      })
      continue
    }

    if (!quando) {
      const escolhido = livres[0]
      escolhido.usada = true
      encontradas.push({ ...item, ficha: resumoFicha(escolhido.ficha), motivo: 'sem_data_na_planilha' })
      continue
    }

    let melhor = null
    let melhorDiff = Infinity
    for (const candidato of livres) {
      if (!candidato.criadaEm) continue
      const diff = Math.abs(candidato.criadaEm.getTime() - quando.getTime())
      if (diff < melhorDiff) {
        melhor = candidato
        melhorDiff = diff
      }
    }

    if (melhor && melhorDiff <= toleranciaDias * DIA_MS) {
      melhor.usada = true
      encontradas.push({ ...item, ficha: resumoFicha(melhor.ficha), diff_dias: +(melhorDiff / DIA_MS).toFixed(2) })
      continue
    }

    // Existe ficha com o mesmo CPF, mas em outra data. Pode ser a mesma resposta
    // reprocessada tarde ou um contrato diferente do mesmo cliente — o sistema
    // nao decide sozinho, manda para revisao humana.
    incertas.push({
      ...item,
      motivo: 'ficha_do_mesmo_cpf_em_outra_data',
      diff_dias: melhor ? +(melhorDiff / DIA_MS).toFixed(2) : null,
      fichas: livres.map(c => resumoFicha(c.ficha)),
    })
  }

  return {
    faltantes,
    encontradas,
    incertas,
    resumo: {
      total: linhas.length,
      faltantes: faltantes.length,
      encontradas: encontradas.length,
      incertas: incertas.length,
    },
  }
}

/** Data inicial da busca de fichas no banco, com a margem de seguranca. */
export function inicioDaBusca(dias = DIAS_PADRAO, agora = new Date()) {
  return new Date(agora.getTime() - (dias + MARGEM_BUSCA_DIAS) * DIA_MS)
}
