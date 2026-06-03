import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export function PageTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const prevPath = useRef(null)

  useEffect(() => {
    if (prevPath.current === location.pathname) return
    prevPath.current = location.pathname
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 16)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'none' : 'translateY(8px)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
