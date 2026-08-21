function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizePolicyMatchText(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function splitInsuredAndVehicle(value) {
  const clean = cleanText(value)
  if (!clean) return { insured: '', vehicle: '', separated: false }

  const match = clean.match(/^(.*?)\s*(?:-{2,}|—{2,}|–{2,})\s*(.+)$/)
  if (!match) {
    return {
      insured: clean.replace(/\s*(?:-{2,}|—{2,}|–{2,})\s*$/g, '').trim(),
      vehicle: '',
      separated: false,
    }
  }

  return {
    insured: cleanText(match[1]),
    vehicle: cleanText(match[2]).replace(/^(?:-{2,}|—{2,}|–{2,})\s*/g, ''),
    separated: true,
  }
}

export function normalizePolicyImportIdentity(row = {}) {
  const rawName = cleanText(row.nome_cliente)
  const rawVehicle = cleanText(row.modelo_veiculo)
  const fromName = splitInsuredAndVehicle(rawName)
  const fromVehicle = splitInsuredAndVehicle(rawVehicle)

  let nomeCliente = fromName.insured
  let modeloVeiculo = rawVehicle

  if (fromName.separated && fromName.vehicle) {
    modeloVeiculo = !rawVehicle || normalizePolicyMatchText(rawVehicle) === normalizePolicyMatchText(rawName)
      ? fromName.vehicle
      : rawVehicle
  }

  if (fromVehicle.separated) {
    if (!nomeCliente || normalizePolicyMatchText(nomeCliente) === normalizePolicyMatchText(fromVehicle.vehicle)) {
      nomeCliente = fromVehicle.insured
    }
    modeloVeiculo = fromVehicle.vehicle
  }

  return {
    ...row,
    nome_cliente: cleanText(nomeCliente),
    modelo_veiculo: cleanText(modeloVeiculo)
      .replace(/^(?:-{2,}|—{2,}|–{2,})\s*/g, '')
      .replace(/\s*(?:-{2,}|—{2,}|–{2,})\s*$/g, '')
      .trim(),
  }
}

export function policyClientCandidates(nameValue, clients = []) {
  const name = normalizePolicyMatchText(nameValue)
  if (name.length < 3) return []

  const normalized = clients
    .map(client => ({ client, name: normalizePolicyMatchText(client?.nome_completo) }))
    .filter(entry => entry.name)
  const exact = normalized.filter(entry => entry.name === name)
  if (exact.length) return exact.map(entry => entry.client)

  return normalized
    .filter(entry => entry.name.startsWith(name) || name.startsWith(entry.name))
    .slice(0, 4)
    .map(entry => entry.client)
}

export function policyVehicleCandidates(client = {}) {
  const unique = new Map()
  ;(client.veiculos || []).forEach(vehicle => {
    const modelo = cleanText(vehicle?.modelo_veiculo)
    const placa = cleanText(vehicle?.placa).toUpperCase()
    if (!modelo && !placa) return
    const key = `${normalizePolicyMatchText(modelo)}|${normalizePolicyMatchText(placa)}`
    if (!unique.has(key)) unique.set(key, { ...vehicle, modelo_veiculo: modelo, placa })
  })
  return Array.from(unique.values())
}

export function suggestPolicyVehicle(row = {}, client = {}) {
  const rowModel = normalizePolicyMatchText(row.modelo_veiculo)
  const rowPlate = normalizePolicyMatchText(row.placa)
  const candidates = policyVehicleCandidates(client)

  if (rowPlate) {
    const plateMatch = candidates.find(vehicle => normalizePolicyMatchText(vehicle.placa) === rowPlate)
    if (plateMatch) return plateMatch
  }
  if (!rowModel) return null

  const exact = candidates.filter(vehicle => normalizePolicyMatchText(vehicle.modelo_veiculo) === rowModel)
  if (exact.length === 1) return exact[0]
  const close = candidates.filter(vehicle => {
    const model = normalizePolicyMatchText(vehicle.modelo_veiculo)
    return model && (model.includes(rowModel) || rowModel.includes(model))
  })
  return close.length === 1 ? close[0] : null
}
