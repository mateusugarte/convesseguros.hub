/**
 * Persistencia da configuracao de leitura de PDF por seguradora (setor AUTO).
 *
 * A logica de mapeamento vive em `autoPdfMapeamento.js` (modulo puro, testado).
 * Aqui ficam apenas o acesso ao Supabase, o upload da amostra e a leitura do
 * texto do PDF — tudo que depende de browser ou de rede.
 *
 * A amostra vai para o bucket privado `entidade-documentos`, o mesmo ja usado
 * pelos documentos de seguradora/imobiliaria, em vez de um bucket novo: o PDF de
 * exemplo carrega dados reais de cliente e nao pode ficar publico.
 */

import { supabase } from './supabase'
import { ENTITY_DOCS_BUCKET, removeStorageObject } from './entityMedia'
import { fetchSeguradorasPorProduto, fetchSeguradorasCatalog, findSeguradoraMetaByNome } from './seguradoras'
import { camposDoTipo } from './autoPdfCampos'
import { resumirMapeamento, sugerirMapeamento } from './autoPdfMapeamento'

const TABELA = 'auto_pdf_mapeamentos'
const SELECT = 'id, seguradora_id, tipo, status, campos, amostra_path, amostra_nome, amostra_texto, atualizado_por, updated_at'
const AMOSTRA_TTL = 60 * 60

export const TIPOS = ['cotacao', 'apolice']

function validarTipo(tipo) {
  if (!TIPOS.includes(tipo)) throw new Error(`Tipo de mapeamento invalido: ${tipo}`)
  return tipo
}

/**
 * Seguradoras que aparecem na grade de configuracao.
 *
 * Prioriza quem esta marcada com o produto AUTO no cadastro. Se ninguem estiver
 * (cadastro antigo, so com produtos de fianca), devolve todas as ativas com o
 * aviso `fallback` — melhor mostrar a lista completa do que uma tela vazia.
 */
export async function listarSeguradorasAuto() {
  const doAuto = await fetchSeguradorasPorProduto('auto')
  if (doAuto.length) return { seguradoras: doAuto, fallback: false }

  const catalogo = await fetchSeguradorasCatalog()
  return { seguradoras: catalogo.filter(seg => seg.ativa !== false), fallback: true }
}

export async function fetchMapeamentos(tipo) {
  const { data, error } = await supabase
    .from(TABELA)
    .select(SELECT)
    .eq('tipo', validarTipo(tipo))

  if (error) throw error
  return data || []
}

export async function fetchMapeamento(seguradoraId, tipo) {
  const { data, error } = await supabase
    .from(TABELA)
    .select(SELECT)
    .eq('seguradora_id', seguradoraId)
    .eq('tipo', validarTipo(tipo))
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function salvarMapeamento({
  seguradoraId,
  tipo,
  campos,
  status = 'rascunho',
  amostraPath = null,
  amostraNome = null,
  amostraTexto = null,
  userId = null,
}) {
  const payload = {
    seguradora_id: seguradoraId,
    tipo: validarTipo(tipo),
    campos: campos || {},
    status,
    amostra_path: amostraPath,
    amostra_nome: amostraNome,
    amostra_texto: amostraTexto,
    atualizado_por: userId,
  }

  const { data, error } = await supabase
    .from(TABELA)
    .upsert(payload, { onConflict: 'seguradora_id,tipo' })
    .select(SELECT)
    .single()

  if (error) throw error
  return data
}

export async function limparMapeamento(seguradoraId, tipo) {
  const atual = await fetchMapeamento(seguradoraId, tipo)
  if (atual?.amostra_path) await removeStorageObject(ENTITY_DOCS_BUCKET, atual.amostra_path)

  const { error } = await supabase
    .from(TABELA)
    .delete()
    .eq('seguradora_id', seguradoraId)
    .eq('tipo', validarTipo(tipo))

  if (error) throw error
}

// ─── Amostra em PDF ────────────────────────────────────────────────────

function nomeUnico(fileName) {
  const partes = String(fileName || 'amostra.pdf').split('.')
  const ext = partes.length > 1 ? `.${partes.pop()}` : '.pdf'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
}

export async function enviarAmostra({ file, seguradoraId, tipo, pathAnterior = null }) {
  const path = `seguradora/${seguradoraId}/auto-pdf/${validarTipo(tipo)}/${nomeUnico(file.name)}`

  const { error } = await supabase.storage
    .from(ENTITY_DOCS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || 'application/pdf' })

  if (error) throw error

  // Só remove a anterior depois que a nova subiu, para nunca ficar sem amostra.
  if (pathAnterior && pathAnterior !== path) {
    await removeStorageObject(ENTITY_DOCS_BUCKET, pathAnterior)
  }

  return path
}

export async function urlAmostra(path) {
  if (!path) return null
  const { data, error } = await supabase.storage
    .from(ENTITY_DOCS_BUCKET)
    .createSignedUrl(path, AMOSTRA_TTL)

  if (error) return null
  return data?.signedUrl || null
}

/** Baixa a amostra salva para reabrir o PDF na tela sem novo upload. */
export async function baixarAmostra(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(ENTITY_DOCS_BUCKET).download(path)
  if (error) return null
  return data
}

/**
 * Texto do PDF.
 *
 * `extractPdfText` (de `apoliceParser.js`) ja configura o worker do pdfjs e e o
 * mesmo extrator usado pela leitura de fianca — import dinamico para o pdfjs nao
 * entrar no bundle de quem so abre a tela de configuracao.
 */
export async function lerTextoPdf(file) {
  const { extractPdfText } = await import('./apoliceParser.js')
  return extractPdfText(file)
}

// ─── Uso em producao ───────────────────────────────────────────────────

/**
 * Mapeamento concluido de uma seguradora, procurado pelo nome que aparece no
 * PDF (o mesmo caminho de resolucao de alias ja usado pelo catalogo).
 */
export async function mapeamentoConcluidoPorNome(nomeSeguradora, tipo) {
  if (!nomeSeguradora) return null
  const meta = await findSeguradoraMetaByNome(nomeSeguradora)
  if (!meta?.id) return null

  const mapeamento = await fetchMapeamento(meta.id, tipo)
  if (!mapeamento || mapeamento.status !== 'concluido') return null
  return mapeamento
}

/**
 * Ponto unico de leitura de PDF do setor AUTO em producao.
 *
 * A ordem importa: primeiro o texto, depois a seguradora (detectada pelo proprio
 * documento, como o parser ja fazia) e so entao o mapeamento configurado dela.
 * Sem configuracao concluida, o parser generico continua respondendo — a
 * automacao nunca fica bloqueada por falta de mapeamento.
 */
export async function lerPdfAuto(file, tipo) {
  validarTipo(tipo)
  const texto = await lerTextoPdf(file)
  const { detectarSeguradora, parseOrcamentoAutoText, parsePropostaAutoText } = await import('./autoPdfParser.js')

  const layout = detectarSeguradora(texto)
  const mapeamento = layout ? await mapeamentoConcluidoPorNome(layout.nome, tipo) : null

  const resultado = tipo === 'cotacao'
    ? parseOrcamentoAutoText(texto, { mapeamento })
    : parsePropostaAutoText(texto, { mapeamento })

  return { ...resultado, usouMapeamento: Boolean(mapeamento) }
}

/** Sugestoes + resumo para a tela de configuracao. */
export function prepararSugestoes(texto, tipo, salvo) {
  const definicoes = camposDoTipo(tipo)
  return {
    definicoes,
    sugestoes: sugerirMapeamento(texto, definicoes),
    resumo: resumirMapeamento(salvo, definicoes),
  }
}
