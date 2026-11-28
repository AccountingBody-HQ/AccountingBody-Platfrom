// A read-only stand-in for the supabase-js client, for the Content Studio's
// tests. It offers select, eq, order, limit, maybeSingle and range only: no
// insert, update or delete, so a write would fail the test.

type Row = Record<string, unknown>

export interface FakeDb {
  tables: Record<string, Row[]>
  /** Tables whose reads fail. */
  failing: Set<string>
  /** Every read, as "table:select". */
  reads: string[]
}

export function fakeDb(tables: Record<string, Row[]> = {}): FakeDb {
  return { tables, failing: new Set(), reads: [] }
}

const FAILED = { message: 'invented failure', code: 'XX000' }

class Query {
  private filters: [string, unknown][] = []
  private cap: number | null = null
  constructor(private db: FakeDb, private table: string, private columns: string) {
    db.reads.push(`${table}:${columns}`)
  }
  eq(column: string, value: unknown): this {
    this.filters.push([column, value])
    return this
  }
  order(): this {
    return this
  }
  limit(n: number): this {
    this.cap = n
    return this
  }
  private rows(): Row[] {
    const rows = (this.db.tables[this.table] ?? []).filter(r => this.filters.every(([c, v]) => r[c] === v))
    return this.cap === null ? rows : rows.slice(0, this.cap)
  }
  private pick(row: Row): Row {
    const out: Row = {}
    for (const c of this.columns.split(',').map(s => s.trim())) out[c] = row[c] ?? null
    return out
  }
  async maybeSingle(): Promise<{ data: Row | null; error: typeof FAILED | null }> {
    if (this.db.failing.has(this.table)) return { data: null, error: FAILED }
    const first = this.rows()[0]
    return { data: first ? this.pick(first) : null, error: null }
  }
  async range(from: number, to: number): Promise<{ data: Row[] | null; error: typeof FAILED | null; count: number | null }> {
    if (this.db.failing.has(this.table)) return { data: null, error: FAILED, count: null }
    const rows = this.rows()
    return { data: rows.slice(from, to + 1).map(r => this.pick(r)), error: null, count: rows.length }
  }
}

export function fakeClient(db: FakeDb) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return new Query(db, table, columns)
        },
      }
    },
  }
}
