'use client'

import { PortableText } from '@portabletext/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ArticleBody({ body }: { body: any[] }) {
  if (!body || body.length === 0) return null

  return (
    <div className="article-body">
      <PortableText
        value={body}
        components={{
          block: {
            normal: ({ children }) => (
              <p style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#1e293b',
                marginBottom: '1.25rem',
              }}>{children}</p>
            ),
            h1: ({ children }) => (
              <h1 style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '2rem',
                fontWeight: '700',
                color: '#0C1A3D',
                marginBottom: '1rem',
                marginTop: '2rem',
              }}>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '1.6rem',
                fontWeight: '700',
                color: '#0C1A3D',
                marginBottom: '0.75rem',
                marginTop: '1.75rem',
              }}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '1.3rem',
                fontWeight: '600',
                color: '#0C1A3D',
                marginBottom: '0.5rem',
                marginTop: '1.5rem',
              }}>{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 style={{
                fontFamily: 'DM Serif Display, serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#0C1A3D',
                marginBottom: '0.5rem',
                marginTop: '1.25rem',
              }}>{children}</h4>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: '4px solid #D4A017',
                paddingLeft: '1.25rem',
                marginLeft: '0',
                marginRight: '0',
                marginBottom: '1.25rem',
                color: '#475569',
                fontStyle: 'italic',
              }}>{children}</blockquote>
            ),
          },
          list: {
            bullet: ({ children }) => (
              <ul style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#1e293b',
                marginBottom: '1.25rem',
                paddingLeft: '1.5rem',
                listStyleType: 'disc',
              }}>{children}</ul>
            ),
            number: ({ children }) => (
              <ol style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '17px',
                lineHeight: '1.75',
                color: '#1e293b',
                marginBottom: '1.25rem',
                paddingLeft: '1.5rem',
                listStyleType: 'decimal',
              }}>{children}</ol>
            ),
          },
          listItem: {
            bullet: ({ children }) => (
              <li style={{ marginBottom: '0.4rem' }}>{children}</li>
            ),
            number: ({ children }) => (
              <li style={{ marginBottom: '0.4rem' }}>{children}</li>
            ),
          },
          marks: {
            strong: ({ children }) => (
              <strong style={{ fontWeight: '700', color: '#0C1A3D' }}>{children}</strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: 'italic' }}>{children}</em>
            ),
            code: ({ children }) => (
              <code style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.9em',
                backgroundColor: '#f1f5f9',
                padding: '0.15em 0.4em',
                borderRadius: '4px',
                color: '#0C1A3D',
              }}>{children}</code>
            ),
            link: ({ value, children }) => (
              <a
                href={value?.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#D4A017', textDecoration: 'underline' }}
              >{children}</a>
            ),
          },
        }}
      />
    </div>
  )
}
