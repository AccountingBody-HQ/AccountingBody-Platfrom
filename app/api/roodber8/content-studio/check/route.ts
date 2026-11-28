import type { NextRequest } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { handleCheck } from '@/lib/content-studio/http'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return handleCheck(req)
}
