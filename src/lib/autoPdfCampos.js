/**
 * Catalogo dos campos que o sistema pede hoje no setor AUTO.
 *
 * Esta lista e a fonte de verdade tanto para o mapeamento assistido
 * (`autoPdfMapeamento.js`) quanto para a tela de configuracao por seguradora.
 * As chaves batem com as colunas de `cotacoes_auto` / `emissoes_auto` /
 * `apolices_auto` e com as chaves ja devolvidas por `autoPdfParser.js`, para o
 * resultado do mapeamento cair direto no formulario sem traducao no meio.
 *
 * `sinonimos` sao os rotulos que costumam aparecer nos PDFs dos portais.
 * `proibidos` evita que um campo capture o rotulo do vizinho — o caso classico
 * e "CPF" do segurado versus "CPF do condutor", que sao literalmente o mesmo
 * tipo de valor no mesmo documento.
 */

export const TIPOS_VALOR = {
  texto: 'Texto',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  placa: 'Placa',
  chassi: 'Chassi',
  data: 'Data',
  moeda: 'Valor (R$)',
  percentual: 'Percentual',
  email: 'E-mail',
  telefone: 'Telefone',
  cep: 'CEP',
  documento: 'Numero de documento',
  ano: 'Ano',
  sim_nao: 'Sim / Nao',
}

const SEGURADO = 'Segurado'
const CONDUTOR = 'Condutor'
const VEICULO = 'Veiculo'
const RISCO = 'Perfil de risco'
const CONTRATO = 'Contrato'
const VALORES = 'Valores'

const PROIBIDOS_SEGURADO = ['condutor', 'corretor', 'corretora', 'estipulante', 'beneficiario']
const PROIBIDOS_CONDUTOR = ['segurado', 'proponente', 'corretor', 'corretora']

/** Campos comuns a cotacao e apolice — dados do cliente, condutor e veiculo. */
const CAMPOS_COMUNS = [
  {
    key: 'nome_cliente',
    label: 'Nome do segurado',
    grupo: SEGURADO,
    tipo: 'texto',
    obrigatorio: true,
    sinonimos: ['nome do segurado', 'segurado', 'proponente', 'nome / razao social', 'razao social', 'nome do proponente', 'cliente', 'nome'],
    proibidos: PROIBIDOS_SEGURADO,
  },
  {
    key: 'cpf_cliente',
    label: 'CPF do segurado',
    grupo: SEGURADO,
    tipo: 'cpf',
    obrigatorio: true,
    sinonimos: ['cpf do segurado', 'cpf/cnpj', 'cpf / cnpj', 'cpf', 'documento do segurado'],
    proibidos: PROIBIDOS_SEGURADO,
  },
  {
    key: 'celular_cliente',
    label: 'Celular do segurado',
    grupo: SEGURADO,
    tipo: 'telefone',
    sinonimos: ['celular', 'telefone celular', 'telefone', 'fone', 'whatsapp', 'contato'],
    proibidos: PROIBIDOS_SEGURADO,
  },
  {
    key: 'email_cliente',
    label: 'E-mail do segurado',
    grupo: SEGURADO,
    tipo: 'email',
    sinonimos: ['e-mail', 'email', 'correio eletronico'],
    proibidos: PROIBIDOS_SEGURADO,
  },
  {
    key: 'condutor_nome',
    label: 'Nome do condutor principal',
    grupo: CONDUTOR,
    tipo: 'texto',
    sinonimos: ['principal condutor', 'condutor principal', 'nome do condutor', 'condutor'],
    proibidos: PROIBIDOS_CONDUTOR,
  },
  {
    key: 'condutor_cpf',
    label: 'CPF do condutor',
    grupo: CONDUTOR,
    tipo: 'cpf',
    sinonimos: ['cpf do condutor', 'cpf do principal condutor', 'documento do condutor'],
    proibidos: PROIBIDOS_CONDUTOR,
  },
  {
    key: 'modelo_veiculo',
    label: 'Marca / modelo do veiculo',
    grupo: VEICULO,
    tipo: 'texto',
    obrigatorio: true,
    sinonimos: ['marca / modelo', 'marca modelo', 'modelo do veiculo', 'descricao do veiculo', 'veiculo', 'modelo'],
    proibidos: ['reboque'],
  },
  {
    key: 'placa',
    label: 'Placa',
    grupo: VEICULO,
    tipo: 'placa',
    obrigatorio: true,
    sinonimos: ['placa', 'placa do veiculo'],
  },
  {
    key: 'chassi',
    label: 'Chassi',
    grupo: VEICULO,
    tipo: 'chassi',
    sinonimos: ['chassi', 'numero do chassi'],
  },
  {
    key: 'ano_modelo',
    label: 'Ano / modelo',
    grupo: VEICULO,
    tipo: 'ano',
    sinonimos: ['ano / modelo', 'ano modelo', 'ano fabricacao modelo', 'ano do veiculo', 'ano'],
  },
  {
    key: 'vigencia_inicio',
    label: 'Inicio de vigencia',
    grupo: CONTRATO,
    tipo: 'data',
    obrigatorio: true,
    sinonimos: ['inicio de vigencia', 'inicio da vigencia', 'vigencia inicial', 'inicio de vigencia do seguro', 'a partir de', 'inicio'],
    proibidos: ['fim', 'termino', 'final'],
  },
  {
    key: 'vigencia_fim',
    label: 'Fim de vigencia',
    grupo: CONTRATO,
    tipo: 'data',
    obrigatorio: true,
    sinonimos: ['fim de vigencia', 'termino de vigencia', 'final de vigencia', 'vigencia final', 'vencimento', 'termino'],
    proibidos: ['inicio', 'inicial'],
  },
]

