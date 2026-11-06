import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SIGNED_OUT_BODY,
  ADMIN_SIGNED_OUT_INIT,
  getAdminPath,
  isAdminSessionValid,
} from './middleware-logic'

function isSessionValid(token: string | undefined): Promise<boolean> {
  return isAdminSessionValid(token, process.env.ADMIN_SESSION_SECRET, process.env.ADMIN_SECRET)
}

// Every admin API route calls this first.
export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  return isSessionValid(req.cookies.get(ADMIN_SESSION_COOKIE)?.value)
}

// What an admin API route answers when isAuthenticated() is false. It matches
// the answer middleware gives.
export function signedOutResponse(): NextResponse {
  return NextResponse.json(ADMIN_SIGNED_OUT_BODY, ADMIN_SIGNED_OUT_INIT)
}

// Server pages and layouts in the admin area call this first. Middleware is a
// separate layer; each page checks the session for itself.
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (!(await isSessionValid(cookieStore.get(ADMIN_SESSION_COOKIE)?.value))) {
    redirect('/' + getAdminPath() + '-login')
  }
}
