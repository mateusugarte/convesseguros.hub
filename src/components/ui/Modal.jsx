import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 160)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 160)
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    function handler(e) { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 400 }}
    >
      {/* Backdrop — blur forte sem overlay preta */}
      <div
        className="modal-backdrop"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        className={`relative glass-modal w-full ${maxWidth} max-h-[90vh] flex flex-col`}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(20px)',
          transition: visible
            ? 'opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1)'
            : 'opacity 160ms ease-in, transform 160ms ease-in',
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="modal-shell-header flex items-center justify-between px-5 py-4 border-b border-dark-border/60 flex-shrink-0 rounded-t-[24px]"
          >
            <h2 className="title-section text-dark-text">{title}</h2>
            <button
              onClick={handleClose}
              className="btn-ghost p-1.5 -mr-1 cursor-pointer rounded-xl transition-all hover:rotate-90 hover:scale-110 duration-200"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="modal-shell-body overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
