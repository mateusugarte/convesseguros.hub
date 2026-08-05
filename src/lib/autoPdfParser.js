/**
 * Parser de PDFs do setor AUTO — orcamentos e propostas.
 *
 * Objetivo: o usuario nao digita mais nada. Anexa o PDF do orcamento (ao
 * finalizar a cotacao) ou da proposta (ao passar para emissao) e os campos sao
 * preenchidos sozinhos, como ja acontece no fianca via `apoliceParser.js`.
 *
 * Duas diferencas deliberadas em relacao ao parser do fianca:
 *
 * 1. **A seguradora e detectada pelo texto, nao escolhida num dropdown.**
 *    No fianca o usuario seleciona a seguradora antes de anexar, e o parser e
 *    escolhido por essa selecao (`findParserChain`). No AUTO o PDF vem direto do
 *    portal de cada seguradora e o proprio anexo e que diz qual e — pedir para o
 *    usuario informar antes seria justamente a digitacao que queremos eliminar.
 *
 * 2. **Extracao generica primeiro, refinamento por seguradora depois.**
 *    `parseGenerico` funciona por rotulo ("Placa:", "Premio Liquido:", ...) e por
 *    formato (placa Mercosul, CPF, vigencia), o que cobre a maior parte dos
 *    layouts sem conhecer nenhum deles. Cada entrada de `LAYOUTS` so precisa
 *    corrigir o que o generico erra naquele PDF especifico. Se uma seguradora
 *    muda o layout (a Tokio ja mudou 3 vezes no fianca), o generico continua
 *    entregando o grosso em vez de zerar tudo.
 *
 * Este modulo NAO importa `pdfjs-dist` no topo de proposito: assim as funcoes de
 * texto->campos rodam em `node --test` sem shim de DOM. A leitura do PDF fica nas
 * funcoes async do fim do arquivo, que importam o extrator sob demanda.
 */

import { aplicarMapeamento } from './autoPdfMapeamento.js'
import { camposDoTipo } from './autoPdfCampos.js'

// ─── Normalizadores ────────────────────────────────────────────────────

export function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

export function parseDateBR(str) {
  if (!str) return ''
  const parts = String(str).trim().split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  const ano = y.length === 2 ? `20${y}` : y
  return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// "1.234,56" -> 1234.56 | "1234.56" -> 1234.56 | "12,5" -> 12.5
// A heuristica da virgula existe porque os PDFs misturam os dois formatos: o
// valor monetario vem em pt-BR ("3.450,00") mas percentuais as vezes ja vem com
// ponto decimal ("12.5"). Sem isso, "3.450,00" viraria 3.45.
export function parseMoneyBR(str) {
  if (str == null || str === '') return null
  const s = String(str).trim()
  const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const val = parseFloat(clean)
  return Number.isNaN(val) ? null : val
}

function fmt(val) {
  if (val == null) return ''
  return String(val)
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

// Procura o primeiro grupo capturado que vira numero, testando os padroes na
// ordem em que foram passados (do mais especifico para o mais frouxo).
function firstMoney(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    for (let i = 1; i < match.length; i += 1) {
      const parsed = parseMoneyBR(match[i])
      if (parsed !== null) return parsed
    }
  }
  return null
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) return match[1].trim()
  }
  return null
}

// ─── Extratores genericos por formato ──────────────────────────────────

// Placa Mercosul (ABC1D23) e o padrao antigo (ABC-1234 / ABC1234) casam no mesmo
// formato: 3 letras, 1 digito, 1 alfanumerico, 2 digitos.
const PLACA_RE = /\b([A-Z]{3}[\s-]?\d[A-Z0-9]\d{2})\b/
const CHASSI_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/
const CPF_RE = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/
const CNPJ_RE = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/
const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i
const CELULAR_RE = /(\(?\d{2}\)?\s?\d{4,5}-?\d{4})\b/

