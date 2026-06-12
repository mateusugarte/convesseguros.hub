import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export function PageTransition({ children }) {
  const location = useLocation()
  // Start visible — prevents white flash on first render
  const [visible, setVisible] = useState(true)
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    if (prevPath.current === location.pathname) return
    prevPath.current = location.pathname
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'none' : 'translateY(8px)',
        transition: visible ? 'opacity 240ms cubic-bezier(0.16, 1, 0.3, 1), transform 240ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
