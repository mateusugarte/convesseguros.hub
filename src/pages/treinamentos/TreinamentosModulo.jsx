import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Lock, CheckCircle2, PlayCircle, ListChecks, FileText } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA } from '../../lib/training'
import {
  getChildrenByType,
  buildProgressMap,
  isLicaoUnlocked,
  getNodeProgressStatus,
} from '../../lib/trainingProgression'
import { PageHeader, Card, EmptyState } from '../../components/ui'
import TrainingStatusBadge from '../../components/treinamentos/TrainingStatusBadge'
import TrainingBreadcrumb from '../../components/treinamentos/TrainingBreadcrumb'

function LicaoRow({ licao, unlocked, status, index }) {
  const isQuiz = licao.eh_quiz_modulo || licao.eh_quiz_final_setor
  const content = (
    <Card hoverable={unlocked} padding="lg" className={`training-path-row flex items-center gap-4 ${unlocked ? '' : 'is-locked'} ${isQuiz ? 'is-quiz' : ''}`}>
      <div className="training-path-step">
        {status === 'concluido'
          ? <CheckCircle2 className="w-5 h-5" />
          : !unlocked
            ? <Lock className="w-4 h-4" />
            : isQuiz
              ? <ListChecks className="w-4 h-4" />
              : <PlayCircle className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1">{isQuiz ? 'Quiz' : (licao.tipo_conteudo || `Licao ${index + 1}`)}</p>
        <p className="text-sm font-semibold text-dark-text truncate">{isQuiz ? licao.titulo : `${index + 1}. ${licao.titulo}`}</p>
      </div>
      <TrainingStatusBadge status={status} locked={!unlocked} />
    </Card>
  )

  if (!unlocked) return <div key={licao.id}>{content}</div>
  return <Link key={licao.id} to={`/treinamentos/licoes/${licao.id}`}>{content}</Link>
}

export default function TreinamentosModulo() {
  const { moduloId } = useParams()
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
  const modulo = nodes.find(n => n.id === moduloId && n.tipo === 'modulo')

  if (!modulo) {
    return (
      <div className="training-page space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Modulo nao encontrado" description="Verifique o link ou volte para a pagina de Treinamentos." />
      </div>
    )
  }

  const setor = nodes.find(n => n.id === modulo.parent_id)
  const licoes = getChildrenByType(nodes, modulo.id, 'licao')
  const concluidas = licoes.filter(licao => getNodeProgressStatus(licao.id, progressMap) === 'concluido').length
  const pct = licoes.length ? Math.round((concluidas / licoes.length) * 100) : 0

  return (
    <div className="training-page space-y-6 animate-fade-in">
      <TrainingBreadcrumb setor={setor} modulo={modulo} />
      <section className="training-detail-hero">
        <div>
          <p className="training-kicker training-kicker-soft">Modulo</p>
          <h1>{modulo.titulo}</h1>
          <p>{licoes.length} etapa{licoes.length !== 1 ? 's' : ''}. Conclua em ordem; o quiz do modulo e a ultima etapa.</p>
        </div>
        <div className="training-detail-meter">
          <FileText className="w-5 h-5" />
          <strong>{pct}%</strong>
          <span>{concluidas}/{licoes.length} etapas</span>
        </div>
      </section>

      <div className="training-path-list">
        {licoes.map((licao, index) => {
          const unlocked = isLicaoUnlocked({ licao, siblingLicoes: licoes, progressMap })
          const status = getNodeProgressStatus(licao.id, progressMap)
          return <LicaoRow key={licao.id} licao={licao} index={index} unlocked={unlocked} status={status} />
        })}
      </div>
    </div>
  )
}
