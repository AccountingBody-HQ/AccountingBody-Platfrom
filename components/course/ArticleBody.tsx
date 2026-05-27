'use client'

import React from 'react'
import { PortableText } from '@portabletext/react'

/* eslint-disable @typescript-eslint/no-explicit-any */

function renderSpans(children: any[], markDefs?: any[]): React.ReactNode {
  if (!children) return null
  return children.map((span: any, i: number) => {
    const text: string = span.text ?? ''
    const marks: string[] = span.marks ?? []
    if (marks.length === 0) return <React.Fragment key={i}>{text}</React.Fragment>
    let node: React.ReactNode = text
    for (const mark of marks) {
      if (mark === 'strong') {
        node = <strong style={{ fontWeight: '700', color: '#0C1A3D' }}>{node}</strong>
      } else if (mark === 'em') {
        node = <em style={{ fontStyle: 'italic' }}>{node}</em>
      } else if (mark === 'code') {
        node = <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9em', backgroundColor: '#f1f5f9', padding: '0.15em 0.4em', borderRadius: '4px', color: '#0C1A3D' }}>{node}</code>
      } else {
        const def = markDefs?.find((d: any) => d._key === mark)
        if (def?._type === 'link') {
          node = <a href={def.href} target="_blank" rel="noopener noreferrer" style={{ color: '#D4A017', textDecoration: 'underline' }}>{node}</a>
        }
      }
    }
    return <React.Fragment key={i}>{node}</React.Fragment>
  })
}

const pStyle = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '17px',
  lineHeight: '1.75' as const,
  color: '#1e293b',
  marginBottom: '1.25rem',
}

export default function ArticleBody({ body }: { body: any[] }) {
  if (!body || body.length === 0) return null

  return (
    <div className="article-body">
      <PortableText
        value={body}
        components={{
          block: {
            normal: ({ value }: any) => (
              <p style={pStyle}>{renderSpans(value.children, value.markDefs)}</p>
            ),
            h1: ({ value }: any) => (
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '2rem', fontWeight: '700', color: '#0C1A3D', marginBottom: '1rem', marginTop: '2rem' }}>{renderSpans(value.children, value.markDefs)}</h1>
            ),
            h2: ({ value }: any) => (
              <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.6rem', fontWeight: '700', color: '#0C1A3D', marginBottom: '0.75rem', marginTop: '1.75rem' }}>{renderSpans(value.children, value.markDefs)}</h2>
            ),
            h3: ({ value }: any) => (
              <h3 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', fontWeight: '600', color: '#0C1A3D', marginBottom: '0.5rem', marginTop: '1.5rem' }}>{renderSpans(value.children, value.markDefs)}</h3>
            ),
            h4: ({ value }: any) => (
              <h4 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', fontWeight: '600', color: '#0C1A3D', marginBottom: '0.5rem', marginTop: '1.25rem' }}>{renderSpans(value.children, value.markDefs)}</h4>
            ),
            blockquote: ({ value }: any) => (
              <blockquote style={{ borderLeft: '4px solid #D4A017', paddingLeft: '1.25rem', marginLeft: '0', marginRight: '0', marginBottom: '1.25rem', color: '#475569', fontStyle: 'italic' }}>{renderSpans(value.children, value.markDefs)}</blockquote>
            ),
          },
          list: {
            bullet: ({ children }: any) => (
              <ul style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '17px', lineHeight: '1.75', color: '#1e293b', marginBottom: '1.25rem', paddingLeft: '1.5rem', listStyleType: 'disc' }}>{children}</ul>
            ),
            number: ({ children }: any) => (
              <ol style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '17px', lineHeight: '1.75', color: '#1e293b', marginBottom: '1.25rem', paddingLeft: '1.5rem', listStyleType: 'decimal' }}>{children}</ol>
            ),
          },
          listItem: {
            bullet: ({ value }: any) => (
              <li style={{ marginBottom: '0.4rem' }}>{renderSpans(value.children, value.markDefs)}</li>
            ),
            number: ({ value }: any) => (
              <li style={{ marginBottom: '0.4rem' }}>{renderSpans(value.children, value.markDefs)}</li>
            ),
          },
          marks: {
            strong: ({ children }: any) => (
              <strong style={{ fontWeight: '700', color: '#0C1A3D' }}>{children}</strong>
            ),
            em: ({ children }: any) => (
              <em style={{ fontStyle: 'italic' }}>{children}</em>
            ),
            code: ({ children }: any) => (
              <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9em', backgroundColor: '#f1f5f9', padding: '0.15em 0.4em', borderRadius: '4px', color: '#0C1A3D' }}>{children}</code>
            ),
            link: ({ value, children }: any) => (
              <a href={value?.href} target="_blank" rel="noopener noreferrer" style={{ color: '#D4A017', textDecoration: 'underline' }}>{children}</a>
            ),
          },
        }}
      />
    </div>
  )
}
