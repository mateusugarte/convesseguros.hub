import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, CircleAlert, FileSearch, RefreshCw } from 'lucide-react'
import { PageHeader, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { useToast } from '../../contexts/ToastContext'
import { fetchMapeamentos, listarSeguradorasAuto } from '../../lib/autoPdfConfig'
import { camposDoTipo, TIPOS_MAPEAMENTO } from '../../lib/autoPdfCampos'
import { resumirMapeamento } from '../../lib/autoPdfMapeamento'

function metaDoTipo(tipo) {
  return TIPOS_MAPEAMENTO.find(item => item.tipo === tipo) || TIPOS_MAPEAMENTO[0]
}

/**
 * Grade de seguradoras para configurar a leitura de PDF.
 *
 * Verde = mapeamento concluido, o sistema ja le o PDF daquela seguradora
 * sozinho. Vermelho = ainda nao configurada. O amarelo intermediario existe
 * porque o usuario pode salvar o trabalho pela metade e voltar depois.
 */
export default function AutoPdfConfigLista({ tipo }) {
  const navigate = useNavigate()
  const toast = useToast()
  const meta = metaDoTipo(tipo)
  const definicoes = useMemo(() => camposDoTipo(tipo), [tipo])

  const [seguradoras, setSeguradoras] = useState([])
  const [mapeamentos, setMapeamentos] = useState({})
  const [fallback, setFallback] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      setErro(null)
      try {
        const [lista, linhas] = await Promise.all([listarSeguradorasAuto(), fetchMapeamentos(tipo)])
        if (!ativo) return
        setSeguradoras(lista.seguradoras)
        setFallback(lista.fallback)
        setMapeamentos(Object.fromEntries(linhas.map(linha => [linha.seguradora_id, linha])))
      } catch (error) {
        if (!ativo) return
        setErro(error.message)
        toast({ type: 'error', title: 'Erro ao carregar as seguradoras', message: error.message })
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => { ativo = false }
  }, [tipo])

  const cards = useMemo(() => seguradoras.map(seguradora => {
    const linha = mapeamentos[seguradora.id]
    const resumo = resumirMapeamento(linha?.campos, definicoes)
    const concluido = linha?.status === 'concluido'
    const iniciado = Boolean(linha) && !concluido
    return { seguradora, linha, resumo, concluido, iniciado }
  }), [seguradoras, mapeamentos, definicoes])

  const totalConcluidos = cards.filter(card => card.concluido).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuracoes · Auto"
        title={`Configurar ${meta.titulo.toLowerCase()}`}
        description={meta.descricao}
        actions={(
          <>
            <Link to="/configuracoes" className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="badge badge-success">{totalConcluidos} configuradas</span>
        <span className="badge badge-blue">{cards.length - totalConcluidos} pendentes</span>
        <span className="text-dark-muted">
          {definicoes.length} campos sao pedidos pelo sistema neste fluxo.
        </span>
      </div>

      {fallback && (
        <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-dark-text">
          Nenhuma seguradora esta marcada com o produto <strong>AUTO</strong> no cadastro, entao a lista abaixo mostra todas as ativas.
          Marque o produto em <Link to="/seguradoras" className="underline">Seguradoras</Link> para filtrar so as de Auto.
        </div>
      )}

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(item => (
            <div key={item} className="h-40 animate-pulse rounded-3xl border border-dark-border/60 bg-dark-surface2/40" />
          ))}
        </div>
      ) : erro ? (
        <EmptyState
          icon={<CircleAlert className="h-6 w-6" />}
          title="Nao foi possivel carregar as seguradoras"
          description={erro}
        />
      ) : !cards.length ? (
        <EmptyState
          icon={<FileSearch className="h-6 w-6" />}
          title="Nenhuma seguradora cadastrada"
          description="Cadastre as seguradoras em Seguradoras para poder configurar a leitura dos PDFs."
          actions={<Link to="/seguradoras" className="btn-primary">Ir para Seguradoras</Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ seguradora, linha, resumo, concluido, iniciado }) => (
            <button
              key={seguradora.id}
              type="button"
              onClick={() => navigate(`${meta.rota}/${seguradora.id}`)}
              className={`group rounded-3xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${
                concluido
                  ? 'border-status-success/40 bg-status-success/5'
                  : iniciado
                    ? 'border-status-warning/40 bg-status-warning/5'
                    : 'border-status-danger/40 bg-status-danger/5'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <SeguradoraBadge
                  nome={seguradora.nome_canonico}
                  logoUrl={seguradora.logo_url}
                  logoPath={seguradora.logo_path}
                  size="xxl"
                  showName={false}
                />
                <span className={`badge ${concluido ? 'badge-success' : iniciado ? 'badge-warning' : 'badge-danger'}`}>
                  {concluido ? 'Configurada' : iniciado ? 'Em configuracao' : 'Nao configurada'}
                </span>
              </div>

              <p className="mt-4 text-base font-semibold text-dark-text">{seguradora.nome_canonico}</p>

              <div className="mt-3 flex items-center gap-2 text-xs text-dark-muted">
                {concluido ? <CheckCircle2 className="h-4 w-4 text-status-success" /> : <CircleAlert className="h-4 w-4 text-status-warning" />}
                <span>
                  {linha
                    ? `${resumo.confirmados} de ${resumo.total} campos confirmados`
                    : 'Suba um PDF de exemplo para mapear'}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-dark-surface2">
                <div
                  className={`h-full rounded-full transition-all ${concluido ? 'bg-status-success' : 'bg-status-warning'}`}
                  style={{ width: `${resumo.percentual}%` }}
                />
              </div>

              {linha?.amostra_nome && (
                <p className="mt-3 truncate text-[11px] text-dark-muted">Amostra: {linha.amostra_nome}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
