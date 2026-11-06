import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminPath, isAdminSessionValid, sha256Hex } from './middleware-logic'

export { sha256Hex }

export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

// Server pages and layouts in the admin area call this first. Middleware is a
// separate layer; each page checks the session for itself.
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const signedIn = await isAdminSessionValid(token, process.env.ADMIN_SECRET)
  if (!signedIn) {
    redirect('/' + getAdminPath() + '-login')
  }
}