export function extrairPlaca(text) {
  // O rotulo vem primeiro porque um PDF de orcamento tem varios tokens de 7
  // caracteres alfanumericos (codigo FIPE, numero de cotacao, item de apolice)
  // que casam com PLACA_RE por acidente. So caimos na busca solta se nao houver
  // rotulo nenhum.
  const comRotulo = firstMatch(text, [
    /\bPLACA\b\s*:?\s*([A-Z]{3}[\s-]?\d[A-Z0-9]\d{2})\b/i,
    /\bPLACA\s+DO\s+VE[IÍ]CULO\b\s*:?\s*([A-Z]{3}[\s-]?\d[A-Z0-9]\d{2})\b/i,
  ])
  if (comRotulo) return comRotulo.replace(/[\s-]/g, '').toUpperCase()

  // Um chassi tem 17 caracteres e comeca com um trecho que casa com PLACA_RE —
  // remover os chassis antes evita devolver os 7 primeiros digitos de um deles
  // como se fossem placa.
  const semChassi = text.replace(new RegExp(CHASSI_RE.source, 'g'), ' ')
  const solto = semChassi.match(PLACA_RE)
  return solto ? solto[1].replace(/[\s-]/g, '').toUpperCase() : null
}

export function extrairChassi(text) {
  const comRotulo = firstMatch(text, [/\bCHASSI\b\s*:?\s*([A-HJ-NPR-Z0-9]{17})\b/i])
  if (comRotulo) return comRotulo.toUpperCase()
  const solto = text.match(CHASSI_RE)
  return solto ? solto[1].toUpperCase() : null
}

export function extrairCpf(text, rotulos = []) {
  const comRotulo = firstMatch(text, [
    ...rotulos,
    /\bCPF\b\s*(?:\/\s*CNPJ)?\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/i,
  ])
  if (comRotulo) return comRotulo.trim()
  const solto = text.match(CPF_RE)
  return solto ? solto[1].trim() : null
}

export function extrairCnpj(text) {
  const match = text.match(CNPJ_RE)
  return match ? match[1].trim() : null
}

export function extrairEmail(text) {
  const comRotulo = firstMatch(text, [
    /\bE-?MAIL\b\s*:?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ])
  if (comRotulo) return comRotulo.trim()
  const solto = text.match(EMAIL_RE)
  return solto ? solto[1].trim() : null
}

export function extrairCelular(text) {
  const comRotulo = firstMatch(text, [
    /\b(?:CELULAR|TELEFONE|FONE|WHATSAPP|TEL)\b\s*:?\s*(\(?\d{2}\)?\s?\d{4,5}-?\d{4})\b/i,
  ])
  if (comRotulo) return comRotulo.trim()
  const solto = text.match(CELULAR_RE)
  return solto ? solto[1].trim() : null
}

export function extrairCep(text) {
  const comRotulo = firstMatch(text, [
    /\bCEP\b\s*(?:DE\s+PERNOITE)?\s*:?\s*(\d{5}-?\d{3})\b/i,
    /\bPERNOITE\b[^\d]{0,40}(\d{5}-?\d{3})\b/i,
  ])
  if (comRotulo) return onlyDigits(comRotulo)
  return null
}

// Vigencia cobre as tres redacoes que aparecem nos PDFs de auto: intervalo
// explicito ("de X a Y"), o jargao de 24 horas e os rotulos separados.
export function extrairVigencia(text) {
  const intervalo = text.match(
    /(?:VIG[ÊE]NCIA|PER[ÍI]ODO)[^\d]{0,60}?(\d{2}\/\d{2}\/\d{2,4})\s*(?:A|AT[ÉE]|-|–)\s*(\d{2}\/\d{2}\/\d{2,4})/i
  ) || text.match(
    /(?:das|a partir das)\s*\d{1,2}\s*h(?:oras)?\s*(?:do dia)?\s*(\d{2}\/\d{2}\/\d{2,4})[\s\S]{0,40}?(?:at[ée]|as|às)\s*\d{1,2}\s*h(?:oras)?\s*(?:do dia)?\s*(\d{2}\/\d{2}\/\d{2,4})/i
  )
  if (intervalo) {
    return { inicio: parseDateBR(intervalo[1]), fim: parseDateBR(intervalo[2]) }
  }

  const inicio = firstMatch(text, [
    /\bIN[ÍI]CIO\s+(?:DE\s+)?VIG[ÊE]NCIA\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
    /\bVIG[ÊE]NCIA\s+INICIAL\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
  ])
  const fim = firstMatch(text, [
    /\b(?:FIM|T[ÉE]RMINO|FINAL)\s+(?:DE\s+)?VIG[ÊE]NCIA\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
    /\bVIG[ÊE]NCIA\s+FINAL\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
  ])
  return {
    inicio: inicio ? parseDateBR(inicio) : '',
    fim: fim ? parseDateBR(fim) : '',
  }
}

