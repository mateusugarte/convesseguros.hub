import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ExternalLink, Paperclip, Trash2, Upload } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { deleteEntityDocument, fetchEntityDocuments, uploadEntityDocument } from '../lib/entityMedia'

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EntityDocumentsSection({ tipoEntidade, entidadeId, title = 'Documentos' }) {
  const { user } = useAuth()
  const toast = useToast()
  const inputRef = useRef(null)

  const [docs, setDocs] = useState([])
  const [titulo, setTitulo] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function carregar() {
    if (!entidadeId) return
    setLoading(true)
    try {
      const data = await fetchEntityDocuments({ tipoEntidade, entidadeId })
      setDocs(data)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao carregar documentos', message: error.message })
      setDocs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [tipoEntidade, entidadeId])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 15 * 1024 * 1024) {
      toast({ type: 'error', title: 'Arquivo muito grande', message: 'Use arquivos de ate 15MB.' })
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setUploading(true)
    const { error } = await uploadEntityDocument({
      file,
      tipoEntidade,
      entidadeId,
      titulo: titulo.trim() || file.name,
      userId: user?.id,
    })
    setUploading(false)

    if (inputRef.current) inputRef.current.value = ''
    if (error) {
      toast({ type: 'error', title: 'Erro ao enviar documento', message: error.message })
      return
    }

    setTitulo('')
    toast({ type: 'success', title: 'Documento enviado!' })
    carregar()
  }

  async function handleDelete(doc) {
    if (!confirm(`Excluir "${doc.titulo}"?`)) return
    const error = await deleteEntityDocument(doc.id)
    if (error) {
      toast({ type: 'error', title: 'Erro ao excluir documento', message: error.message })
      return
    }
    toast({ type: 'success', title: 'Documento excluido' })
    setDocs(prev => prev.filter(item => item.id !== doc.id))
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-brand-accent" />
          <p className="text-sm font-semibold text-dark-text">{title}</p>
          {docs.length > 0 && (
            <span className="text-[10px] font-mono text-dark-muted">({docs.length})</span>
          )}
        </div>
        <label className={`btn-secondary text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Enviando...' : 'Anexar arquivo'}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading || !entidadeId}
          />
        </label>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1.5">
          Titulo do documento
        </label>
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Ex: Manual comercial, tabela de aceites..."
          className="input text-sm"
        />
      </div>

      {loading ? (
        <p className="text-xs text-dark-muted text-center py-3">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-dark-muted/40 text-center py-4">Nenhum documento anexado</p>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 py-2 border-b border-dark-border/50 last:border-0">
              <div className="w-7 h-7 rounded-md bg-brand-secondary/20 flex items-center justify-center flex-shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dark-text truncate">{doc.titulo}</p>
                <p className="text-[10px] text-dark-muted truncate">
                  {doc.nome_arquivo}
                  {doc.tamanho_bytes ? ` · ${formatBytes(doc.tamanho_bytes)}` : ''}
                  {doc.profiles?.nome ? ` · ${doc.profiles.nome.split(' ')[0]}` : ''}
                  {` · ${format(parseISO(doc.created_at), 'dd/MM/yy', { locale: ptBR })}`}
                </p>
              </div>
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-dark-muted hover:text-brand-accent transition-colors p-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => handleDelete(doc)}
                className="text-dark-muted hover:text-status-danger transition-colors p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
