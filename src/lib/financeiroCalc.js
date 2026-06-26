// Helpers puros do módulo financeiro.
// Sem imports de Supabase/Vite → unit-testáveis com `node --test`.
import { parseDecimalBR } from './numberInput.js'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Converte string BR/number → number (0 quando inválido).
export function toNumber(value) {
  const n = parseDecimalBR(value)
  return Number.isFinite(n) ? n : 0
}

export function pad2(value) {
  return String(value).padStart(2, '0')
}

// 'YYYY-MM-DD' ou Date → Date local à meia-noite; null se inválido.
export function parseYmd(value) {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Primeiro dia do mês → 'YYYY-MM-01'
export function primeiroDiaMes(value) {
  const d = parseYmd(value)
  if (!d) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

// Soma n meses a um ymd → 'YYYY-MM-01'
export function addMeses(value, n) {
  const d = parseYmd(value)
  if (!d) return null
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return `${r.getFullYear()}-${pad2(r.getMonth() + 1)}-01`
}

// 'YYYY-MM-DD' ou Date → 'Jul/2026'
export function formatMesAno(value) {
  const d = parseYmd(value)
  if (!d) return '—'
  return `${MESES_ABBR[d.getMonth()]}/${d.getFullYear()}`
}

// Agrupa recebimentos por mes_referencia (ordenado asc).
// rows: [{ mes_referencia, valor_previsto }]
export function somarPorMes(recebimentos) {
  const map = new Map()
  for (const r of recebimentos || []) {
    const mes = primeiroDiaMes(r.mes_referencia)
    if (!mes) continue
    const valor = Number(r.valor_previsto) || 0
    const cur = map.get(mes) || { mes, total: 0, parcelas: 0, label: formatMesAno(mes) }
    cur.total += valor
    cur.parcelas += 1
    map.set(mes, cur)
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

// Projeção de N meses a partir de `referencia` (inclusive), preenchendo meses vazios com 0.
export function projetarProximosMeses(recebimentos, { mesesAFrente = 6, referencia }) {
  const base = primeiroDiaMes(referencia)
  const porMes = new Map(somarPorMes(recebimentos).map(x => [x.mes, x]))
  const out = []
  for (let i = 0; i < mesesAFrente; i++) {
    const mes = addMeses(base, i)
    const found = porMes.get(mes)
    out.push({
      mes,
      label: formatMesAno(mes),
      total: found ? found.total : 0,
      parcelas: found ? found.parcelas : 0,
    })
  }
  return out
}

// ── Cálculo de comissão/produção por apólice (fonte: tabela `apolices`) ──
// Fórmula oficial: comissão total = % comissão × prêmio líquido; mensal = total ÷ parcelas.

// Normaliza percentual: 5 → 0.05; 0.05 → 0.05; 12,5 → 0.125.
export function pctNormalizado(pct) {
  const p = toNumber(pct)
  return p > 1 ? p / 100 : p
}

// Base de comissão: prêmio líquido, com fallback para prêmio total / valor de produção.
export function premioLiquidoApolice(row) {
  return toNumber(row?.premio_liquido) || toNumber(row?.premio_total) || toNumber(row?.valor_producao) || 0
}

// Número de parcelas (mínimo 1).
export function parcelasApolice(row) {
  return Math.max(1, toNumber(row?.parcelamento) || 1)
}

// Comissão total gerada pela apólice: % comissão × prêmio líquido.
// Fallback para valor_comissao já gravado quando o cálculo não é possível.
export function comissaoTotalApolice(row) {
  const calc = premioLiquidoApolice(row) * pctNormalizado(row?.pct_comissao)
  if (calc > 0) return calc
  return toNumber(row?.valor_comissao) || 0
}

// Comissão mensal estimada: comissão total ÷ nº de parcelas.
export function comissaoMensalApolice(row) {
  return comissaoTotalApolice(row) / parcelasApolice(row)
}

// Produção (prêmio total) da apólice, com fallback para parcela × parcelas.
export function producaoApolice(row) {
  return toNumber(row?.premio_total) || toNumber(row?.valor_producao) || (toNumber(row?.valor_parcela) * parcelasApolice(row)) || 0
}
