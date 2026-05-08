'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HeroSearch() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    router.push('/search?q=' + encodeURIComponent(trimmed))
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex items-center bg-white rounded-xl shadow-2xl shadow-black/20 overflow-hidden border-2 border-transparent focus-within:border-gold-500 transition-all duration-200">
        {/* Search icon */}
        <div className="flex items-center justify-center w-13 shrink-0 pl-4">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search study notes, practice questions, glossary…"
          className="flex-1 py-4 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent outline-none min-w-0"
          autoComplete="off"
        />

        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 mr-1"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Submit button */}
        <div className="p-2 shrink-0">
          <button
            type="submit"
            className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 active:bg-gold-600 text-navy-950 font-bold rounded-lg transition-all px-4 py-2.5 text-sm"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>

      {/* Popular searches */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <span className="text-white/35 text-xs">Popular:</span>
        {['ACCA F3', 'Deferred tax', 'CIMA OCS', 'AAT Level 3', 'Cash flow'].map(term => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setQuery(term)
              router.push('/search?q=' + encodeURIComponent(term))
            }}
            className="text-xs text-white/50 hover:text-white/90 border border-white/15 hover:border-white/35 rounded-full px-3 py-1 transition-all"
          >
            {term}
          </button>
        ))}
      </div>
    </form>
  )
}
