'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function RouteProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  useEffect(() => {
    clearAll()
    setWidth(0)
    setVisible(true)
    // Start immediately, animate to 85%
    const t1 = setTimeout(() => setWidth(40), 0)
    const t2 = setTimeout(() => setWidth(70), 300)
    const t3 = setTimeout(() => setWidth(85), 800)
    timers.current = [t1, t2, t3]
    return clearAll
  }, [pathname, searchParams])

  useEffect(() => {
    if (width === 85) {
      const done = setTimeout(() => setWidth(100), 80)
      const hide = setTimeout(() => setVisible(false), 400)
      timers.current.push(done, hide)
    }
  }, [width])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${width}%`,
        height: '3px',
        backgroundColor: '#D4A017',
        transition: width === 100 ? 'width 0.15s ease, opacity 0.25s ease' : 'width 0.3s ease',
        opacity: width === 100 ? 0 : 1,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
