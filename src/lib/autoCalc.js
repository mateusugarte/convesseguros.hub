// Funções puras de cálculo do módulo Auto.
// Sem imports de Supabase/Vite → unit-testáveis com `node --test`.

export function calcularValorComissaoAuto(premioLiquido, pctComissao) {
  const premio = parseFloat(premioLiquido) || 0
  const pct = parseFloat(pctComissao) || 0
  return premio * (pct / 100)
}

// Valida estritamente 'YYYY-MM-DD' com data de calendario real (rejeita mes
// 13, dia 31 de abril etc.) — usado para nao aceitar valores parciais/invalidos
// que o input nativo de data pode emitir enquanto o usuario ainda esta digitando.
export function isValidIsoDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, ano, mes, dia] = match.map(Number)
  // Ano minimo de 1900: o input nativo de tipo date dispara onChange a cada
  // digito do ano (1 -> 0001, 12 -> 0012, 120 -> 0120, 1202 -> 1202...), e o
  // construtor `new Date(ano, mes, dia)` so trata 0-99 como "ano relativo a
  // 1900" — um ano parcial de 3 digitos (ex. 120) passa incolume no check de
  // round-trip abaixo mesmo sendo um estado transitorio, nao uma data real.
  if (ano < 1900 || ano > 2200) return false
  const date = new Date(ano, mes - 1, dia)
  return date.getFullYear() === ano && date.getMonth() === mes - 1 && date.getDate() === dia
}

// Subtrai N dias uteis (pula sabado/domingo; sem calendario de feriados) de
// uma data 'YYYY-MM-DD'.
export function subtrairDiasUteis(value, diasUteis) {
  if (!isValidIsoDate(value)) return null
  const [ano, mes, dia] = value.split('-').map(Number)
  const date = new Date(ano, mes - 1, dia)
  let restantes = diasUteis
  while (restantes > 0) {
    date.setDate(date.getDate() - 1)
    if (date.getDay() !== 0 && date.getDay() !== 6) restantes -= 1
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Subtrai dias corridos e, quando o resultado cai no fim de semana, leva o
// prazo para o dia util operacional mais proximo: sabado -> sexta e
// domingo -> segunda. Nao considera feriados.
export function subtrairDiasCorridosComAjuste(value, diasCorridos) {
  if (!isValidIsoDate(value)) return null
  const [ano, mes, dia] = value.split('-').map(Number)
  const date = new Date(ano, mes - 1, dia)
  date.setDate(date.getDate() - Math.max(0, Number(diasCorridos) || 0))

  if (date.getDay() === 6) date.setDate(date.getDate() - 1)
  if (date.getDay() === 0) date.setDate(date.getDate() + 1)

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const PRAZO_RENOVACAO_DIAS_CORRIDOS = 10

// Regra unica para toda entrada/edicao de renovacao. Centralizar o prazo aqui
// evita que planilha, importacao e trigger acabem mostrando datas diferentes.
export function calcularDataLimiteRenovacao(vigenciaFim) {
  return subtrairDiasCorridosComAjuste(vigenciaFim, PRAZO_RENOVACAO_DIAS_CORRIDOS)
}
