// Funções puras de cálculo do módulo Auto.
// Sem imports de Supabase/Vite → unit-testáveis com `node --test`.

export function calcularValorComissaoAuto(premioLiquido, pctComissao) {
  const premio = parseFloat(premioLiquido) || 0
  const pct = parseFloat(pctComissao) || 0
  return premio * (pct / 100) * 0.9
}
