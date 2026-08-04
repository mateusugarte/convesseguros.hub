import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight, BookOpen, Layers3, Trophy, Target } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchTrainingTree, fetchTrainingProgress, trainingQueryKey, TRAINING_PRODUTO_FIANCA } from '../../lib/training'
import {
  getChildrenByType,
  buildProgressMap,
  getSetorProgressPct,
  getNextRecommendedNode,
} from '../../lib/trainingProgression'
import { PageHeader, Card, EmptyState } from '../../components/ui'
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
      <div className="training-page space-y-5 animate-fade-in">
        <PageHeader eyebrow="Aprendizado" title="Treinamentos" description="Carregando curriculo..." />
      </div>
    )
  }

  const { nodes, progressRows } = data
  const progressMap = buildProgressMap(progressRows)
  const produtoNode = nodes.find(n => n.tipo === 'produto' && n.produto === TRAINING_PRODUTO_FIANCA)

  if (!produtoNode) {
    return (
      <div className="training-page space-y-5 animate-fade-in">
        <PageHeader eyebrow="Aprendizado" title="Treinamentos" description="Nenhum curriculo publicado ainda." />
        <EmptyState
          icon={<GraduationCap className="w-6 h-6" />}
          title="Curriculo ainda nao publicado"
          description="As migrations de Treinamentos ainda nao foram aplicadas no banco, ou nenhum setor foi semeado para este produto."
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
  const totalModulos = setoresComProgresso.reduce((acc, s) => acc + s.totalModulos, 0)

  return (
    <div className="training-page space-y-6 animate-fade-in">
      <section className="training-hero">
        <div className="training-hero-main">
          <span className="training-kicker">
            <GraduationCap className="w-3.5 h-3.5" />
            Aprendizado
          </span>
          <div>
            <h1>Treinamentos</h1>
            <p>Regras de produto e condicoes gerais por seguradora, organizadas em modulos e licoes para consulta e evolucao continua.</p>
          </div>
        </div>
        <div className="training-hero-progress" aria-label={`Progresso geral ${progressoGeral}%`}>
          <div className="training-progress-orb" style={{ '--training-progress': `${progressoGeral}%` }}>
            <span>{progressoGeral}%</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-muted">Progresso geral</p>
            <p className="text-sm text-dark-text">{setoresConcluidos} de {setores.length} setores concluidos</p>
          </div>
        </div>
      </section>

      <div className="training-metrics-grid">
        <div className="training-metric">
          <Target className="w-4 h-4" />
          <span>Progresso</span>
          <strong>{progressoGeral}%</strong>
        </div>
        <div className="training-metric">
          <Layers3 className="w-4 h-4" />
          <span>Setores</span>
          <strong>{setores.length}</strong>
        </div>
        <div className="training-metric">
          <Trophy className="w-4 h-4" />
          <span>Concluidos</span>
          <strong>{setoresConcluidos}</strong>
        </div>
        <div className="training-metric">
          <BookOpen className="w-4 h-4" />
          <span>Modulos</span>
          <strong>{totalModulos}</strong>
        </div>
      </div>

      {proximoNode && (
        <Card surface="data" padding="lg" className="training-next-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="training-next-icon">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">Proximo passo recomendado</p>
              <p className="text-sm font-semibold text-dark-text">{proximoNode.titulo}</p>
            </div>
          </div>
          <Link to={`/treinamentos/licoes/${proximoNode.id}`} className="btn-primary text-sm inline-flex items-center gap-2 flex-shrink-0">
            Continuar <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      )}

      <div>
        <div className="training-section-head">
          <div>
            <p className="training-kicker training-kicker-soft">Curriculo</p>
            <h2>Setores</h2>
          </div>
          <span>{setores.length} trilha{setores.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {setoresComProgresso.map(({ setor, pct, totalModulos }) => (
            <Link key={setor.id} to={`/treinamentos/setores/${setor.id}`}>
              <Card hoverable padding="lg" className="training-sector-card h-full flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="training-sector-icon">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <TrainingStatusBadge status={pct === 100 ? 'concluido' : pct > 0 ? 'em_andamento' : 'nao_iniciado'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark-text leading-snug">{setor.titulo}</p>
                  <p className="text-[11px] text-dark-muted mt-1">{totalModulos} modulo{totalModulos !== 1 ? 's' : ''}</p>
                </div>
                <div className="mt-auto">
                  <div className="training-progress-track">
                    <div className="training-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-dark-muted mt-1.5">{pct}% concluido</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