export function extrairPremioLiquido(text) {
  return firstMoney(text, [
    /\bPR[ÊE]MIO\s+L[ÍI]QUIDO\b\s*:?\s*(?:R\$)?\s*([\d.,]+)/i,
    /\bL[ÍI]QUIDO\b\s*:?\s*R\$\s*([\d.,]+)/i,
  ])
}

export function extrairPremioTotal(text) {
  return firstMoney(text, [
    /\bPR[ÊE]MIO\s+TOTAL\b\s*:?\s*(?:R\$)?\s*([\d.,]+)/i,
    /\bVALOR\s+TOTAL\b(?:\s+DO\s+SEGURO)?\s*:?\s*(?:R\$)?\s*([\d.,]+)/i,
    /\bTOTAL\s+A\s+PAGAR\b\s*:?\s*(?:R\$)?\s*([\d.,]+)/i,
    /\bPRE[ÇC]O\s+TOTAL\b(?:\s+DO\s+SEGURO)?\s*:?\s*(?:R\$)?\s*([\d.,]+)/i,
  ])
}

export function extrairPctComissao(text) {
  return firstMoney(text, [
    /\bCOMISS[ÃA]O\b[^\d%]{0,30}?([\d.,]+)\s*%/i,
    /\b(?:%|PERCENTUAL)\s*(?:DE\s+)?COMISS[ÃA]O\b\s*:?\s*([\d.,]+)/i,
  ])
}

// Devolve o texto do parcelamento como o usuario escreveria ("10x sem juros"),
// porque a coluna `parcelamento`/`parcelamentos` e text no banco e o comercial
// usa esse campo como descricao, nao como numero.
export function extrairParcelamento(text) {
  const comValor = text.match(/\b(\d{1,2})\s*(?:x|vezes)\s*(?:de\s*)?R?\$?\s*([\d.,]+)/i)
  if (comValor) {
    const semJuros = /sem\s+juros/i.test(text) ? ' sem juros' : ''
    return `${comValor[1]}x de R$ ${comValor[2]}${semJuros}`
  }
  const soParcelas = firstMatch(text, [
    /\b(?:PARCELAMENTO|PARCELAS?)\b\s*:?\s*(\d{1,2}\s*x[^.;\n]{0,30})/i,
    /\b(\d{1,2}\s*x\s*sem\s+juros)\b/i,
  ])
  if (soParcelas) return soParcelas.trim()
  if (/\b[àa]\s*vista\b/i.test(text)) return 'À vista'
  return null
}

const FORMAS_PAGAMENTO = [
  [/cart[ãa]o\s+de\s+cr[ée]dito|cart[ãa]o/i, 'Cartão de crédito'],
  [/d[ée]bito\s+em\s+conta|d[ée]bito/i, 'Débito em conta'],
  [/boleto/i, 'Boleto'],
  [/\bpix\b/i, 'Pix'],
  [/carn[êe]|ficha\s+de\s+compensa/i, 'Carnê'],
]

