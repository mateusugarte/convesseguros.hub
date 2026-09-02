// Traduz os campos lidos no PDF comparativo para a ficha operacional da
// cotacao. A leitura continua pertencendo ao orcamento; este modulo decide o
// que pode preencher sozinho e o que precisa de confirmacao humana.

export const AUTO_QUOTE_CLIENT_FIELD_MAP = {
  segurado_nome: { target: 'nome_cliente', label: 'Nome do segurado', client: 'nome_completo' },
  segurado_cpf: { target: 'cpf_cliente', label: 'CPF / CNPJ', client: 'cpf' },
  condutor_nome: { target: 'condutor_nome', label: 'Nome do condutor' },
  condutor_cpf: { target: 'condutor_cpf', label: 'CPF do condutor' },
  condutor_estado_civil: { target: 'estado_civil_condutor', label: 'Estado civil do condutor' },
  veiculo_modelo: { target: 'modelo_veiculo', label: 'Veículo' },
  veiculo_placa: { target: 'placa', label: 'Placa' },
  veiculo_uso: { target: 'uso_veiculo', label: 'Uso do veículo' },
  veiculo_cep_pernoite: { target: 'cep_pernoite', label: 'CEP de pernoite' },
  veiculo_tipo_residencia: { target: 'tipo_residencia', label: 'Tipo de residência' },
  veiculo_passagem_leilao: { target: 'passagem_leilao', label: 'Passagem por leilão' },
  veiculo_financiado: { target: 'veiculo_financiado', label: 'Financiado / alienado' },
  veiculo_kit_gas: { target: 'possui_kit_gas', label: 'Kit gás' },
  veiculo_blindagem: { target: 'possui_blindagem', label: 'Blindagem' },
  veiculo_isento_imposto: { target: 'isento_imposto', label: 'Isenção de imposto' },
  veiculo_garagem_residencia: { target: 'garagem_residencia', label: 'Garagem na residência' },
  veiculo_garagem_trabalho: { target: 'garagem_trabalho', label: 'Garagem no trabalho' },
  veiculo_garagem_estudo: { target: 'garagem_estudo', label: 'Garagem no local de estudo' },
  vigencia_inicio: { target: 'vigencia_inicio', label: 'Início da vigência' },
  vigencia_fim: { target: 'vigencia_fim', label: 'Fim da vigência' },
}

function text(value) {
  return String(value ?? '').trim()
}

function comparable(field, value) {
  const raw = text(value)
  if (['cpf_cliente', 'condutor_cpf', 'cep_pernoite'].includes(field)) return raw.replace(/\D/g, '')
  if (field === 'placa') return raw.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

export function extractedQuoteClientPatch(fields = {}) {
  return Object.entries(AUTO_QUOTE_CLIENT_FIELD_MAP).reduce((patch, [source, meta]) => {
    const value = text(fields[source])
    if (value) patch[meta.target] = value
    return patch
  }, {})
}

function currentValue(quote, meta) {
  const direct = text(quote?.[meta.target])
  if (direct) return direct
  return meta.client ? text(quote?.clientes_auto?.[meta.client]) : ''
}

export function planExtractedQuoteClientSync(quote = {}, fields = {}) {
  const extracted = extractedQuoteClientPatch(fields)
  const automaticPatch = {}
  const conflicts = []

  Object.entries(extracted).forEach(([field, value]) => {
    const meta = Object.values(AUTO_QUOTE_CLIENT_FIELD_MAP).find(item => item.target === field)
    const current = currentValue(quote, meta)
    if (!current) {
      automaticPatch[field] = value
      return
    }
    if (comparable(field, current) === comparable(field, value)) {
      // O cliente vinculado pode ter o valor enquanto a copia da cotacao esta
      // vazia. Preencher a cotacao faz o snapshot ficar completo sem alterar o
      // cadastro mestre.
      if (!text(quote?.[field])) automaticPatch[field] = value
      return
    }
    conflicts.push({ field, label: meta?.label || field, current, extracted: value })
  })

  return { automaticPatch, conflicts }
}

export function clientPatchFromQuotePatch(patch = {}) {
  return Object.values(AUTO_QUOTE_CLIENT_FIELD_MAP).reduce((clientPatch, meta) => {
    if (meta.client && patch[meta.target] !== undefined) clientPatch[meta.client] = patch[meta.target]
    return clientPatch
  }, {})
}
