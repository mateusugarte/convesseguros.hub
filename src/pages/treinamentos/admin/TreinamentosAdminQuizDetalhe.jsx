import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { useToast } from '../../../contexts/ToastContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA, updateQuizQuestions } from '../../../lib/training'
import { PageHeader, Card, Button, Badge, EmptyState, Input, Textarea } from '../../../components/ui'

function QuestionCard({ question, index, onChange, onRemove }) {
  const isAtiva = question.status === 'ativa'

  function updateField(field, value) {
    onChange({ ...question, [field]: value })
  }

  function updateOpcao(opcaoId, texto) {
    onChange({ ...question, opcoes: question.opcoes.map(o => (o.id === opcaoId ? { ...o, texto } : o)) })
  }

  return (
    <Card padding="lg" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-dark-muted">Pergunta {index + 1}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={isAtiva ? 'success' : 'muted'}>{isAtiva ? 'Ativa' : 'Sugerida'}</Badge>
          <Button
            variant={isAtiva ? 'secondary' : 'primary'}
            size="sm"
            iconLeft={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => updateField('status', isAtiva ? 'sugerida' : 'ativa')}
          >
            {isAtiva ? 'Desativar' : 'Ativar'}
          </Button>
          <Button variant="destructive" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />} onClick={onRemove}>
            Remover
          </Button>
        </div>
      </div>

      <Textarea
        label="Enunciado"
        value={question.pergunta}
        onChange={e => updateField('pergunta', e.target.value)}
        rows={2}
      />

      <div className="space-y-2">
        {question.opcoes.map(opcao => (
          <div key={opcao.id} className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-dark-muted flex-shrink-0 w-16">
              <input
                type="radio"
                name={`correta-${question.id}`}
                checked={question.respostaCorreta === opcao.id}
                onChange={() => updateField('respostaCorreta', opcao.id)}
                className="accent-brand-accent"
              />
              {opcao.id}) correta
            </label>
            <Input className="flex-1" value={opcao.texto} onChange={e => updateOpcao(opcao.id, e.target.value)} />
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function TreinamentosAdminQuizDetalhe() {
  const { nodeId } = useParams()
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

  const quizNode = data?.nodes.find(n => n.id === nodeId)
  const [quiz, setQuiz] = useState(() => quizNode?.conteudo?.quiz || [])

  useEffect(() => {
    if (quizNode) setQuiz(quizNode.conteudo?.quiz || [])
  }, [quizNode?.id])

  const mutation = useMutation({
    mutationFn: () => updateQuizQuestions({ nodeId, quiz }),
    onSuccess: () => {
      toast({ type: 'success', title: 'Quiz atualizado' })
      queryClient.invalidateQueries({ queryKey })
    },
    onError: error => toast({ type: 'error', title: 'Erro ao salvar', message: error.message }),
  })

  if (isLoading || !data) {
    return <PageHeader eyebrow="Treinamentos · Admin" title="Carregando..." />
  }

  if (!quizNode) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader eyebrow="Treinamentos · Admin" title="Quiz não encontrado" />
        <EmptyState title="Quiz não encontrado" description="Verifique o link ou volte para a lista de quizzes." />
      </div>
    )
  }

  const ativaCount = quiz.filter(q => q.status === 'ativa').length

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/treinamentos/admin" className="inline-flex items-center gap-1.5 text-xs font-semibold text-dark-muted hover:text-dark-text">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Gerenciar Quiz
      </Link>

      <PageHeader
        eyebrow="Treinamentos · Admin"
        title={quizNode.titulo}
        description={`${ativaCount} de ${quiz.length} perguntas ativas — só as ativas aparecem para o funcionário.`}
      />

      {quiz.length === 0 ? (
        <EmptyState title="Nenhuma pergunta neste quiz" description="Gere e rode a seed de perguntas (supabase/53_treinamentos_quiz_perguntas.sql) para popular este banco." />
      ) : (
        <div className="space-y-3">
          {quiz.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              onChange={updated => setQuiz(prev => prev.map(q => (q.id === updated.id ? updated : q)))}
              onRemove={() => setQuiz(prev => prev.filter(q => q.id !== question.id))}
            />
          ))}
        </div>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Salvar alterações
        </Button>
      </div>
    </div>
  )
}
