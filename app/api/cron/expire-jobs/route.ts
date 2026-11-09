import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { getExpiringJobs, expireJobsByIds } from '@/lib/jobs'
import { sendJobExpiredEmail, sendJobExpiryWarningEmail } from '@/lib/jobEmails'
import { reportServerError } from '@/lib/report-error'
import { RESET_END_MS, jobExpiryMaxPerRun, problemCode, reportableProblem, runJobExpiry, untilEnd } from '@/lib/job-expiry'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function getSupabase() {
  return getServerSupabase('cron')
}

function isAuthorised(req: NextRequest, secret: string): boolean {
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/expire-jobs: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!isAuthorised(req, secret)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let expired = 0
  let warned = 0

  try {
    // 1–4. Close jobs past their expiry and send the emails (lib/job-expiry.ts).
    // A page that cannot be read ends that step and the rest of the run goes
    // ahead; a group that cannot be closed ends the closing. Either way the
    // run then answers a failure.
    const run = await runJobExpiry({
      now: () => Date.now(),
      maxClosed: jobExpiryMaxPerRun(process.env.JOB_EXPIRY_MAX_PER_RUN),
      readPage: (step, page) =>
        step === 'expire' ? getExpiringJobs(0, page) : getExpiringJobs(7, { ...page, fromDays: 6, withImpressions: true }),
      closeIds: expireJobsByIds,
      sendExpired: (job) => sendJobExpiredEmail(job),
      sendWarning: (job) => sendJobExpiryWarningEmail(job, job.manage_token ?? ''),
    })
    expired = run.expired
    warned = run.warned
    if (run.closeFailed) console.error('cron/expire-jobs: failed to expire jobs', problemCode(run.problem), expired)
    if (run.emailCapReached) console.warn('cron/expire-jobs: email cap reached', run.emails)

    // 5. Reset daily job counters for all providers
    try {
      const { error: resetError } = await untilEnd(run.start + RESET_END_MS, () => Date.now(), async (signal) =>
        await getSupabase()
          .from('job_providers')
          .update({ jobs_today: 0 })
          .neq('id', '00000000-0000-0000-0000-000000000000')
          // .neq with a non-existent id effectively matches all rows
          // Use this pattern since Supabase requires a filter on update
          .abortSignal(signal),
      )
      if (resetError) {
        console.error('cron/expire-jobs: failed to reset jobs_today counters:', problemCode(resetError))
      }
    } catch (resetErr: unknown) {
      console.error('cron/expire-jobs: jobs_today reset threw:', problemCode(resetErr))
    }

    // Answered by the catch below: logged, reported once, status 500.
    if (run.failed) throw reportableProblem(run.problem)

    return NextResponse.json({ expired, warned, more: run.more })
  } catch (err: unknown) {
    console.error('cron/expire-jobs: fatal error', problemCode(err))
    reportServerError('job expiry run failed', err, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed', expired, warned }, { status: 500 })
  }
}
