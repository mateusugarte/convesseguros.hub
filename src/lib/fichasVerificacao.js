import { supabase } from './supabase'

const ENDPOINT = '/api/verificar-fichas'

async function chamar(payload) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Nao foi possivel validar sua sessao. Entre novamente.')
  }

  const resposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    throw new Error(corpo?.error || 'Nao foi possivel falar com o servico de verificacao.')
  }
  return corpo
}

/** Le a planilha de respostas e compara com as fichas do periodo. */
export function verificarFichas(dias = 30) {
  return chamar({ acao: 'verificar', dias })
}

/**
 * Reenvia as linhas escolhidas pelo webhook oficial do n8n.
 * Manda apenas referencias {fonte, linha} — o conteudo o servidor rele da
 * planilha, para nao existir caminho de gravar ficha com dado adulterado.
 */
export function importarFichasFaltantes(alvos, dias = 30) {
  return chamar({
    acao: 'importar',
    dias,
    linhas: alvos.map(a => ({ fonte: a.fonte, linha: a.linha })),
  })
}

export const MOTIVOS = {
  sem_ficha_no_sistema: 'Nenhuma ficha com este CPF no periodo',
  sem_cpf_e_sem_ficha: 'Resposta sem CPF e sem ficha equivalente',
  ficha_do_mesmo_cpf_em_outra_data: 'Existe ficha deste CPF, mas com data distante',
  respostas_repetidas_sem_ficha_equivalente: 'Mais respostas deste CPF do que fichas no sistema',
  sem_data_na_planilha: 'Linha sem carimbo de data',
}

export function descreverMotivo(motivo) {
  return MOTIVOS[motivo] || motivo || ''
}
