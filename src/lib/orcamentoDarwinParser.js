// Parser fixo da cotacao Darwin. O layout usa rotulo/valor em linhas
// separadas e uma tabela de coberturas com baseline levemente desalinhada;
// por isso os valores sao casados por coordenada e proximidade vertical.

import { agruparLinhas } from './pdfLayout.js'
import {
  classificarCobertura, criarCotacaoOrcamento, detectarTipoOperacao, humanizarCobertura,
} from './orcamentoComparativo.js'
import {
  formatarCep, formatarMoeda, moeda, paraIso, percentual, textoNaColuna, valorAbaixoRotulo,
} from './orcamentoParserUtils.js'

export const CNPJ_DARWIN = '44.187.990/0001-94'

export function ehLayoutDarwin(texto) {
  const t = String(texto || '')
  return t.replace(/\D/g, '').includes(CNPJ_DARWIN.replace(/\D/g, ''))
    && /Darwin\s+Seguros/i.test(t)
}

const NOMES_COBERTURA = [
  /Colis[aã]o \(Perda Total e Parcial\)/i,
  /Roubo ou Furto \(Perda Total e Parcial\)/i,
  /Inc[êe]ndio \(Perda Total e Parcial\)/i,
  /Alagamento \(Perda Total e Parcial\)/i,
  /^Morte$/i,
  /^Danos Materiais$/i,
  /^Danos Corporais$/i,
  /^Danos Morais$/i,
  /Assist[êe]ncia 24h/i,
  /Carro reserva/i,
  /Cobertura Vidros/i,
]

export function extrairCoberturasDarwin(linhas) {
  const pagina = linhas.filter(l => l.pagina === 2)
  const cabecalho = pagina.find(l => /Coberturas/.test(l.texto) && /LMI/.test(l.texto) && /Pr[êe]mio/.test(l.texto))
  const xLmi = cabecalho?.celulas.find(c => /LMI/i.test(c.texto))?.x ?? 1259
  const xPremio = cabecalho?.celulas.find(c => /Pr[êe]mio/i.test(c.texto))?.x ?? 1769
  const resultado = []

  for (const linha of pagina) {
    if (linha.y < 1200) continue
    const nomeCelula = linha.celulas.find(c => c.x < xLmi - 100 && NOMES_COBERTURA.some(p => p.test(c.texto)))
    if (!nomeCelula) continue

    const vizinhas = pagina.filter(l => Math.abs(l.y - linha.y) <= 16)
    const celulas = vizinhas.flatMap(l => l.celulas)
    const lmiTexto = textoNaColuna({ celulas }, xLmi, 180)
    const premioTexto = textoNaColuna({ celulas }, xPremio, 180)
    const incluida = !/n[ãa]o contratad/i.test(lmiTexto)
    const nome = nomeCelula.texto.trim()

    resultado.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      categoria: classificarCobertura(nome) || (/^Morte$/i.test(nome) ? 'adicional' : null),
      incluida,
      valor_lmi: moeda(lmiTexto),
      lmi_percentual: percentual(lmiTexto),
      premio: moeda(premioTexto),
      observacoes: incluida ? observacao(nome, lmiTexto) : 'Não contratada nesta cotação.',
    })
  }
  return resultado
}

export function extrairFranquiasVidrosDarwin(linhas) {
  const pagina = linhas.filter(l => l.pagina === 4)
  const resultado = []
  for (const linha of pagina) {
    const nome = linha.celulas.find(c => c.x < 900)?.texto
    const valor = linha.celulas.find(c => c.x > 1200)?.texto
    if (!nome || moeda(valor) == null || /^(Pe[çc]a|Valores|Franquia)/i.test(nome)) continue
    resultado.push({ nome, valor: moeda(valor) })
  }
  return resultado
}

export function extrairPagamentoDarwin(linhas) {
  const pagina = linhas.filter(l => l.pagina === 3)
  const planos = []
  for (const linha of pagina) {
    const parcela = linha.celulas[0]?.texto.match(/^(?:[ÀA] vista|(\d+) parcelas)$/i)
    if (!parcela) continue
    const valorParcela = moeda(textoNaColuna(linha, 460, 110))
    const total = moeda(textoNaColuna(linha, 1942, 160))
    if (valorParcela == null || total == null) continue
    planos.push({ n: parcela[1] ? Number(parcela[1]) : 1, valor_parcela: valorParcela, total })
  }
  return planos
}

