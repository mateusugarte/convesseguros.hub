import { useState, useEffect, useRef } from 'react'
import { fetchDocumentos, uploadDocumento, deletarDocumento } from '../lib/documentos'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Paperclip, Trash2, ExternalLink, Upload } from 'lucide-react'

export default function SecaoDocumentos({ fichaId, apoliceId, cpfCnpj, onUploadSuccess }) {
  const { user }    = useAuth()
  const toast       = useToast()
  const inputRef    = useRef(null)
  const [docs,      setDocs]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const data = await fetchDocumentos({ fichaId, apoliceId })
      setDocs(data)
    } catch (err) {
      if (err?.code !== '42P01') {
        toast({ type: 'error', title: 'Erro ao carregar documentos', message: err?.message })
      }
      setDocs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (fichaId || apoliceId) carregar()
  }, [fichaId, apoliceId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ type: 'error', title: 'Apenas arquivos PDF são aceitos' })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ type: 'error', title: 'Arquivo muito grande (máx 10MB)' })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setUploading(true)
    const { error } = await uploadDocumento({ file, fichaId, apoliceId, cpfCnpj, userId: user?.id })
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (error) {
      toast({ type: 'error', title: 'Erro ao enviar documento', message: error.message })
      return
    }
    if (onUploadSuccess) {
      try {
        await onUploadSuccess(file)
      } catch (callbackError) {
        toast({
          type: 'error',
          title: 'Documento enviado, mas houve erro ao atualizar a ficha',
          message: callbackError?.message,
        })
        carregar()
        return
      }
    }
    toast({ type: 'success', title: 'Documento enviado!' })
    carregar()
  }

  async function handleDeletar(doc) {
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return
    const error = await deletarDocumento(doc.id, doc.url)
    if (error) { toast({ type: 'error', title: 'Erro ao excluir' }); return }
    toast({ type: 'success', title: 'Documento excluído' })
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  function formatBytes(b) {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-status-info" />
          <p className="text-sm font-semibold text-dark-text">Documentos</p>
          {docs.length > 0 && (
            <span className="text-[10px] font-mono text-dark-muted">({docs.length})</span>
          )}
        </div>
        <label className={`btn-secondary text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Enviando...' : 'Enviar PDF'}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-dark-muted text-center py-3">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-dark-muted/40 text-center py-4">Nenhum documento anexado</p>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2 border-b border-dark-border/50 last:border-0">
              <div className="w-7 h-7 rounded-md bg-status-danger/10 flex items-center justify-center flex-shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-status-danger/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dark-text truncate">{d.nome_arquivo}</p>
                <p className="text-[10px] text-dark-muted">
                  {formatBytes(d.tamanho_bytes)}
                  {d.profiles?.nome && ` · ${d.profiles.nome.split(' ')[0]}`}
                  {' · '}{format(parseISO(d.created_at), 'dd/MM/yy', { locale: ptBR })}
                </p>
              </div>
              <a href={d.signedUrl || '#'} target="_blank" rel="noreferrer"
                className={`transition-colors p-1 ${d.signedUrl ? 'text-dark-muted hover:text-status-info' : 'text-dark-muted/30 pointer-events-none'}`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => handleDeletar(d)}
                className="text-dark-muted hover:text-status-danger transition-colors p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


