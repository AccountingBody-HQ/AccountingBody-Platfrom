// A small in-memory stand-in for the database's REST interface, for tests that
// run real supabase-js clients with a fake `fetch`. It understands only the
// filters these tests use (eq, neq, lt, gt, in, not.is.null), order on one
// column, limit and offset, and GET / PATCH / DELETE / POST (insert, or upsert
// with on_conflict). Every request is
// recorded. A test may make any request fail through `problem`.

export type Row = Record<string, unknown>

export type RecordedRequest = {
  method: string
  table: string
  params: [string, string][]
  body: unknown
}

export type FakeTables = {
  tables: Record<string, Row[]>
  requests: RecordedRequest[]
  problem?: (request: RecordedRequest) => 'fail' | 'throw' | undefined
  fetch: typeof fetch
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset'])
export const FAKE_PROBLEM = { message: 'seed problem text 7k', code: '22P02', details: 'seed-detail', hint: null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function compare(a: unknown, b: string): number {
  const left = String(a)
  const da = Date.parse(left)
  const db = Date.parse(b)
  if (!Number.isNaN(da) && !Number.isNaN(db) && /\d{4}-\d{2}-\d{2}T/.test(left) && /\d{4}-\d{2}-\d{2}T/.test(b)) return da - db
  return left < b ? -1 : left > b ? 1 : 0
}

function inList(value: string): string[] {
  return value.slice(1, -1).split(',').map((v) => v.replace(/^"(.*)"$/, '$1'))
}

function matches(row: Row, column: string, filter: string): boolean {
  const value = row[column]
  if (filter === 'not.is.null') return value !== null && value !== undefined
  if (filter === 'is.null') return value === null || value === undefined
  const dot = filter.indexOf('.')
  const op = filter.slice(0, dot)
  const arg = filter.slice(dot + 1)
  // Like SQL, a null never passes a comparison.
  if (value === null || value === undefined) return false
  switch (op) {
    case 'eq': return String(value) === arg
    case 'neq': return String(value) !== arg
    case 'lt': return compare(value, arg) < 0
    case 'gt': return compare(value, arg) > 0
    case 'in': return inList(arg).includes(String(value))
    default: throw new Error(`fake tables: unknown filter ${filter}`)
  }
}

function pick(row: Row, select: string | null): Row {
  if (!select || select === '*') return { ...row }
  const out: Row = {}
  for (const column of select.split(',').map((c) => c.trim())) out[column] = row[column]
  return out
}

export function fakeTables(origin: string, tables: Record<string, Row[]>): FakeTables {
  const state: FakeTables = {
    tables,
    requests: [],
    problem: undefined,
    fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('unexpected request')
      const method = (init?.method ?? 'GET').toUpperCase()
      const table = url.pathname.replace('/rest/v1/', '')
      const params: [string, string][] = []
      url.searchParams.forEach((value, key) => params.push([key, value]))
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      const request: RecordedRequest = { method, table, params, body }
      state.requests.push(request)

      const answer = state.problem?.(request)
      if (answer === 'throw') throw new TypeError('fetch failed seed-network-3x')
      if (answer === 'fail') return json(FAKE_PROBLEM, 400)

      const rows = state.tables[table] ?? (state.tables[table] = [])
      const filters = params.filter(([key]) => !RESERVED.has(key))
      let hit = rows.filter((row) => filters.every(([column, filter]) => matches(row, column, filter)))
      const order = url.searchParams.get('order')
      if (order) {
        const [column, direction] = order.split('.')
        hit = [...hit].sort((a, b) => compare(a[column], String(b[column])) * (direction === 'desc' ? -1 : 1))
      }
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = url.searchParams.get('limit')
      if (method === 'GET') hit = hit.slice(offset, limit === null ? undefined : offset + Number(limit))
      const select = url.searchParams.get('select')

      if (method === 'GET') return json(hit.map((row) => pick(row, select)))
      if (method === 'PATCH') {
        for (const row of hit) Object.assign(row, body)
        return json(hit.map((row) => pick(row, select)))
      }
      if (method === 'DELETE') {
        state.tables[table] = rows.filter((row) => !hit.includes(row))
        return json(hit.map((row) => pick(row, select)))
      }
      if (method === 'POST') {
        // Insert, or upsert merged on the on_conflict columns.
        const onConflict = url.searchParams.get('on_conflict')?.split(',') ?? null
        const written: Row[] = []
        for (const row of (Array.isArray(body) ? body : [body]) as Row[]) {
          const existing = onConflict ? rows.find((r) => onConflict.every((key) => r[key] === row[key])) : undefined
          if (existing) Object.assign(existing, row)
          else rows.push({ ...row })
          written.push(existing ?? rows[rows.length - 1])
        }
        return json(written.map((row) => pick(row, select)), 201)
      }
      throw new Error('unexpected method')
    },
  }
  return state
}
