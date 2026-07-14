import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight, BookOpen } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA } from '../../lib/training'
import {
  getChildrenByType,
  buildProgressMap,
  getSetorProgressPct,
  getNextRecommendedNode,
} from '../../lib/trainingProgression'
import { PageHeader, Card, MetricCard, EmptyState } from '../../components/ui'
import TrainingStatusBadge from '../../components/treinamentos/TrainingStatusBadge'

export default function TreinamentosDashboard() {
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
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader eyebrow="Aprendizado" title="Treinamentos" description="Carregando currículo..." />
      </div>
    )
  }

  const { nodes, progressRows } = data
  const progressMap = buildProgressMap(progressRows)
  const produtoNode = nodes.find(n => n.tipo === 'produto' && n.produto === TRAINING_PRODUTO_FIANCA)

  if (!produtoNode) {
    return (
      <div className="space-y-5 animate-fade-in">
        <PageHeader eyebrow="Aprendizado" title="Treinamentos" description="Nenhum currículo publicado ainda." />
        <EmptyState
          icon={<GraduationCap className="w-6 h-6" />}
          title="Currículo ainda não publicado"
          description="As migrations de Treinamentos ainda não foram aplicadas no banco, ou nenhum setor foi semeado para este produto."
        />
      </div>
    )
  }

  const setores = getChildrenByType(nodes, produtoNode.id, 'setor')
  const setoresComProgresso = setores.map(setor => ({
    setor,
    pct: getSetorProgressPct({ nodes, setorId: setor.id, progressMap }),
    totalModulos: getChildrenByType(nodes, setor.id, 'modulo').length,
  }))

  const progressoGeral = setoresComProgresso.length
    ? Math.round(setoresComProgresso.reduce((acc, s) => acc + s.pct, 0) / setoresComProgresso.length)
    : 0

  const proximoNode = getNextRecommendedNode({ nodes, progressMap, produto: TRAINING_PRODUTO_FIANCA })
  const setoresConcluidos = setoresComProgresso.filter(s => s.pct === 100).length

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        eyebrow="Aprendizado"
        title="Treinamentos"
        description="Regras de produto e condições gerais por seguradora, organizadas em módulos e lições — no seu ritmo."
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Progresso geral" value={`${progressoGeral}%`} />
        <MetricCard label="Setores" value={setores.length} />
        <MetricCard label="Setores concluídos" value={setoresConcluidos} />
        <MetricCard label="Módulos no currículo" value={setoresComProgresso.reduce((acc, s) => acc + s.totalModulos, 0)} />
      </div>

      {proximoNode && (
        <Card surface="data" padding="lg" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/10 border border-brand-accent/15 text-status-info flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">Próximo passo recomendado</p>
              <p className="text-sm font-semibold text-dark-text">{proximoNode.titulo}</p>
            </div>
          </div>
          <Link to={`/treinamentos/licoes/${proximoNode.id}`} className="btn-primary text-sm inline-flex items-center gap-2 flex-shrink-0">
            Continuar <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted mb-3">Setores</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {setoresComProgresso.map(({ setor, pct, totalModulos }) => (
            <Link key={setor.id} to={`/treinamentos/setores/${setor.id}`}>
              <Card hoverable padding="lg" className="h-full flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-dark-text leading-snug">{setor.titulo}</p>
                  <TrainingStatusBadge status={pct === 100 ? 'concluido' : pct > 0 ? 'em_andamento' : 'nao_iniciado'} />
                </div>
                <p className="text-[11px] text-dark-muted">{totalModulos} módulo{totalModulos !== 1 ? 's' : ''}</p>
                <div className="mt-auto">
                  <div className="h-1.5 rounded-full bg-dark-surface2 overflow-hidden">
                    <div className="h-full rounded-full bg-status-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-dark-muted mt-1.5">{pct}% concluído</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
