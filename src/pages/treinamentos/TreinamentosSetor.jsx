import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Lock, CheckCircle2, PlayCircle, ListChecks } from 'lucide-react'
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
    <Card hoverable={unlocked} padding="lg" className={`training-path-row flex items-center gap-4 ${unlocked ? '' : 'is-locked'}`}>
      <div className="training-path-step">
        {status === 'concluido' ? <CheckCircle2 className="w-5 h-5" /> : unlocked ? <PlayCircle className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">Modulo {index + 1}</p>
        <p className="text-sm font-semibold text-dark-text truncate">{modulo.titulo}</p>
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
      <div className="training-page space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Setor nao encontrado" description="Verifique o link ou volte para a pagina de Treinamentos." />
      </div>
    )
  }

  const modulos = getChildrenByType(nodes, setor.id, 'modulo')
  const setorQuiz = getSetorQuizNode(nodes, setor.id)
  const setorQuizUnlocked = isSetorQuizUnlocked({ nodes, setorId: setor.id, progressMap })
  const setorQuizStatus = setorQuiz ? getNodeProgressStatus(setorQuiz.id, progressMap) : null
  const modulosConcluidos = modulos.filter(modulo => isModuloConcluded({ modulo, nodes, progressMap })).length
  const pct = modulos.length ? Math.round((modulosConcluidos / modulos.length) * 100) : 0

  return (
    <div className="training-page space-y-6 animate-fade-in">
      <TrainingBreadcrumb setor={setor} />
      <section className="training-detail-hero">
        <div>
          <p className="training-kicker training-kicker-soft">Setor</p>
          <h1>{setor.titulo}</h1>
          <p>{modulos.length} modulo{modulos.length !== 1 ? 's' : ''}. Conclua o quiz de cada modulo para destravar o proximo.</p>
        </div>
        <div className="training-detail-meter">
          <strong>{pct}%</strong>
          <span>{modulosConcluidos}/{modulos.length} modulos</span>
        </div>
      </section>

      <div className="training-path-list">
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
          <div className="training-section-head compact">
            <div>
              <p className="training-kicker training-kicker-soft">Avaliacao</p>
              <h2>Quiz final do setor</h2>
            </div>
          </div>
          {setorQuizUnlocked ? (
            <Link to={`/treinamentos/licoes/${setorQuiz.id}`}>
              <Card hoverable padding="lg" className="training-quiz-card flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="training-quiz-icon"><ListChecks className="w-4 h-4" /></div>
                  <p className="text-sm font-semibold text-dark-text truncate">{setorQuiz.titulo}</p>
                </div>
                <TrainingStatusBadge status={setorQuizStatus} />
              </Card>
            </Link>
          ) : (
            <Card padding="lg" className="training-quiz-card is-locked flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="training-quiz-icon"><Lock className="w-4 h-4" /></div>
                <p className="text-sm font-semibold text-dark-text truncate">{setorQuiz.titulo}</p>
              </div>
              <TrainingStatusBadge status={setorQuizStatus} locked />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
