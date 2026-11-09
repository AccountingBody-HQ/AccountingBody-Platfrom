// How admin screens call admin API routes. Used in place of fetch: the result
// has the same ok, status and json() a screen already reads, and ok is true only
// for a real success. Runs in the browser; it imports nothing from the server.

export const ADMIN_SIGNED_OUT_EVENT = 'admin-signed-out'

const SIGNED_OUT_ERROR = 'Signed out'
const TEXT_SNIPPET_LENGTH = 200

export type AdminFetchOptions = {
  // 'file' is for routes that answer with a download rather than JSON.
  expect?: 'json' | 'file'
}

export type AdminResponse = {
  ok: boolean
  status: number
  signedOut: boolean
  error: string | null
  // The JSON body. On a failure this is always an object with an error string.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same type as Response.json()
  json(): Promise<any>
  blob(): Promise<Blob>
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSignInAddress(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('-login')
  } catch {
    return false
  }
}

function succeeded(status: number, body: unknown, file: Blob | null): AdminResponse {
  return {
    ok: true,
    status,
    signedOut: false,
    error: null,
    json: async () => body,
    blob: async () => {
      if (!file) throw new Error('This response is not a file')
      return file
    },
  }
}

function failed(status: number, error: string, signedOut: boolean, body?: unknown): AdminResponse {
  return {
    ok: false,
    status,
    signedOut,
    error,
    json: async () => (isRecord(body) ? { ...body, error } : { error }),
    blob: async () => {
      throw new Error(error)
    },
  }
}

function signedOut(status: number): AdminResponse {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ADMIN_SIGNED_OUT_EVENT))
  }
  return failed(status, SIGNED_OUT_ERROR, true)
}

function failureMessage(status: number, contentType: string, text: string, body: unknown): string {
  if (isRecord(body) && typeof body.error === 'string' && body.error) return body.error
  const isPlainText = body === undefined && !contentType.includes('html')
  return (isPlainText && text.trim().slice(0, TEXT_SNIPPET_LENGTH)) || `Request failed (${status})`
}

// A network failure rejects, as it does with fetch.
export async function adminFetch(
  input: string,
  init?: RequestInit,
  { expect = 'json' }: AdminFetchOptions = {},
): Promise<AdminResponse> {
  const res = await fetch(input, init)
  const contentType = res.headers.get('content-type') ?? ''
  const isHtml = contentType.includes('html')

  if (res.status === 401 || (res.redirected && isSignInAddress(res.url)) || (res.ok && isHtml)) {
    return signedOut(res.status)
  }

  if (expect === 'file' && res.ok && !contentType.includes('json')) {
    return succeeded(res.status, undefined, await res.blob())
  }

  const text = await res.text()
  const body = parseJson(text)
  if (expect === 'json' && res.ok && body !== undefined) {
    return succeeded(res.status, body, null)
  }
  return failed(res.status, failureMessage(res.status, contentType, text, body), false, body)
}
