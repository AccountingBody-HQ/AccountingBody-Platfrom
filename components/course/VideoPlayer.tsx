// components/course/VideoPlayer.tsx
// Lazy-loads YouTube and Vimeo embeds — client only
'use client'

import { useState } from 'react'

interface Props {
  url: string
  title?: string
}

function getEmbedUrl(raw: string): string | null {
  // YouTube
  const yt = raw.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`

  // Vimeo
  const vi = raw.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}?dnt=1`

  return null
}

export default function VideoPlayer({ url, title = 'Lesson video' }: Props) {
  const [loaded, setLoaded] = useState(false)
  const embedUrl = getEmbedUrl(url)
  if (!embedUrl) return null

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-navy-950 aspect-video shadow-xl">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-950">
          <div className="flex flex-col items-center gap-3 text-white/70">
            <svg className="w-12 h-12 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="1.5"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeWidth="1.5"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Loading video…</span>
          </div>
        </div>
      )}
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className={`w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}