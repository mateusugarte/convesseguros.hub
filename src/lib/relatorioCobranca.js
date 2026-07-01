export function buildAprovadaPatch(ficha) {
  return {
    status: 'aprovado',
    retorno_enviado: false,
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      retorno_enviado_em: null,
      cobranca_started_at: null,
    },
  }
}

export function buildCobrancaPatch(ficha, sentAt = new Date().toISOString()) {
  return {
    status: 'aprovado',
    retorno_enviado: true,
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      retorno_enviado_em: sentAt,
      cobranca_started_at: sentAt,
    },
  }
}

export function buildImobiliariaRetornoPatch(ficha, retornou, at = new Date().toISOString()) {
  return {
    raw_data: {
      ...(ficha?.raw_data || {}),
      imobiliaria_retornou: retornou,
      imobiliaria_retornou_em: retornou ? at : null,
    },
  }
}

export function buildCobrancaHistoricoPatch(ficha, enviada, at = new Date().toISOString()) {
  return {
    raw_data: {
      ...(ficha?.raw_data || {}),
      cobranca_started_at: enviada ? at : null,
      retorno_enviado_em: enviada ? at : null,
    },
  }
}

export function isCobrancaEnviadaVisivel(colunaId) {
  return colunaId === 'enviado_cobranca' || colunaId === 'recuperados'
}

export function getCobrancaEnviadaDisplay(ficha, colunaId) {
  if (colunaId === 'recuperados') {
    return Boolean(ficha?.raw_data?.cobranca_started_at || ficha?.raw_data?.retorno_enviado_em)
  }
  return Boolean(ficha?.retorno_enviado)
}

export function getImobiliariaRetornouDisplay(ficha) {
  return Boolean(ficha?.raw_data?.imobiliaria_retornou)
}
