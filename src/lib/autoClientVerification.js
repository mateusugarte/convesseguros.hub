function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeClientVerificationName(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:da|das|de|do|dos|e)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function clientVerificationPairKey(firstId, secondId) {
  return [String(firstId || ''), String(secondId || '')].sort().join(':')
}

function levenshteinDistance(left, right) {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[right.length]
}

function tokenDice(left, right) {
  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  if (!leftTokens.size || !rightTokens.size) return 0
  let intersection = 0
  leftTokens.forEach(token => { if (rightTokens.has(token)) intersection += 1 })
  return (2 * intersection) / (leftTokens.size + rightTokens.size)
}

export function clientNameSimilarity(firstName, secondName) {
  const left = normalizeClientVerificationName(firstName)
  const right = normalizeClientVerificationName(secondName)
  if (!left || !right) return 0
  if (left === right) return 1

  const maxLength = Math.max(left.length, right.length)
  const characterScore = 1 - (levenshteinDistance(left, right) / maxLength)
  const tokenScore = tokenDice(left, right)
  const leftTokens = left.split(' ')
  const rightTokens = right.split(' ')
  const sameFirst = leftTokens[0] === rightTokens[0]
  const sameLast = leftTokens.at(-1) === rightTokens.at(-1)
  const structureBonus = sameFirst && sameLast ? 0.08 : sameFirst || sameLast ? 0.025 : 0

  return Math.min(1, Math.max(characterScore, (tokenScore * 0.66) + (characterScore * 0.34) + structureBonus))
}

export function buildClientVerificationPairs(clients = [], decisions = [], threshold = 0.72) {
  const decisionByPair = new Map(decisions.map(item => [
    clientVerificationPairKey(item.cliente_a_id, item.cliente_b_id),
    item,
  ]))
  const normalized = clients
    .map(client => ({ client, name: normalizeClientVerificationName(client?.nome_completo) }))
    .filter(item => item.client?.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const pairs = []

  for (let index = 0; index < normalized.length; index += 1) {
    const left = normalized[index]
    for (let next = index + 1; next < normalized.length; next += 1) {
      const right = normalized[next]
      if (left.name[0] !== right.name[0]) break
      const longest = Math.max(left.name.length, right.name.length)
      if (Math.abs(left.name.length - right.name.length) > Math.max(6, Math.ceil(longest * 0.35))) continue
      const score = clientNameSimilarity(left.name, right.name)
      if (score < threshold) continue
      const key = clientVerificationPairKey(left.client.id, right.client.id)
      pairs.push({
        key,
        clienteA: left.client,
        clienteB: right.client,
        score,
        tipoCorrespondencia: score === 1 ? 'nome_igual' : 'nome_parecido',
        verificacao: decisionByPair.get(key) || null,
      })
    }
  }

  return pairs.sort((a, b) => {
    const pendingDifference = Number(Boolean(a.verificacao)) - Number(Boolean(b.verificacao))
    return pendingDifference || b.score - a.score || a.key.localeCompare(b.key)
  })
}