export function extrairFormaPagamento(text) {
  // Restringe a busca ao trecho ao redor do rotulo quando ele existe: a palavra
  // "boleto" costuma aparecer tambem no rodape de condicoes gerais, sem relacao
  // com a forma escolhida nesta cotacao.
  const secao = text.match(/\bFORMA\s+DE\s+PAGAMENTO\b\s*:?\s*(.{0,80})/i)
  const alvo = secao ? secao[1] : text
  for (const [regex, label] of FORMAS_PAGAMENTO) {
    if (regex.test(alvo)) return label
  }
  if (secao) {
    for (const [regex, label] of FORMAS_PAGAMENTO) {
      if (regex.test(text)) return label
    }
  }
  return null
}

export function extrairModeloVeiculo(text) {
  return firstMatch(text, [
    /\b(?:MARCA\s*\/?\s*MODELO|MODELO\s+DO\s+VE[ÍI]CULO|VE[ÍI]CULO|MODELO)\b\s*:?\s*(.{3,60}?)(?=\s+(?:PLACA|CHASSI|ANO|COMBUST|C[ÓO]DIGO|FIPE|ZERO\s+KM|CATEGORIA|COR)\b|$)/i,
  ])
}

export function extrairAnoModelo(text) {
  return firstMatch(text, [
    /\bANO\s*(?:\/\s*)?MODELO\b\s*:?\s*(\d{4}\s*\/\s*\d{4}|\d{4})/i,
    /\bANO\s+DO\s+VE[ÍI]CULO\b\s*:?\s*(\d{4})/i,
  ])
}

export function extrairNomeCliente(text) {
  const nome = firstMatch(text, [
    /\b(?:NOME\s+DO\s+SEGURADO|SEGURADO|PROPONENTE|CLIENTE|NOME\s*\/?\s*RAZ[ÃA]O\s+SOCIAL|NOME)\b\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.'-]{4,70}?)(?=\s+(?:CPF|CNPJ|RG|DATA|NASC|SEXO|ESTADO\s+CIVIL|E-?MAIL|ENDERE|CEP|TELEFONE|CELULAR)\b|$)/i,
  ])
  return nome ? nome.replace(/\s+/g, ' ').trim() : null
}

