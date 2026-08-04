import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const SIZE_CLASS = {
  sm: 'modal-surface-sm',
  md: 'modal-surface-md',
  lg: 'modal-surface-lg',
  xl: 'modal-surface-xl',
  wide: 'modal-surface-wide',
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let openFrames = 0
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

function lockPageScroll() {
  if (openFrames === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousBodyPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
  }
  openFrames += 1
}

function unlockPageScroll() {
  openFrames = Math.max(0, openFrames - 1)
  if (openFrames === 0) {
    document.body.style.overflow = previousBodyOverflow
    document.body.style.paddingRight = previousBodyPaddingRight
  }
}

export function ModalFrame({
  children,
  onClose,
  size = 'md',
  className = '',
  surfaceClassName = '',
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel = 'Janela de diálogo',
  labelledBy,
  describedBy,
}) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    lockPageScroll()
    const frameId = requestAnimationFrame(() => dialogRef.current?.focus())

    function handleKeyDown(event) {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('keydown', handleKeyDown)
      unlockPageScroll()
      previouslyFocused?.focus?.()
    }
  }, [closeOnEscape])

  return createPortal(
    <div className={`modal-viewport ${className}`} role="presentation">
      <button
        type="button"
        className="modal-backdrop modal-backdrop-soft"
        onClick={closeOnBackdrop ? () => onCloseRef.current?.() : undefined}
        aria-label={closeOnBackdrop ? 'Fechar janela' : undefined}
        aria-hidden={!closeOnBackdrop}
        tabIndex={-1}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`modal-surface ${SIZE_CLASS[size] || size} ${surfaceClassName}`}
      >
        {children}
      </section>
    </div>,
    document.body,
  )
}
