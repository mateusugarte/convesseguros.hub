import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Check,
  ClipboardCheck,
  FileText,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Siren,
  UserRound,
  Users,
} from 'lucide-react'
import { AutoBadge, AutoInlineAlert, AutoPageHeader, AutoPanel } from '../../components/auto'

const CHECKLIST = [
  { id: 'seguranca', icon: ShieldAlert, title: 'Proteja as pessoas', description: 'Confirme se todos estão em segurança e acione emergência quando necessário.' },
  { id: 'local', icon: MapPin, title: 'Registre local e horário', description: 'Anote endereço, referência, data e horário aproximado da ocorrência.' },
  { id: 'fotos', icon: Camera, title: 'Fotografe o cenário', description: 'Registre veículos, placas, danos, sinalização e a visão geral do local.' },
  { id: 'terceiros', icon: UserRound, title: 'Colete dados de terceiros', description: 'Nome, telefone, CPF, placa e seguradora dos demais envolvidos.' },
  { id: 'boletim', icon: FileText, title: 'Avalie o boletim', description: 'Faça o registro policial quando houver vítima, dano público, desacordo ou exigência legal.' },
  { id: 'documentos', icon: ClipboardCheck, title: 'Separe os documentos', description: 'CNH, documento do veículo, apólice e comprovantes relacionados.' },
]

const STORAGE_KEY = 'auto-sinistro-preparo'

export default function AutoSinistrosV2() {
  const navigate = useNavigate()
  const [concluidos, setConcluidos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(concluidos))
  }, [concluidos])

  const progresso = useMemo(
    () => Math.round((concluidos.length / CHECKLIST.length) * 100),
    [concluidos.length],
  )

  function toggleItem(id) {
    setConcluidos(current => current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id])
  }

  function reiniciar() {
    setConcluidos([])
  }

  return (
    <div className="auto-page auto-v2-page auto-claims-page">
      <AutoPageHeader
        context="Assistência Auto"
        title="Central de sinistros"
        description="Prepare o primeiro atendimento com segurança e reúna tudo antes de acionar a seguradora."
        meta={(
          <>
            <AutoBadge tone="success" icon={ClipboardCheck}>Pré-atendimento disponível</AutoBadge>
            <AutoBadge>Checklist salvo neste dispositivo</AutoBadge>
          </>
        )}
        actions={(
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => navigate('/auto/clientes')}>
            <Users className="h-4 w-4" aria-hidden="true" />
            Localizar cliente
          </button>
        )}
      />

      <AutoInlineAlert
        tone="warning"
        icon={Siren}
        title="Em caso de vítimas ou risco imediato, priorize a emergência"
        description="Esta central organiza informações, mas não substitui polícia, bombeiros, atendimento médico ou o canal oficial da seguradora."
      />

      <div className="auto-claims-grid">
        <AutoPanel
          title="Preparação guiada"
          description="Marque cada etapa conforme reunir as informações."
          actions={concluidos.length > 0 ? (
            <button type="button" onClick={reiniciar} className="auto-claims-reset">
              <RefreshCw aria-hidden="true" />Reiniciar
            </button>
          ) : null}
        >
          <div className="auto-claims-checklist auto-v2-stagger">
            {CHECKLIST.map((item, index) => {
              const Icon = item.icon
              const checked = concluidos.includes(item.id)
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={checked ? 'is-complete' : ''}
                  aria-pressed={checked}
                >
                  <span className="auto-claims-step">{checked ? <Check aria-hidden="true" /> : index + 1}</span>
                  <span className="auto-claims-icon"><Icon aria-hidden="true" /></span>
                  <span className="auto-claims-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="auto-claims-check"><Check aria-hidden="true" /></span>
                </button>
              )
            })}
          </div>
        </AutoPanel>

        <aside className="auto-claims-aside">
          <section className="auto-claims-progress-card">
            <div className="auto-claims-progress" style={{ '--claims-progress': `${progresso * 3.6}deg` }}>
              <div><strong>{progresso}%</strong><small>preparado</small></div>
            </div>
            <div>
              <span>Progresso do atendimento</span>
              <h2>{progresso === 100 ? 'Informações essenciais reunidas' : `${concluidos.length} de ${CHECKLIST.length} etapas concluídas`}</h2>
              <p>{progresso === 100
                ? 'Agora confirme o canal oficial e siga as instruções específicas da seguradora.'
                : 'Você pode sair e continuar depois neste mesmo dispositivo.'}</p>
            </div>
          </section>

          <AutoPanel title="O que acontece depois?">
            <ol className="auto-claims-next">
              <li><span>1</span><div><strong>Confirme a apólice</strong><small>Localize cliente, seguradora e vigência.</small></div></li>
              <li><span>2</span><div><strong>Acione o canal oficial</strong><small>Use telefone, aplicativo ou assistência indicada na apólice.</small></div></li>
              <li><span>3</span><div><strong>Guarde o protocolo</strong><small>Registre número, responsável e próxima orientação.</small></div></li>
            </ol>
          </AutoPanel>
        </aside>
      </div>
    </div>
  )
}