export function extrairCondutor(text) {
  const secao = text.match(/\b(?:PRINCIPAL\s+CONDUTOR|CONDUTOR\s+PRINCIPAL|DADOS\s+DO\s+CONDUTOR|CONDUTOR)\b\s*:?\s*([\s\S]{0,220})/i)
  if (!secao) return { nome: null, cpf: null }
  const trecho = secao[1]
  const nome = firstMatch(trecho, [
    /^\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.'-]{4,70}?)(?=\s+(?:CPF|RG|DATA|NASC|SEXO|ESTADO\s+CIVIL)\b)/i,
    /\bNOME\b\s*:?\s*([A-ZÀ-Ú][A-ZÀ-Ú\s.'-]{4,70}?)(?=\s+(?:CPF|RG|DATA|NASC)\b)/i,
  ])
  const cpf = trecho.match(CPF_RE)
  return {
    nome: nome ? nome.replace(/\s+/g, ' ').trim() : null,
    cpf: cpf ? cpf[1].trim() : null,
  }
}

export function extrairNumeroApolice(text) {
  return firstMatch(text, [
    /\bAP[ÓO]LICE\b\s*(?:N[ÚU]MERO|NR|N[º°.]?)?\s*:?\s*([\d][\d.\-/]{4,})/i,
    /\bN[º°]?\s*DA\s*AP[ÓO]LICE\b\s*:?\s*([\d][\d.\-/]{4,})/i,
  ])
}

export function extrairNumeroProposta(text) {
  return firstMatch(text, [
    /\bPROPOSTA\b\s*(?:N[ÚU]MERO|NR|N[º°.]?)?\s*:?\s*([\d][\d.\-/]{4,})/i,
    /\bN[º°]?\s*DA\s*PROPOSTA\b\s*:?\s*([\d][\d.\-/]{4,})/i,
  ])
}

export function extrairDataEmissao(text) {
  const data = firstMatch(text, [
    /\bDATA\s+(?:DA\s+|DE\s+)?EMISS[ÃA]O\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
    /\bEMITID[AO]\s+EM\b\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i,
  ])
  return data ? parseDateBR(data) : ''
}

// ─── Deteccao da seguradora ────────────────────────────────────────────

/**
 * Identifica a seguradora pelo texto do PDF.
 *
 * A deteccao e por nome porque o nome comercial aparece no cabecalho/rodape de
 * praticamente todo PDF de portal. O campo `cnpj` de cada layout esta vazio de
 * proposito: CNPJ e o sinal mais confiavel que existe (nao muda quando a
 * seguradora reformula o layout), mas preencher de memoria arrisca gravar um
 * numero errado — a preencher a partir dos PDFs de exemplo.
 */
export const LAYOUTS = [
  { id: 'porto', nome: 'Porto Seguro', cnpj: '', padroes: [/\bPORTO\s+SEGURO\b/i] },
  { id: 'azul', nome: 'Azul Seguros', cnpj: '', padroes: [/\bAZUL\s+(?:SEGUROS|COMPANHIA\s+DE\s+SEGUROS)\b/i] },
  { id: 'itau', nome: 'Itaú Seguros', cnpj: '', padroes: [/\bITA[ÚU]\s+SEGUROS\b/i] },
  { id: 'tokio', nome: 'Tokio Marine', cnpj: '', padroes: [/\bTOKIO\s+MARINE\b/i] },
  { id: 'allianz', nome: 'Allianz', cnpj: '', padroes: [/\bALLIANZ\b/i] },
  { id: 'bradesco', nome: 'Bradesco Seguros', cnpj: '', padroes: [/\bBRADESCO\b/i] },
  { id: 'sulamerica', nome: 'SulAmérica', cnpj: '', padroes: [/\bSUL\s?AM[ÉE]RICA\b/i] },
  { id: 'hdi', nome: 'HDI Seguros', cnpj: '', padroes: [/\bHDI\b/i] },
  { id: 'mapfre', nome: 'Mapfre', cnpj: '', padroes: [/\bMAPFRE\b/i] },
  { id: 'liberty', nome: 'Liberty Seguros', cnpj: '', padroes: [/\bLIBERTY\b/i] },
  { id: 'zurich', nome: 'Zurich', cnpj: '', padroes: [/\bZURICH\b/i] },
  { id: 'suhai', nome: 'Suhai Seguradora', cnpj: '', padroes: [/\bSUHAI\b/i] },
  { id: 'aliro', nome: 'Aliro Seguros', cnpj: '', padroes: [/\bALIRO\b/i] },
  { id: 'yelum', nome: 'Yelum Seguros', cnpj: '', padroes: [/\bYELUM\b/i] },
]

export function detectarSeguradora(text) {
  const normalized = normalizeText(text)
  const cnpjs = [...normalized.matchAll(new RegExp(CNPJ_RE.source, 'g'))].map(m => onlyDigits(m[1]))

  for (const layout of LAYOUTS) {
    if (layout.cnpj && cnpjs.includes(onlyDigits(layout.cnpj))) return layout
  }
  for (const layout of LAYOUTS) {
    if (layout.padroes.some(padrao => padrao.test(normalized))) return layout
  }
  return null
}

// ─── Parser generico ───────────────────────────────────────────────────

function parseGenerico(normalized) {
  const vigencia = extrairVigencia(normalized)
  const condutor = extrairCondutor(normalized)
  const premioLiquido = extrairPremioLiquido(normalized)
  const premioTotal = extrairPremioTotal(normalized)
  const pctComissao = extrairPctComissao(normalized)

  return {
    nome_cliente: extrairNomeCliente(normalized),
    cpf_cliente: extrairCpf(normalized),
    celular_cliente: extrairCelular(normalized),
    email_cliente: extrairEmail(normalized),
    cep_pernoite: extrairCep(normalized),
    modelo_veiculo: extrairModeloVeiculo(normalized),
    placa: extrairPlaca(normalized),
    chassi: extrairChassi(normalized),
    ano_modelo: extrairAnoModelo(normalized),
    condutor_nome: condutor.nome,
    condutor_cpf: condutor.cpf,
    vigencia_inicio: vigencia.inicio,
    vigencia_fim: vigencia.fim,
    premio_liquido: premioLiquido,
    valor_total: premioTotal,
    pct_comissao: pctComissao,
    parcelamento: extrairParcelamento(normalized),
    forma_pagamento: extrairFormaPagamento(normalized),
    numero_apolice: extrairNumeroApolice(normalized),
    numero_proposta: extrairNumeroProposta(normalized),
    data_emissao: extrairDataEmissao(normalized),
  }
}

/**
 * Refinamentos por seguradora.
 *
 * Cada funcao recebe o texto normalizado e o resultado do parser generico, e
 * devolve APENAS os campos que precisa sobrescrever. Vazio = o generico ja
 * acerta. A preencher conforme os PDFs de exemplo forem chegando ao projeto.
 */
const REFINAMENTOS = {
  // porto: (normalized, generico) => ({ ... }),
}

// ─── Montagem do resultado ─────────────────────────────────────────────

// O front marca visualmente os campos que vieram do PDF (decisao: nada bloqueia
// o usuario, mas ele precisa enxergar o que foi extraido e o que ficou vazio).
// Por isso todo resultado carrega a lista `extraidos`.
function montar(campos) {
  const limpos = {}
  const extraidos = []
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor == null || valor === '') {
      limpos[chave] = ''
      continue
    }
    limpos[chave] = typeof valor === 'number' ? fmt(valor) : String(valor).trim()
    extraidos.push(chave)
  }
  return { campos: limpos, extraidos }
}

