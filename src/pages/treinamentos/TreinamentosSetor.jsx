import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Lock, CheckCircle2, PlayCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA } from '../../lib/training'
import {
  getChildrenByType,
  buildProgressMap,
  isModuloUnlocked,
  isModuloConcluded,
  getSetorQuizNode,
  isSetorQuizUnlocked,
  getNodeProgressStatus,
} from '../../lib/trainingProgression'
import { PageHeader, Card, EmptyState } from '../../components/ui'
import TrainingStatusBadge from '../../components/treinamentos/TrainingStatusBadge'
import TrainingBreadcrumb from '../../components/treinamentos/TrainingBreadcrumb'

function ModuloRow({ modulo, unlocked, status, index }) {
  const content = (
    <Card hoverable={unlocked} padding="lg" className={`flex items-center gap-4 ${unlocked ? '' : 'opacity-60'}`}>
      <div className="w-9 h-9 rounded-full bg-dark-surface2 flex items-center justify-center flex-shrink-0 text-xs font-bold text-dark-muted">
        {status === 'concluido' ? <CheckCircle2 className="w-5 h-5 text-status-success" /> : unlocked ? <PlayCircle className="w-5 h-5 text-status-info" /> : <Lock className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-dark-text truncate">{index + 1}. {modulo.titulo}</p>
      </div>
      <TrainingStatusBadge status={status} locked={!unlocked} />
    </Card>
  )

  if (!unlocked) return <div key={modulo.id}>{content}</div>
  return <Link key={modulo.id} to={`/treinamentos/modulos/${modulo.id}`}>{content}</Link>
}

export default function TreinamentosSetor() {
  const { setorId } = useParams()
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
    return <PageHeader eyebrow="Aprendizado" title="Carregando..." />
  }

  const { nodes, progressRows } = data
  const progressMap = buildProgressMap(progressRows)
  const setor = nodes.find(n => n.id === setorId && n.tipo === 'setor')

  if (!setor) {
    return (
      <div className="space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Setor não encontrado" description="Verifique o link ou volte para a página de Treinamentos." />
      </div>
    )
  }

  const modulos = getChildrenByType(nodes, setor.id, 'modulo')
  const setorQuiz = getSetorQuizNode(nodes, setor.id)
  const setorQuizUnlocked = isSetorQuizUnlocked({ nodes, setorId: setor.id, progressMap })
  const setorQuizStatus = setorQuiz ? getNodeProgressStatus(setorQuiz.id, progressMap) : null

  return (
    <div className="space-y-5 animate-fade-in">
      <TrainingBreadcrumb setor={setor} />
      <PageHeader eyebrow="Setor" title={setor.titulo} description={`${modulos.length} módulo${modulos.length !== 1 ? 's' : ''} — conclua o quiz de cada módulo para destravar o próximo.`} />

      <div className="space-y-3">
        {modulos.map((modulo, index) => {
          const unlocked = isModuloUnlocked({ modulo, siblingModulos: modulos, nodes, progressMap })
          const concluded = isModuloConcluded({ modulo, nodes, progressMap })
          return (
            <ModuloRow
              key={modulo.id}
              modulo={modulo}
              index={index}
              unlocked={unlocked}
              status={concluded ? 'concluido' : unlocked ? 'em_andamento' : 'nao_iniciado'}
            />
          )
        })}
      </div>

      {setorQuiz && (
        <div className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted mb-3">Avaliação final do setor</p>
          {setorQuizUnlocked ? (
            <Link to={`/treinamentos/licoes/${setorQuiz.id}`}>
              <Card hoverable padding="lg" className="flex items-center justify-between gap-4 border border-brand-gold/30">
                <p className="text-sm font-semibold text-dark-text">{setorQuiz.titulo}</p>
                <TrainingStatusBadge status={setorQuizStatus} />
              </Card>
            </Link>
          ) : (
            <Card padding="lg" className="flex items-center justify-between gap-4 opacity-60">
              <p className="text-sm font-semibold text-dark-text">{setorQuiz.titulo}</p>
              <TrainingStatusBadge status={setorQuizStatus} locked />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
