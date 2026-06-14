'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function RouteProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raf = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // New route detected — start bar
    setWidth(0)
    setVisible(true)
    // Animate to 85% quickly then hold
    const start = setTimeout(() => setWidth(30), 10)
    const mid   = setTimeout(() => setWidth(60), 200)
    const hold  = setTimeout(() => setWidth(85), 600)
    timer.current = hold
    return () => {
      clearTimeout(start)
      clearTimeout(mid)
      clearTimeout(hold)
    }
  }, [pathname, searchParams])

  useEffect(() => {
    if (width === 85) {
      // Route settled — complete and hide
      const done = setTimeout(() => setWidth(100), 100)
      const hide = setTimeout(() => setVisible(false), 500)
      raf.current = hide
      return () => {
        clearTimeout(done)
        clearTimeout(hide)
      }
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
        transition: width === 100 ? 'width 0.2s ease, opacity 0.3s ease' : 'width 0.4s ease',
        opacity: width === 100 ? 0 : 1,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    />
  )
}