function base(text) {
  const normalized = normalizeText(text)
  const layout = detectarSeguradora(normalized)
  const generico = parseGenerico(normalized)
  const refinar = layout ? REFINAMENTOS[layout.id] : null
  const campos = refinar ? { ...generico, ...refinar(normalized, generico) } : generico
  return { normalized, layout, campos }
}

/**
 * Sobrepoe o resultado generico com o mapeamento configurado da seguradora.
 *
 * O generico continua rodando primeiro de proposito: o mapeamento cobre os
 * campos que o usuario confirmou naquele layout, e o generico segura o resto
 * (inclusive quando a seguradora muda o PDF e uma ancora deixa de existir).
 */
function combinarComMapeamento(campos, texto, mapeamento, tipo) {
  if (!mapeamento?.campos) return { campos, mapeados: [] }

  const { campos: doMapa } = aplicarMapeamento(texto, mapeamento, camposDoTipo(tipo))
  const combinados = { ...campos }
  const mapeados = []

  for (const [chave, valor] of Object.entries(doMapa)) {
    if (valor === '' || valor == null) continue
    combinados[chave] = valor
    mapeados.push(chave)
  }

  return { campos: combinados, mapeados }
}

/**
 * Orcamento: o que o usuario anexa ao FINALIZAR a cotacao.
 *
 * Devolve `seguradora_cotada` no mesmo formato de `NOVA_SEGURADORA`
 * (`AutoEmissoes.jsx`) para o modal de resultado conseguir preencher uma linha
 * do comparativo sem nenhuma traducao de campo no meio.
 *
 * `mapeamento` e a configuracao salva daquela seguradora
 * (`auto_pdf_mapeamentos`, tipo `cotacao`). Quando existe, vence o generico.
 */
