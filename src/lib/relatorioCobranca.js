export function buildAprovadaPatch(ficha) {
  return {
    status: 'aprovado',
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      cobranca_started_at: null,
      imobiliaria_retornou: false,
      imobiliaria_retornou_em: null,
      manually_expired: false,
      manually_expired_em: null,
    },
  }
}

export function buildCobrancaPatch(ficha, sentAt = new Date().toISOString()) {
  return {
    status: 'aprovado',
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      cobranca_started_at: sentAt,
      imobiliaria_retornou: false,
      imobiliaria_retornou_em: null,
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
    },
  }
}

export function buildRelatorioMovePatch(ficha, colunaId, at = new Date().toISOString()) {
  if (colunaId === 'aprovada') return buildAprovadaPatch(ficha)
  if (colunaId === 'enviado_cobranca') return buildCobrancaPatch(ficha, at)
  if (colunaId === 'expirada') {
    // Marca a expiracao em raw_data (nao no status real da ficha): o status
    // permanece 'aprovado'/'emitido' para que a ficha continue sendo buscada
    // pelas queries do relatorio (REPORT_STATUSES). "Expirada" aqui e apenas
    // um estado de exibicao, igual ao calculo por idade ja existente.
    return {
      raw_data: {
        ...(ficha?.raw_data || {}),
        recovered_after_cobranca: false,
        recovered_after_cobranca_em: null,
        cobranca_started_at: null,
        imobiliaria_retornou: false,
        imobiliaria_retornou_em: null,
        manually_expired: true,
        manually_expired_em: at,
      },
    }
  }

  return null
}

export function isCobrancaEnviadaVisivel(colunaId) {
  return colunaId === 'enviado_cobranca' || colunaId === 'recuperados'
}

export function getCobrancaEnviadaDisplay(ficha, colunaId) {
  if (colunaId === 'recuperados') return Boolean(ficha?.raw_data?.cobranca_started_at)
  return Boolean(ficha?.raw_data?.cobranca_started_at)
}

export function getImobiliariaRetornouDisplay(ficha) {
  return Boolean(ficha?.raw_data?.imobiliaria_retornou)
}