export function parseCotacaoDarwin({ itens = [], texto = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const p2 = linhas.filter(l => l.pagina === 2)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Darwin Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const numero = texto.match(/Cota[çc][ãa]o\s+n?[ºo]?\s*(\d{10,})/i)
  const transmissao = valorAbaixoRotulo(p2, 'Data de transmissão')
  cot.cotacao = {
    numero: numero?.[1] || valorAbaixoRotulo(p2, 'Cotação'),
    tipo_operacao: detectarTipoOperacao(valorAbaixoRotulo(p2, 'Tipo de operação')) || '',
    validade: paraIso(valorAbaixoRotulo(p2, 'Validade da cotação')),
    data_emissao: paraIso(transmissao),
  }

  cot.segurado = {
    nome: valorAbaixoRotulo(p1, 'Segurado'),
    cpf_cnpj: valorAbaixoRotulo(p1, 'CPF'),
    data_nascimento: paraIso(valorAbaixoRotulo(p1, 'Nascimento')) || null,
  }
  cot.condutor_principal = {
    nome: valorAbaixoRotulo(p1, 'Condutor'),
    cpf: valorAbaixoRotulo(p1, 'CPF', { ocorrencia: 1 }),
    estado_civil: null,
  }
  cot.veiculo = {
    marca_modelo: valorAbaixoRotulo(p1, 'Veículo'),
    ano_modelo: valorAbaixoRotulo(p1, 'Ano do veículo'),
    placa: valorAbaixoRotulo(p1, 'Placa'),
    uso: valorAbaixoRotulo(p1, 'Tipo de uso'),
    cep_pernoite: formatarCep(valorAbaixoRotulo(p1, 'CEP de pernoite')),
    condutor_18_25: /^n[ãa]o$/i.test(valorAbaixoRotulo(p1, 'Reside com condutor menor de 26 anos?'))
      ? 'Sem cobertura' : valorAbaixoRotulo(p1, 'Reside com condutor menor de 26 anos?') || null,
  }

  cot.vigencia = {
    inicio: paraIso(valorAbaixoRotulo(p2, 'Início da vigência')),
    fim: paraIso(valorAbaixoRotulo(p2, 'Fim da vigência')),
  }

  const coberturas = extrairCoberturasDarwin(linhas)
  const totalLinha = p2.find(l => /Valor total a partir/i.test(l.texto))
  const liquidoLinha = p2.find(l => /Total pr[êe]mio l[íi]quido/i.test(l.texto))
  const iofLinha = p2.find(l => /^IOF/i.test(l.celulas[0]?.texto || '') || / IOF /.test(` ${l.texto} `))
  const franquiaLinha = p2.find(l => /Perdas parciais/i.test(l.texto) && l.y < 700)
  const pagamentos = extrairPagamentoDarwin(linhas)
  const melhor = pagamentos.reduce((acc, p) => (!acc || p.n > acc.n ? p : acc), null)

  cot.valores = {
    premio_liquido: valorProximo(p2, liquidoLinha, 1770),
    iof: valorProximo(p2, iofLinha, 1770),
    premio_total: valorProximo(p2, totalLinha, 1770),
    premio_parcelado: melhor
      ? [`Pix: à vista ${formatarMoeda(valorProximo(p2, totalLinha, 1770))}`, `Cartão: até ${melhor.n}x de ${formatarMoeda(melhor.valor_parcela)} sem juros`]
      : '',
    descontos_aplicados: [],
    franquia: moeda(franquiaLinha?.texto),
    franquia_tipo: 'Perdas parciais',
  }

  cot.indenizacao_integral = coberturas.some(c => c.categoria === 'colisao' && c.lmi_percentual === 100)
    ? { incluida: true, percentual_fipe: 100, observacao: '' }
    : { incluida: null, percentual_fipe: null, observacao: '' }

  cot.coberturas = coberturas.filter(c => c.incluida)
  cot.nao_incluso = coberturas.filter(c => !c.incluida).map(c => ({
    titulo: humanizarCobertura(c.nome_original_seguradora), detalhe: c.observacoes,
  }))
  cot.assistencias = []
  cot.servicos_adicionais = ['Oficina em rede referenciada']

  const vidros = extrairFranquiasVidrosDarwin(linhas)
  const vidro = cot.coberturas.find(c => c.categoria === 'vidros')
  if (vidro && vidros.length) {
    vidro.observacoes = `Cobertura de vidros completa — franquias: ${vidros.slice(0, 6).map(v => `${v.nome} ${formatarMoeda(v.valor)}`).join(', ')}.`
  }

  cot.condicoes_gerais = { referencia: 'Processo SUSEP 15414.601839/2025-31', anexada_em: '' }
  return cot
}

function observacao(nome, lmiTexto) {
  const rotulo = humanizarCobertura(nome)
  const valor = moeda(lmiTexto)
  if (valor != null) return `${rotulo}: ${formatarMoeda(valor)}.`
  if (percentual(lmiTexto) != null) return `${rotulo}: ${lmiTexto}.`
  return rotulo
}

function valorProximo(linhas, linhaRotulo, x) {
  if (!linhaRotulo) return null
  const vizinhas = linhas.filter(l => Math.abs(l.y - linhaRotulo.y) <= 16)
  return moeda(textoNaColuna({ celulas: vizinhas.flatMap(l => l.celulas) }, x, 180))
}
