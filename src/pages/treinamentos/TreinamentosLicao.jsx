import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { CheckCircle2, HelpCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  fetchTrainingTree,
  fetchTrainingProgress,
  trainingQueryKey,
  TRAINING_PRODUTO_FIANCA,
  upsertLicaoProgress,
  submitQuizAttempt,
} from '../../lib/training'
import {
  getChildrenByType,
  buildProgressMap,
  isLicaoUnlocked,
  getNodeProgressStatus,
  QUIZ_PASSING_SCORE_PCT,
  getActiveQuizQuestions,
} from '../../lib/trainingProgression'
import { PageHeader, Card, Button, EmptyState } from '../../components/ui'
import TrainingStatusBadge from '../../components/treinamentos/TrainingStatusBadge'
import TrainingBreadcrumb from '../../components/treinamentos/TrainingBreadcrumb'
import TrainingChatButton from '../../components/treinamentos/TrainingChatButton'

function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ))
}

function RichText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let currentList = null

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (trimmed === '') {
      if (currentList) { blocks.push(currentList); currentList = null }
      continue
    }
    const bulletMatch = trimmed.match(/^-\s+(.*)$/)
    if (bulletMatch) {
      if (!currentList) currentList = { type: 'ul', items: [] }
      currentList.items.push(bulletMatch[1])
      continue
    }
    if (currentList) { blocks.push(currentList); currentList = null }
    blocks.push({ type: 'p', text: trimmed })
  }
  if (currentList) blocks.push(currentList)

  return (
    <div className="space-y-3 text-sm text-dark-text leading-relaxed">
      {blocks.map((block, i) => (
        block.type === 'ul'
          ? (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
            </ul>
          )
          : <p key={i}>{renderInline(block.text)}</p>
      ))}
    </div>
  )
}

