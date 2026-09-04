import { NextRequest, NextResponse } from 'next/server'
import { getExpiringJobs, expireJob } from '@/lib/jobs'
import { sendJobExpiredEmail, sendJobExpiryWarningEmail } from '@/lib/jobEmails'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/expire-jobs: CRON_SECRET not set — running unauthenticated (dev mode)')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Only warn once per listing: a job's 60-day window means "expiring within
// 7 days" is true for 7 consecutive daily cron runs. Narrowing to the
// 6–7 day band means the warning condition is true on exactly one of those
// runs (assuming the cron fires roughly once every 24h).
function isInWarningWindow(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const daysUntilExpiry = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry > 6 && daysUntilExpiry <= 7
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let expired = 0
  let warned = 0

  try {
    // 1 & 2. Expire jobs already past their expiry, notify each employer.
    const pastDue = await getExpiringJobs(0)
    for (const job of pastDue) {
      try {
        await expireJob(job.id)
        expired += 1
        try {
          await sendJobExpiredEmail(job)
        } catch (emailErr: unknown) {
          console.error('cron/expire-jobs: expiry email failed (non-fatal):', job.id, emailErr)
        }
      } catch (err: unknown) {
        console.error('cron/expire-jobs: failed to expire job', job.id, err)
      }
    }

    // 3 & 4. Warn employers of listings expiring within 7 days — only ones
    // that have had at least one impression, and only once (6-7 day band).
    const expiringSoon = await getExpiringJobs(7)
    for (const job of expiringSoon) {
      if (job.impression_count <= 0) continue
      if (!isInWarningWindow(job.expires_at)) continue
      try {
        await sendJobExpiryWarningEmail(job, job.manage_token ?? '')
        warned += 1
      } catch (emailErr: unknown) {
        console.error('cron/expire-jobs: warning email failed (non-fatal):', job.id, emailErr)
      }
    }

    return NextResponse.json({ expired, warned })
  } catch (err: unknown) {
    console.error('cron/expire-jobs: fatal error', err)
    return NextResponse.json({ error: 'Cron run failed', expired, warned }, { status: 500 })
  }
}
