import { useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

export function PageTransition({ children }) {
  const location = useLocation()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
