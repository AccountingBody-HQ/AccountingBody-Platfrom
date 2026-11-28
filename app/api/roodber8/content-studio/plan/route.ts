import type { NextRequest } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { handlePlan } from '@/lib/content-studio/http'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return handlePlan(req)
}
