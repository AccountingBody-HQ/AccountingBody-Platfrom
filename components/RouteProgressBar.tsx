'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function RouteProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const started = useRef(false)

  const clearAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const startBar = () => {
    if (started.current) return
    started.current = true
    clearAll()
    setWidth(0)
    setVisible(true)
    const t1 = setTimeout(() => setWidth(40), 0)
    const t2 = setTimeout(() => setWidth(70), 300)
    const t3 = setTimeout(() => setWidth(85), 800)
    timers.current = [t1, t2, t3]
  }

  const completeBar = () => {
    started.current = false
    clearAll()
    setWidth(100)
    const hide = setTimeout(() => setVisible(false), 400)
    timers.current = [hide]
  }

  // Trigger on any link click — fires before navigation
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('#')) return
      // Skip if already on the destination page
      if (href === window.location.pathname) return
      startBar()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  // Complete when new route settles
  useEffect(() => {
    completeBar()
  }, [pathname, searchParams])

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
        transition: width === 100 ? 'width 0.15s ease, opacity 0.3s ease' : 'width 0.4s ease',
        opacity: width === 100 ? 0 : 1,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
