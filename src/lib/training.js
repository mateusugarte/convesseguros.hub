// Camada Supabase da feature TREINAMENTOS. Funções simples, colunas explícitas
// no .select(), erro sempre relançado para o chamador tratar (molde: src/lib/fichas.js).
// Lógica pura de desbloqueio/nota de corte fica em src/lib/trainingProgression.js.

import { supabase } from './supabase'
import { gradeQuiz } from './trainingProgression'

const NODE_COLUMNS = 'id, parent_id, tipo, produto, titulo, ordem, tipo_conteudo, tipo_conteudo_nota, conteudo, eh_quiz_modulo, eh_quiz_final_setor'
const PROGRESS_COLUMNS = 'id, funcionario_id, node_id, status, quiz_score, tentativas, concluido_em'

export const TRAINING_PRODUTO_FIANCA = 'seguro_fianca'

// Chave de query única para as 4 páginas de Treinamentos compartilharem o
// mesmo cache do TanStack Query (evita refetch redundante ao navegar entre
// dashboard → setor → módulo → lição).
export function trainingQueryKey(produto, funcionarioId) {
  return ['treinamentos', produto, funcionarioId || null]
}

export async function fetchTrainingTree(produto) {
  const { data, error } = await supabase
    .from('training_nodes')
    .select(NODE_COLUMNS)
    .eq('produto', produto)
    .order('ordem')
  if (error) throw error
  return data || []
}

// Atualiza a lista de perguntas de um nó de quiz (módulo ou final de setor) —
// usado pela tela de curadoria de admin (/treinamentos/admin). Substitui
// conteudo.quiz inteiro; RLS já restringe UPDATE em training_nodes a
// is_training_content_admin() (ver supabase/51_treinamentos_schema.sql).
export async function updateQuizQuestions({ nodeId, quiz }) {
  const { data: current, error: fetchError } = await supabase
    .from('training_nodes')
    .select('conteudo')
    .eq('id', nodeId)
    .single()
  if (fetchError) throw fetchError

  const { data, error } = await supabase
    .from('training_nodes')
    .update({ conteudo: { ...current.conteudo, quiz } })
    .eq('id', nodeId)
    .select(NODE_COLUMNS)
    .single()
  if (error) throw error
  return data
}

export async function fetchTrainingProgress(funcionarioId) {
  const { data, error } = await supabase
    .from('training_progress')
    .select(PROGRESS_COLUMNS)
    .eq('funcionario_id', funcionarioId)
  if (error) throw error
  return data || []
}

export async function upsertLicaoProgress({ funcionarioId, nodeId, status, concluidoEm = null }) {
  const { data, error } = await supabase
    .from('training_progress')
    .upsert(
      {
        funcionario_id: funcionarioId,
        node_id: nodeId,
        status,
        concluido_em: concluidoEm,
      },
      { onConflict: 'funcionario_id,node_id' }
    )
    .select(PROGRESS_COLUMNS)
    .single()
  if (error) throw error
  return data
}

// Corrige o quiz (função pura gradeQuiz) e faz upsert do resultado, incrementando
// `tentativas` a partir da tentativa atual (leitura seguida de upsert — aceitável
// aqui: submissão de quiz é ação de um único usuário, de baixa frequência, não
// justifica uma função SECURITY DEFINER só para evitar a corrida teórica).
export async function submitQuizAttempt({ funcionarioId, nodeId, questions, answers }) {
  const resultado = gradeQuiz({ questions, answers })

  const { data: existente, error: fetchError } = await supabase
    .from('training_progress')
    .select('tentativas')
    .eq('funcionario_id', funcionarioId)
    .eq('node_id', nodeId)
    .maybeSingle()
  if (fetchError) throw fetchError

  const tentativas = (existente?.tentativas || 0) + 1
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('training_progress')
    .upsert(
      {
        funcionario_id: funcionarioId,
        node_id: nodeId,
        status: resultado.passed ? 'concluido' : 'em_andamento',
        quiz_score: resultado.scorePct,
        tentativas,
        concluido_em: resultado.passed ? nowIso : null,
      },
      { onConflict: 'funcionario_id,node_id' }
    )
    .select(PROGRESS_COLUMNS)
    .single()
  if (error) throw error

  return { progress: data, resultado }
}