/** Valores do seguro — presentes tanto no orcamento quanto na proposta/apolice. */
const CAMPOS_VALORES = [
  {
    key: 'premio_liquido',
    label: 'Premio liquido',
    grupo: VALORES,
    tipo: 'moeda',
    obrigatorio: true,
    sinonimos: ['premio liquido', 'premio liquido do seguro', 'liquido'],
    proibidos: ['total', 'bruto'],
  },
  {
    key: 'valor_total',
    label: 'Premio total',
    grupo: VALORES,
    tipo: 'moeda',
    obrigatorio: true,
    sinonimos: ['premio total', 'valor total', 'total a pagar', 'preco total do seguro', 'premio bruto', 'valor total do seguro'],
    proibidos: ['liquido'],
  },
  {
    key: 'pct_comissao',
    label: '% de comissao',
    grupo: VALORES,
    tipo: 'percentual',
    sinonimos: ['percentual de comissao', '% comissao', 'comissao', 'taxa de comissao'],
  },
  {
    key: 'forma_pagamento',
    label: 'Forma de pagamento',
    grupo: VALORES,
    tipo: 'texto',
    sinonimos: ['forma de pagamento', 'meio de pagamento', 'pagamento'],
  },
  {
    key: 'parcelamento',
    label: 'Parcelamento',
    grupo: VALORES,
    tipo: 'texto',
    sinonimos: ['parcelamento', 'parcelas', 'condicao de pagamento', 'numero de parcelas'],
  },
]

