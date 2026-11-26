// A small in-memory stand-in for the supabase-js query builder, for tests
// that replace getServerSupabase. It understands only what the mock-exam
// reads use: select (with an exact count), eq, contains, not(col, 'is',
// null), in, order on one column, and range. Every query is recorded. A test
// may make a query fail (failWhen) or answer fewer rows than asked for
// (maxRows, like the database's row cap).

export type Row = Record<string, unknown>

export interface QueryCall {
  table: string
  columns: string
  exactCount: boolean
  filters: string[]
  range: [number, number] | null
}

export interface FakeDb {
  tables: Record<string, Row[]>
  calls: QueryCall[]
  failWhen: ((call: QueryCall) => boolean) | null
  // At most this many rows in one answer, whatever range was asked for.
  maxRows: number | null
  // Rows to drop from one answer (a short page that still claims the total).
  dropRows: ((call: QueryCall) => number) | null
  client: { from: (table: string) => unknown }
}

export const FAKE_QUERY_PROBLEM = { code: 'XX000', message: 'seed problem text 4q' }

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const left = String(a)
  const right = String(b)
  return left < right ? -1 : left > right ? 1 : 0
}

export function fakeDb(tables: Record<string, Row[]>): FakeDb {
  const db: FakeDb = { tables, calls: [], failWhen: null, maxRows: null, dropRows: null, client: { from: () => null } }

  db.client = {
    from(table: string) {
      const call: QueryCall = { table, columns: '*', exactCount: false, filters: [], range: null }
      const tests: ((row: Row) => boolean)[] = []
      let orderBy: { column: string; ascending: boolean } | null = null

      const run = () => {
        db.calls.push(call)
        if (db.failWhen?.(call)) return { data: null, error: { ...FAKE_QUERY_PROBLEM }, count: null }
        let rows = (db.tables[table] ?? []).filter((row) => tests.every((t) => t(row)))
        if (orderBy) {
          const { column, ascending } = orderBy
          rows = [...rows].sort((x, y) => (ascending ? 1 : -1) * compare(x[column], y[column]))
        }
        const total = rows.length
        if (call.range) rows = rows.slice(call.range[0], call.range[1] + 1)
        if (db.maxRows !== null) rows = rows.slice(0, db.maxRows)
        const drop = db.dropRows?.(call) ?? 0
        if (drop > 0) rows = rows.slice(0, Math.max(0, rows.length - drop))
        const names = call.columns.split(',').map((c) => c.trim())
        const data = rows.map((row) => {
          if (call.columns === '*') return { ...row }
          const out: Row = {}
          for (const name of names) out[name] = row[name]
          return out
        })
        return { data, error: null, count: call.exactCount ? total : null }
      }

      const builder = {
        select(columns: string, options?: { count?: string }) {
          call.columns = columns.replace(/\s+/g, '')
          call.exactCount = options?.count === 'exact'
          return builder
        },
        eq(column: string, value: unknown) {
          call.filters.push(`${column}=eq.${String(value)}`)
          tests.push((row) => row[column] === value)
          return builder
        },
        contains(column: string, values: unknown[]) {
          call.filters.push(`${column}=cs.${values.join(',')}`)
          tests.push((row) => Array.isArray(row[column]) && values.every((v) => (row[column] as unknown[]).includes(v)))
          return builder
        },
        not(column: string, operator: string, value: unknown) {
          if (operator !== 'is' || value !== null) throw new Error('fake query: only not(col, "is", null)')
          call.filters.push(`${column}=not.is.null`)
          tests.push((row) => row[column] !== null && row[column] !== undefined)
          return builder
        },
        in(column: string, values: unknown[]) {
          call.filters.push(`${column}=in.(${values.length})`)
          const set = new Set(values)
          tests.push((row) => set.has(row[column]))
          return builder
        },
        order(column: string, options?: { ascending?: boolean }) {
          orderBy = { column, ascending: options?.ascending !== false }
          return builder
        },
        range(from: number, to: number) {
          call.range = [from, to]
          return builder
        },
        then<T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) {
          try {
            return Promise.resolve(resolve(run()))
          } catch (e) {
            return reject ? Promise.resolve(reject(e)) : Promise.reject(e)
          }
        },
      }
      return builder
    },
  }
  return db
}
