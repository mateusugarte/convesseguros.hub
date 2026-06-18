import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const WIDTHS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

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

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
      return
    }

    setVisible(false)
    const timeout = setTimeout(() => setMounted(false), 180)
    return () => clearTimeout(timeout)
  }, [isOpen])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 180)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event) {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 400 }}>
      <div className="modal-backdrop" style={{ opacity: visible ? 1 : 0 }} onClick={handleClose} />

      <div
        className={`relative glass-modal w-full ${WIDTHS[maxWidth] || maxWidth} max-h-[90vh] flex flex-col`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
          transition: visible
            ? 'opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1)'
            : 'opacity 180ms ease-in, transform 180ms ease-in',
        }}
      >
        {(title || subtitle) && (
          <div className="modal-shell-header flex items-start justify-between gap-4 px-5 py-4 border-b border-dark-border/60 flex-shrink-0 rounded-t-[24px]">
            <div className="min-w-0">
              {title && <h2 className="title-section text-dark-text">{title}</h2>}
              {subtitle && <p className="mt-1 text-sm text-dark-muted">{subtitle}</p>}
            </div>
            <button
              onClick={handleClose}
              className="btn-ghost p-1.5 -mr-1 cursor-pointer rounded-xl transition-all hover:rotate-90 hover:scale-110 duration-200"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="modal-shell-body overflow-y-auto flex-1 p-5">
          {children}
        </div>

        {footer && (
          <div className="modal-shell-footer px-5 py-4 border-t border-dark-border/60 flex-shrink-0 rounded-b-[24px]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