/** Perguntas do formulario de cotacao que a corretora precisa responder. */
const CAMPOS_RISCO = [
  {
    key: 'cep_pernoite',
    label: 'CEP de pernoite',
    grupo: RISCO,
    tipo: 'cep',
    sinonimos: ['cep de pernoite', 'cep pernoite', 'local de pernoite', 'cep de circulacao', 'cep'],
  },
  {
    key: 'uso_veiculo',
    label: 'Uso do veiculo',
    grupo: RISCO,
    tipo: 'texto',
    sinonimos: ['uso do veiculo', 'utilizacao do veiculo', 'finalidade de uso', 'uso'],
  },
  {
    key: 'garagem_residencia',
    label: 'Garagem na residencia',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['garagem na residencia', 'garagem residencia', 'possui garagem na residencia', 'garagem em casa'],
    proibidos: ['trabalho', 'estudo'],
  },
  {
    key: 'garagem_trabalho',
    label: 'Garagem no trabalho',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['garagem no trabalho', 'garagem trabalho', 'estacionamento no trabalho'],
    proibidos: ['residencia', 'estudo'],
  },
  {
    key: 'garagem_estudo',
    label: 'Garagem no local de estudo',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['garagem no local de estudo', 'garagem estudo', 'estacionamento na faculdade', 'garagem na escola'],
    proibidos: ['residencia', 'trabalho'],
  },
  {
    key: 'jovens_18_26',
    label: 'Condutor entre 18 e 26 anos',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['jovens de 18 a 26 anos', 'condutor jovem', 'jovem entre 18 e 26', 'residentes de 18 a 26 anos'],
  },
  {
    key: 'veiculo_financiado',
    label: 'Veiculo financiado / alienado',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['veiculo financiado', 'alienacao fiduciaria', 'alienado', 'financiamento', 'leasing'],
  },
  {
    key: 'possui_kit_gas',
    label: 'Possui kit gas',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['kit gas', 'possui kit gas', 'gnv'],
  },
  {
    key: 'possui_blindagem',
    label: 'Possui blindagem',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['blindagem', 'veiculo blindado', 'possui blindagem'],
  },
  {
    key: 'isento_imposto',
    label: 'Isento de imposto',
    grupo: RISCO,
    tipo: 'sim_nao',
    sinonimos: ['isencao de imposto', 'isento de ipi', 'isento de icms', 'isencao'],
  },
]

/** Identificacao do documento — so faz sentido na proposta / apolice. */
const CAMPOS_DOCUMENTO = [
  {
    key: 'numero_apolice',
    label: 'Numero da apolice',
    grupo: CONTRATO,
    tipo: 'documento',
    obrigatorio: true,
    sinonimos: ['numero da apolice', 'apolice n', 'apolice numero', 'apolice', 'n da apolice'],
    proibidos: ['proposta', 'endosso', 'item'],
  },
  {
    key: 'numero_proposta',
    label: 'Numero da proposta',
    grupo: CONTRATO,
    tipo: 'documento',
    sinonimos: ['numero da proposta', 'proposta n', 'proposta numero', 'proposta'],
    proibidos: ['apolice', 'endosso'],
  },
  {
    key: 'data_emissao',
    label: 'Data de emissao',
    grupo: CONTRATO,
    tipo: 'data',
    sinonimos: ['data de emissao', 'data da emissao', 'emitida em', 'emissao'],
    proibidos: ['vigencia'],
  },
]

export const CAMPOS_COTACAO = [...CAMPOS_COMUNS, ...CAMPOS_RISCO, ...CAMPOS_VALORES]

export const CAMPOS_APOLICE = [...CAMPOS_COMUNS, ...CAMPOS_DOCUMENTO, ...CAMPOS_VALORES]

export const TIPOS_MAPEAMENTO = [
  {
    tipo: 'cotacao',
    titulo: 'Cotacoes Auto',
    descricao: 'Leitura do orcamento enviado pela seguradora para montar o comparativo da cotacao.',
    rota: '/configuracoes/auto/cotacoes',
  },
  {
    tipo: 'apolice',
    titulo: 'Apolices Auto',
    descricao: 'Leitura da proposta / apolice emitida para preencher a emissao e a apolice.',
    rota: '/configuracoes/auto/apolices',
  },
]

export function camposDoTipo(tipo) {
  return tipo === 'cotacao' ? CAMPOS_COTACAO : CAMPOS_APOLICE
}

export function tituloDoTipo(tipo) {
  return TIPOS_MAPEAMENTO.find(item => item.tipo === tipo)?.titulo || tipo
}

/** Ordem em que os grupos aparecem na tela de configuracao. */
export const ORDEM_GRUPOS = [SEGURADO, CONDUTOR, VEICULO, RISCO, CONTRATO, VALORES]

export function agruparCampos(campos) {
  const grupos = new Map()
  for (const campo of campos) {
    if (!grupos.has(campo.grupo)) grupos.set(campo.grupo, [])
    grupos.get(campo.grupo).push(campo)
  }
  return ORDEM_GRUPOS
    .filter(nome => grupos.has(nome))
    .map(nome => ({ grupo: nome, campos: grupos.get(nome) }))
}
