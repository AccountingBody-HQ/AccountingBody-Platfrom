'use client'
import { useState } from 'react'

interface Field { id: string; label: string; placeholder: string }
interface Result { label: string; value: string }
interface CalcCardProps {
  title: string
  tag: string
  description: string
  fields: Field[]
  calculate: (values: Record<string, string>) => Result[] | null
}

export default function CalcCard({ title, tag, description, fields, calculate }: CalcCardProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Result[] | null>(null)

  const handleChange = (id: string, val: string) => {
    const next = { ...values, [id]: val }
    setValues(next)
    setResults(calculate(next))
  }

  const reset = () => { setValues({}); setResults(null) }

  return (
    <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: 'linear-gradient(to right, #D4A017, rgba(212,160,23,0.3))' }} />
      <div style={{ padding: 24 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8860B', background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.25)', borderRadius: 20, padding: '3px 10px' }}>{tag}</span>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.25rem', color: '#0C1A3D', margin: '12px 0 6px', lineHeight: 1.2 }}>{title}</h2>
        <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>{description}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {fields.map(f => (
            <div key={f.id}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input
                type="number"
                value={values[f.id] ?? ''}
                onChange={e => handleChange(f.id, e.target.value)}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#0C1A3D', background: '#F8F7F4', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
        {results && results.length > 0 && (
          <div style={{ background: '#0C1A3D', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: i > 0 ? 8 : 0, borderTop: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none', marginTop: i > 0 ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#D4A017' }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {Object.keys(values).length > 0 && (
          <button onClick={reset} style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
        )}
      </div>
    </div>
  )
}
