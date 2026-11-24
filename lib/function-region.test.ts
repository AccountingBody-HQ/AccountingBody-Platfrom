import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Owner decision D325: server functions run in Dublin, next to the database.

const text = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')
const config = JSON.parse(text) as { regions: unknown; crons: unknown[]; headers: unknown[] }
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

describe('function region', () => {
  it('is Dublin, and nothing else', () => {
    expect(config.regions).toStrictEqual(['dub1'])
  })

  it('the seven crons are unchanged', () => {
    expect(config.crons).toStrictEqual([
      { path: '/api/cron/expire-jobs', schedule: '0 6 * * *' },
      { path: '/api/ingest/orchestrator', schedule: '*/15 * * * *' },
      { path: '/api/cron/prune-pending-subscribers', schedule: '30 6 * * *' },
      { path: '/api/cron/prune-saved-jobs', schedule: '0 7 * * *' },
      { path: '/api/cron/prune-expired-jobs', schedule: '30 7 * * *' },
      { path: '/api/cron/prune-import-logs', schedule: '45 7 * * *' },
      { path: '/api/cron/similar-jobs', schedule: '4 3 * * *' },
    ])
  })

  it('the headers are unchanged', () => {
    expect(config.headers).toHaveLength(1)
    expect(sha256(JSON.stringify(config.headers))).toBe('5a9351cb24daaa8188831bef9a1aac3523de499172e39da6fe5b34e1fa6bf952')
  })

  it('without the region line the file is byte-identical to the one before', () => {
    const lines = text.split('\n')
    const line = '  "regions": ["dub1"],'
    expect(lines.filter((x) => x === line)).toHaveLength(1)
    expect(sha256(lines.filter((x) => x !== line).join('\n'))).toBe('c333bf786950054aca5ae357e5a9a48d9e475e724603a97e8d2a79b005bb299a')
  })
})
