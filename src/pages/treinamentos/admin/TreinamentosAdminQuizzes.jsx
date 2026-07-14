import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA } from '../../../lib/training'
import { getChildrenByType } from '../../../lib/trainingProgression'
import { PageHeader, Card, Badge, EmptyState } from '../../../components/ui'

function countByStatus(quiz = []) {
  const ativa = quiz.filter(q => q?.status === 'ativa').length
  const sugerida = quiz.filter(q => q?.status !== 'ativa').length
  return { ativa, sugerida, total: quiz.length }
}

export default function TreinamentosAdminQuizzes() {
  const { profile } = useAuth()
  const funcionarioId = profile?.id

  const { data, isLoading } = useQuery({
    queryKey: trainingQueryKey(TRAINING_PRODUTO_FIANCA, funcionarioId),
    queryFn: async () => {
      const [nodes, progressRows] = await Promise.all([
        fetchTrainingTree(TRAINING_PRODUTO_FIANCA),
        fetchTrainingProgress(funcionarioId),
      ])
      return { nodes, progressRows }
    },
    enabled: Boolean(funcionarioId),
  })

  if (isLoading || !data) {
    return <PageHeader eyebrow="Treinamentos · Admin" title="Gerenciar Quiz" description="Carregando..." />
  }

  const { nodes } = data
  const produtoNode = nodes.find(n => n.tipo === 'produto' && n.produto === TRAINING_PRODUTO_FIANCA)

  if (!produtoNode) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader eyebrow="Treinamentos · Admin" title="Gerenciar Quiz" />
        <EmptyState icon={<ClipboardList className="w-6 h-6" />} title="Currículo ainda não publicado" description="Nenhum setor semeado para este produto." />
      </div>
    )
  }

  const setores = getChildrenByType(nodes, produtoNode.id, 'setor')

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Treinamentos · Admin"
        title="Gerenciar Quiz"
        description="Escolha, dentre as perguntas sugeridas, quais ficam ativas e visíveis para os funcionários em cada quiz."
      />

      {setores.map(setor => {
        const modulos = getChildrenByType(nodes, setor.id, 'modulo')
        const quizNodes = [
          ...modulos
            .map(modulo => nodes.find(n => n.parent_id === modulo.id && n.tipo === 'licao' && n.eh_quiz_modulo))
            .filter(Boolean),
          nodes.find(n => n.parent_id === setor.id && n.tipo === 'licao' && n.eh_quiz_final_setor),
        ].filter(Boolean)

        if (quizNodes.length === 0) return null

        return (
          <div key={setor.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted mb-3">{setor.titulo}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {quizNodes.map(quizNode => {
                const { ativa, sugerida, total } = countByStatus(quizNode.conteudo?.quiz)
                return (
                  <Link key={quizNode.id} to={`/treinamentos/admin/quiz/${quizNode.id}`}>
                    <Card hoverable padding="lg" className="h-full flex flex-col gap-3">
                      <p className="text-sm font-semibold text-dark-text leading-snug">{quizNode.titulo}</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="success">{ativa} ativa{ativa !== 1 ? 's' : ''}</Badge>
                        <Badge variant="muted">{sugerida} sugerida{sugerida !== 1 ? 's' : ''}</Badge>
                      </div>
                      <p className="text-[11px] text-dark-muted mt-auto">{total} pergunta{total !== 1 ? 's' : ''} no banco</p>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
