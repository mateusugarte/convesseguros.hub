import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Lock, CheckCircle2, PlayCircle, ListChecks } from 'lucide-react'
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
    <Card hoverable={unlocked} padding="lg" className={`flex items-center gap-4 ${unlocked ? '' : 'opacity-60'} ${isQuiz ? 'border border-brand-gold/30' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-dark-surface2 flex items-center justify-center flex-shrink-0">
        {status === 'concluido'
          ? <CheckCircle2 className="w-5 h-5 text-status-success" />
          : !unlocked
            ? <Lock className="w-4 h-4 text-dark-muted" />
            : isQuiz
              ? <ListChecks className="w-4 h-4 text-brand-gold" />
              : <PlayCircle className="w-5 h-5 text-status-info" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-dark-text truncate">{isQuiz ? licao.titulo : `${index + 1}. ${licao.titulo}`}</p>
        {licao.tipo_conteudo && !isQuiz && (
          <p className="text-[10px] text-dark-muted uppercase tracking-wider mt-0.5">{licao.tipo_conteudo}</p>
        )}
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
      <div className="space-y-5 animate-fade-in">
        <TrainingBreadcrumb />
        <EmptyState title="Módulo não encontrado" description="Verifique o link ou volte para a página de Treinamentos." />
      </div>
    )
  }

  const setor = nodes.find(n => n.id === modulo.parent_id)
  const licoes = getChildrenByType(nodes, modulo.id, 'licao')

  return (
    <div className="space-y-5 animate-fade-in">
      <TrainingBreadcrumb setor={setor} modulo={modulo} />
      <PageHeader eyebrow="Módulo" title={modulo.titulo} description={`${licoes.length} etapa${licoes.length !== 1 ? 's' : ''} — conclua em ordem, o quiz do módulo é a última etapa.`} />

      <div className="space-y-3">
        {licoes.map((licao, index) => {
          const unlocked = isLicaoUnlocked({ licao, siblingLicoes: licoes, progressMap })
          const status = getNodeProgressStatus(licao.id, progressMap)
          return <LicaoRow key={licao.id} licao={licao} index={index} unlocked={unlocked} status={status} />
        })}
      </div>
    </div>
  )
}