export function parseOrcamentoAutoText(text, { mapeamento = null } = {}) {
  const { normalized, layout, campos: genericos } = base(text)
  const { campos, mapeados } = combinarComMapeamento(genericos, normalized, mapeamento, 'cotacao')
  const avisos = []
  if (!layout) {
    avisos.push('Seguradora não identificada no PDF — confira o campo antes de salvar.')
  }

  const { campos: dados, extraidos } = montar({
    nome_cliente: campos.nome_cliente,
    cpf_cliente: campos.cpf_cliente,
    celular_cliente: campos.celular_cliente,
    email_cliente: campos.email_cliente,
    cep_pernoite: campos.cep_pernoite,
    modelo_veiculo: campos.modelo_veiculo,
    placa: campos.placa,
    condutor_nome: campos.condutor_nome,
    condutor_cpf: campos.condutor_cpf,
    vigencia_inicio: campos.vigencia_inicio,
    vigencia_fim: campos.vigencia_fim,
  })

  const { campos: cotada, extraidos: extraidosCotada } = montar({
    nome: layout?.nome ?? '',
    valor_total: campos.valor_total,
    premio_liquido: campos.premio_liquido,
    pct_comissao: campos.pct_comissao,
    parcelamentos: campos.parcelamento,
    forma_pagamento: campos.forma_pagamento,
  })

  if (!cotada.premio_liquido && !cotada.valor_total) {
    avisos.push('Nenhum valor de prêmio encontrado no PDF — preencha manualmente.')
  }

  return {
    tipo: 'orcamento',
    layout: layout?.id ?? null,
    seguradora: layout?.nome ?? '',
    campos: dados,
    seguradora_cotada: cotada,
    extraidos: [...extraidos, ...extraidosCotada.map(c => `seguradora_cotada.${c}`)],
    mapeados,
    avisos,
    _text: normalized,
  }
}

/**
 * Proposta: o que o usuario anexa ao passar a cotacao para EMISSAO.
 *
 * As chaves batem 1:1 com as colunas de `emissoes_auto` / os campos de
 * `FORM_EMISSAO_VAZIO`, para o form preencher direto.
 *
 * `mapeamento` e a configuracao salva daquela seguradora
 * (`auto_pdf_mapeamentos`, tipo `apolice`). Quando existe, vence o generico.
 */
export function parsePropostaAutoText(text, { mapeamento = null } = {}) {
  const { normalized, layout, campos: genericos } = base(text)
  const { campos, mapeados } = combinarComMapeamento(genericos, normalized, mapeamento, 'apolice')
  const avisos = []
  if (!layout) {
    avisos.push('Seguradora não identificada no PDF — confira o campo antes de salvar.')
  }

  const { campos: dados, extraidos } = montar({
    nome_cliente: campos.nome_cliente,
    cpf_cliente: campos.cpf_cliente,
    celular_cliente: campos.celular_cliente,
    condutor_nome: campos.condutor_nome,
    condutor_cpf: campos.condutor_cpf,
    modelo_veiculo: campos.modelo_veiculo,
    placa: campos.placa,
    seguradora: layout?.nome ?? '',
    numero_apolice: campos.numero_apolice,
    numero_proposta: campos.numero_proposta,
    data_emissao: campos.data_emissao,
    vigencia_inicio: campos.vigencia_inicio,
    vigencia_fim: campos.vigencia_fim,
    premio_liquido: campos.premio_liquido,
    pct_comissao: campos.pct_comissao,
    forma_pagamento: campos.forma_pagamento,
    parcelamento: campos.parcelamento,
  })

  if (!dados.numero_apolice && !dados.numero_proposta) {
    avisos.push('Número de apólice/proposta não encontrado — confira o PDF anexado.')
  }

  return {
    tipo: 'proposta',
    layout: layout?.id ?? null,
    seguradora: layout?.nome ?? '',
    campos: dados,
    extraidos,
    mapeados,
    avisos,
    _text: normalized,
  }
}

// ─── Leitura do PDF (browser) ──────────────────────────────────────────

// `extractPdfText` vive em `apoliceParser.js` e ja configura o worker do pdfjs.
// O import e dinamico para manter este modulo utilizavel em `node --test` sem
// carregar pdfjs-dist nem precisar de shim de DOM.
async function lerTexto(file) {
  const { extractPdfText } = await import('./apoliceParser.js')
  return extractPdfText(file)
}

export async function parseOrcamentoAuto(file, opcoes = {}) {
  return parseOrcamentoAutoText(await lerTexto(file), opcoes)
}

export async function parsePropostaAuto(file, opcoes = {}) {
  return parsePropostaAutoText(await lerTexto(file), opcoes)
}
