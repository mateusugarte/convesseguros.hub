import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { CheckCircle2, HelpCircle, ListChecks, BookOpen } from 'lucide-react'
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
    <div className="training-rich-text">
      {blocks.map((block, i) => (
        block.type === 'ul'
          ? (
            <ul key={i}>
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
      if (r.passed) toast({ type: 'success', title: 'Quiz concluido!', message: `Nota ${r.scorePct}%` })
      else toast({ type: 'error', title: 'Nao atingiu a nota de corte', message: `Nota ${r.scorePct}% - minimo ${QUIZ_PASSING_SCORE_PCT}%` })
      onDone()
    },
    onError: (error) => toast({ type: 'error', title: 'Erro ao enviar o quiz', message: error.message }),
  })

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle className="w-6 h-6" />}
        title="Quiz ainda nao disponivel"
        description="As perguntas de avaliacao deste quiz ainda nao foram escritas. A licao fica marcada como pendente ate o conteudo de avaliacao ser adicionado."
      />
    )
  }

  const allAnswered = questions.every(q => answers[q.id] !== undefined)

  return (
    <div className="training-quiz-form">
      {questions.map((question, index) => (
        <Card key={question.id} padding="lg" className="training-question-card">
          <div className="training-question-head">
            <span>{index + 1}</span>
            <p>{question.pergunta}</p>
          </div>
          <div className="training-answer-list">
            {(question.opcoes || []).map(opcao => (
              <label key={opcao.id} className={`training-answer ${answers[question.id] === opcao.id ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === opcao.id}
                  onChange={() => setAnswers(prev => ({ ...prev, [question.id]: opcao.id }))}
                />
                <span>{opcao.texto}</span>
              </label>
            ))}
          </div>
        </Card>
      ))}

      {resultado && (
        <Card padding="lg" className={resultado.passed ? 'training-result-card is-pass' : 'training-result-card is-fail'}>
          <p>
            Nota: {resultado.scorePct}% ({resultado.correctCount}/{resultado.totalCount}) - {resultado.passed ? 'aprovado' : `abaixo da nota de corte de ${QUIZ_PASSING_SCORE_PCT}%`}
          </p>
        </Card>
      )}

      <div className="training-action-row">
        <Button
          variant="primary"
          disabled={!allAnswered}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Enviar respostas
        </Button>
      </div>
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
      toast({ type: 'success', title: 'Licao concluida!' })
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => toast({ type: 'error', title: 'Erro ao concluir licao', message: error.message }),
  })

  if (isLoading || !data) {
    return <PageHeader eyebrow="Aprendizado" title="Carregando..." />
  }

  const { nodes, progressRows } = data
  const progressMap = buildProgressMap(progressRows)
  const licao = nodes.find(n => n.id === licaoId && n.tipo === 'licao')

  if (!licao) {
    return (
      <div className="training-page space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Licao nao encontrada" description="Verifique o link ou volte para a pagina de Treinamentos." />
      </div>
    )
  }

  const modulo = nodes.find(n => n.id === licao.parent_id && n.tipo === 'modulo')
  const setor = modulo ? nodes.find(n => n.id === modulo.parent_id) : nodes.find(n => n.id === licao.parent_id && n.tipo === 'setor')
  const isQuiz = licao.eh_quiz_modulo || licao.eh_quiz_final_setor

  const siblingLicoes = modulo ? getChildrenByType(nodes, modulo.id, 'licao') : (licao.eh_quiz_final_setor ? getChildrenByType(nodes, setor?.id, 'licao') : [])
  const unlocked = licao.eh_quiz_final_setor
    ? true
    : isLicaoUnlocked({ licao, siblingLicoes, progressMap })
  const status = getNodeProgressStatus(licao.id, progressMap)

  return (
    <div className="training-page training-lesson-page space-y-6 animate-fade-in pb-20">
      <TrainingBreadcrumb setor={setor} modulo={isQuiz && !modulo ? null : modulo} licao={licao} />
      <section className="training-detail-hero training-lesson-hero">
        <div>
          <p className="training-kicker training-kicker-soft">{isQuiz ? 'Quiz' : (licao.tipo_conteudo || 'Licao')}</p>
          <h1>{licao.titulo}</h1>
          {licao.tipo_conteudo_nota && <p>{licao.tipo_conteudo_nota}</p>}
        </div>
        <div className="training-lesson-status">
          {isQuiz ? <ListChecks className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
          <TrainingStatusBadge status={status} locked={!unlocked} />
        </div>
      </section>

      {!unlocked ? (
        <EmptyState title="Licao trancada" description="Conclua as etapas anteriores deste modulo para desbloquear este conteudo." />
      ) : isQuiz ? (
        <QuizForm licao={licao} funcionarioId={funcionarioId} onDone={() => queryClient.invalidateQueries({ queryKey })} />
      ) : (
        <div className="training-content-layout">
          <div className="training-content-main">
            <Card padding="lg" className="training-content-card">
              <RichText text={licao.conteudo?.conteudo_geral} />
            </Card>

            {Array.isArray(licao.conteudo?.variacoes_por_seguradora) && licao.conteudo.variacoes_por_seguradora.length > 0 && (
              <div className="training-variation-list">
                <div className="training-section-head compact">
                  <div>
                    <p className="training-kicker training-kicker-soft">Referencia</p>
                    <h2>Variacoes por seguradora</h2>
                  </div>
                </div>
                {licao.conteudo.variacoes_por_seguradora.map((variacao, index) => (
                  <Card key={index} padding="lg" className="training-content-card training-variation-card">
                    {variacao.rotulo && <p className="training-variation-title">{variacao.rotulo}</p>}
                    <RichText text={variacao.texto} />
                  </Card>
                ))}
              </div>
            )}

            {licao.conteudo?.notas && (
              <Card padding="lg" className="training-note-card">
                <RichText text={licao.conteudo.notas} />
              </Card>
            )}
          </div>

          {status !== 'concluido' && (
            <aside className="training-complete-panel">
              <p>Finalize esta etapa para liberar o proximo item da trilha.</p>
              <Button variant="primary" iconLeft={<CheckCircle2 className="w-4 h-4" />} loading={concluirMutation.isPending} onClick={() => concluirMutation.mutate()}>
                Concluir licao
              </Button>
            </aside>
          )}
        </div>
      )}

      <TrainingChatButton licaoId={licao.id} produto={TRAINING_PRODUTO_FIANCA} seguradora={null} />
    </div>
  )
}
