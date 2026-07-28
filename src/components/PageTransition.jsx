import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export function PageTransition({ children, className = '' }) {
  const location = useLocation()
  // Start visible to prevent a white flash on the first render.
  const [visible, setVisible] = useState(true)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (prevPath.current === location.pathname) return
    prevPath.current = location.pathname
    setVisible(false)
    const timeoutId = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(timeoutId)
  }, [location.pathname])

  return (
    <div
      className={`shell-page-transition ${visible ? 'is-visible' : 'is-entering'} flex h-full min-h-0 w-full flex-1 flex-col ${className}`}
    >
      {children}
    </div>
  )
}
