import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({ children, content, delay = 300 }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const timerRef = useRef(null)
  const triggerRef = useRef(null)

  function show() {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left + r.width / 2 })
      setVisible(true)
    }, delay)
  }

  function hide() {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <>
      <span ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
        {children}
      </span>
      {visible && createPortal(
        <div
          className="fixed pointer-events-none -translate-x-1/2 z-[500] animate-fade-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="glass-panel px-2.5 py-1.5 text-xs text-dark-text whitespace-nowrap max-w-[200px]">
            {content}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
