import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ModalFrame } from './ModalFrame'

export function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  children,
  footer = null,
  maxWidth = 'md',
}) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const closeTimerRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (isOpen) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
      setMounted(true)
      const frameId = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frameId)
    }

    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setMounted(false)
      closeTimerRef.current = null
    }, 180)
    return () => clearTimeout(closeTimerRef.current)
  }, [isOpen])

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  const handleClose = useCallback(() => {
    if (!onClose || closeTimerRef.current) return
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      setMounted(false)
      closeTimerRef.current = null
      onClose()
    }, 180)
  }, [onClose])

  if (!mounted) return null

  return (
    <ModalFrame
      onClose={handleClose}
      size={maxWidth}
      className={visible ? 'is-open' : 'is-closing'}
      surfaceClassName="glass-modal"
      ariaLabel={title || 'Janela de diálogo'}
      labelledBy={title ? titleId : undefined}
    >
      {(title || subtitle) && (
        <header className="modal-shell-header flex items-start justify-between gap-4 border-b">
          <div className="min-w-0">
            {title && <h2 id={titleId} className="title-section text-dark-text">{title}</h2>}
            {subtitle && <p className="mt-1 break-words text-sm text-dark-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={handleClose} className="modal-close-button" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </header>
      )}

      <div className="modal-shell-body p-5">
        {children}
      </div>

      {footer && (
        <footer className="modal-shell-footer border-t">
          {footer}
        </footer>
      )}
    </ModalFrame>
  )
}
