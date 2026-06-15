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
  const touchStart = useRef<{x: number, y: number} | null>(null)

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

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('#')) return
      if (href === window.location.pathname) return
      startBar()
    }

    const onTouchStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x)
      const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y)
      touchStart.current = null
      // Only treat as a tap if finger barely moved
      if (dx > 10 || dy > 10) return
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('#')) return
      if (href === window.location.pathname) return
      startBar()
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useEffect(() => {
    completeBar()
  }, [pathname, searchParams])

  // ET language switch: resume bar after reload, hold until Google Translate finishes
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return
    const flag = sessionStorage.getItem("et-lang-reload")
    if (!flag) return
    sessionStorage.removeItem("et-lang-reload")
    started.current = false
    startBar()
    const interval = setInterval(() => {
      const translated =
        document.body.classList.contains("translated-ltr") ||
        document.body.classList.contains("translated-rtl") ||
        Boolean(document.querySelector(".goog-te-banner-frame"))
      if (translated) {
        clearInterval(interval)
        completeBar()
      }
    }, 200)
    const safety = setTimeout(() => {
      clearInterval(interval)
      completeBar()
    }, 5000)
    return () => {
      clearInterval(interval)
      clearTimeout(safety)
    }
  }, [])

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