function QuizForm({ licao, funcionarioId, onDone }) {
  const questions = getActiveQuizQuestions(licao.conteudo?.quiz)
  const [answers, setAnswers] = useState({})
  const [resultado, setResultado] = useState(null)
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: () => submitQuizAttempt({ funcionarioId, nodeId: licao.id, questions, answers }),
    onSuccess: ({ resultado: r }) => {
      setResultado(r)
      if (r.passed) toast({ type: 'success', title: 'Quiz concluído!', message: `Nota ${r.scorePct}%` })
      else toast({ type: 'error', title: 'Não atingiu a nota de corte', message: `Nota ${r.scorePct}% — mínimo ${QUIZ_PASSING_SCORE_PCT}%` })
      onDone()
    },
    onError: (error) => toast({ type: 'error', title: 'Erro ao enviar o quiz', message: error.message }),
  })

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle className="w-6 h-6" />}
        title="Quiz ainda não disponível"
        description="As perguntas de avaliação deste quiz ainda não foram escritas. A lição fica marcada como pendente até o conteúdo de avaliação ser adicionado — nada foi inventado nesta etapa."
      />
    )
  }

  const allAnswered = questions.every(q => answers[q.id] !== undefined)

  return (
    <div className="space-y-5">
      {questions.map((question, index) => (
        <Card key={question.id} padding="lg" className="space-y-3">
          <p className="text-sm font-semibold text-dark-text">{index + 1}. {question.pergunta}</p>
          <div className="space-y-2">
            {(question.opcoes || []).map(opcao => (
              <label key={opcao.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${answers[question.id] === opcao.id ? 'border-brand-accent bg-brand-accent/10 text-status-info' : 'border-dark-border text-dark-text hover:border-brand-accent/40'}`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === opcao.id}
                  onChange={() => setAnswers(prev => ({ ...prev, [question.id]: opcao.id }))}
                  className="accent-brand-accent"
                />
                {opcao.texto}
              </label>
            ))}
          </div>
        </Card>
      ))}

      {resultado && (
        <Card padding="lg" className={resultado.passed ? 'border border-status-success/40' : 'border border-status-danger/40'}>
          <p className="text-sm font-semibold text-dark-text">
            Nota: {resultado.scorePct}% ({resultado.correctCount}/{resultado.totalCount}) — {resultado.passed ? 'aprovado' : `abaixo da nota de corte de ${QUIZ_PASSING_SCORE_PCT}%`}
          </p>
        </Card>
      )}

      <Button
        variant="primary"
        disabled={!allAnswered}
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Enviar respostas
      </Button>
    </div>
  )
}

export default function TreinamentosLicao() {
  const { licaoId } = useParams()
  const { profile } = useAuth()
  const funcionarioId = profile?.id
  const toast = useToast()
  const queryClient = useQueryClient()
  const queryKey = trainingQueryKey(TRAINING_PRODUTO_FIANCA, funcionarioId)

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const [nodes, progressRows] = await Promise.all([
        fetchTrainingTree(TRAINING_PRODUTO_FIANCA),
        fetchTrainingProgress(funcionarioId),
      ])
      return { nodes, progressRows }
    },
    enabled: Boolean(funcionarioId),
  })

  const concluirMutation = useMutation({
    mutationFn: () => upsertLicaoProgress({ funcionarioId, nodeId: licaoId, status: 'concluido', concluidoEm: new Date().toISOString() }),
    onSuccess: () => {
      toast({ type: 'success', title: 'Lição concluída!' })
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => toast({ type: 'error', title: 'Erro ao concluir lição', message: error.message }),
  })

  if (isLoading || !data) {
    return <PageHeader eyebrow="Aprendizado" title="Carregando..." />
  }

  const { nodes, progressRows } = data
  const progressMap = buildProgressMap(progressRows)
  const licao = nodes.find(n => n.id === licaoId && n.tipo === 'licao')

  if (!licao) {
    return (
      <div className="space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Lição não encontrada" description="Verifique o link ou volte para a página de Treinamentos." />
      </div>
    )
  }

  const modulo = nodes.find(n => n.id === licao.parent_id && n.tipo === 'modulo')
  const setor = modulo ? nodes.find(n => n.id === modulo.parent_id) : nodes.find(n => n.id === licao.parent_id && n.tipo === 'setor')
  const isQuiz = licao.eh_quiz_modulo || licao.eh_quiz_final_setor

  const siblingLicoes = modulo ? getChildrenByType(nodes, modulo.id, 'licao') : (licao.eh_quiz_final_setor ? getChildrenByType(nodes, setor?.id, 'licao') : [])
  const unlocked = licao.eh_quiz_final_setor
    ? true // isSetorQuizUnlocked já é checado na página de setor antes de linkar aqui; evita duplicar a árvore de módulos aqui
    : isLicaoUnlocked({ licao, siblingLicoes, progressMap })
  const status = getNodeProgressStatus(licao.id, progressMap)

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <TrainingBreadcrumb setor={setor} modulo={isQuiz && !modulo ? null : modulo} licao={licao} />
      <PageHeader
        eyebrow={isQuiz ? 'Quiz' : (licao.tipo_conteudo || 'Lição')}
        title={licao.titulo}
        description={licao.tipo_conteudo_nota || undefined}
        actions={<TrainingStatusBadge status={status} locked={!unlocked} />}
      />

      {!unlocked ? (
        <EmptyState title="Lição trancada" description="Conclua as etapas anteriores deste módulo para desbloquear este conteúdo." />
      ) : isQuiz ? (
        <QuizForm licao={licao} funcionarioId={funcionarioId} onDone={() => queryClient.invalidateQueries({ queryKey })} />
      ) : (
        <div className="space-y-6">
          <Card padding="lg">
            <RichText text={licao.conteudo?.conteudo_geral} />
          </Card>

          {Array.isArray(licao.conteudo?.variacoes_por_seguradora) && licao.conteudo.variacoes_por_seguradora.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted">Variações por seguradora</p>
              {licao.conteudo.variacoes_por_seguradora.map((variacao, index) => (
                <Card key={index} padding="lg">
                  {variacao.rotulo && <p className="text-sm font-semibold text-status-info mb-1.5">{variacao.rotulo}</p>}
                  <RichText text={variacao.texto} />
                </Card>
              ))}
            </div>
          )}

          {licao.conteudo?.notas && (
            <Card padding="lg" className="border border-brand-gold/25">
              <RichText text={licao.conteudo.notas} />
            </Card>
          )}

          {status !== 'concluido' && (
            <Button variant="primary" iconLeft={<CheckCircle2 className="w-4 h-4" />} loading={concluirMutation.isPending} onClick={() => concluirMutation.mutate()}>
              Concluir lição
            </Button>
          )}
        </div>
      )}

      <TrainingChatButton licaoId={licao.id} produto={TRAINING_PRODUTO_FIANCA} seguradora={null} />
    </div>
  )
}
