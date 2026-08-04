import { addMeses, parseYmd, primeiroDiaMes } from './financeiroCalc.js'

const STATUS_ATIVOS = new Set(['ativa', 'ativo', 'renovada', 'renovado', 'vigente'])
const STATUS_INATIVOS = new Set(['cancelada', 'cancelado', 'expirada', 'expirado', 'encerrada', 'encerrado', 'inativa', 'inativo'])

export function statusApoliceNormalizado(status) {
  return String(status || '').trim().toLowerCase()
}

function limitesDoMes(referencia) {
  const inicioMes = primeiroDiaMes(referencia)
  const inicio = parseYmd(inicioMes)
  const proximo = parseYmd(addMeses(inicioMes, 1))
  if (!inicio || !proximo) return null
  const fim = new Date(proximo.getFullYear(), proximo.getMonth(), 0)
  return { inicio, fim }
}

export function apoliceAtivaNoMes(row, referencia) {
  const limites = limitesDoMes(referencia)
  if (!limites) return false

  const status = statusApoliceNormalizado(row?.status_apolice)
  if (STATUS_INATIVOS.has(status)) return false

  const inicioVigencia = parseYmd(row?.inicio_vigencia)
  const fimVigencia = parseYmd(row?.fim_vigencia)
  if (inicioVigencia && inicioVigencia > limites.fim) return false
  if (fimVigencia && fimVigencia < limites.inicio) return false

  if (STATUS_ATIVOS.has(status)) return true
  return true
}

export function apoliceAtivaHoje(row) {
  return apoliceAtivaNoMes(row, new Date())
}
