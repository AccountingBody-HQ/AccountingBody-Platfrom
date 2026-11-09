import { NextResponse } from 'next/server'

// Identifies the code this deployment is running, so a release or a rollback
// can be confirmed in the browser. The values are set by the hosting platform
// for each deployment; locally and in CI they are unset and the answer is null.
// Read on every request and never cached, so the answer always belongs to the
// deployment that is serving it.
export const dynamic = 'force-dynamic'

const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]+$/
const ENVIRONMENTS = ['production', 'preview', 'development']

// A value is shown only when it has the expected shape; anything else is null.
function shaped(value: string | undefined, isExpected: (value: string) => boolean): string | null {
  return value && isExpected(value) ? value : null
}

export function GET() {
  const commit = shaped(process.env.VERCEL_GIT_COMMIT_SHA, (value) => COMMIT_PATTERN.test(value))
  const environment = shaped(process.env.VERCEL_ENV, (value) => ENVIRONMENTS.includes(value))
  const deployment = shaped(process.env.VERCEL_DEPLOYMENT_ID, (value) => DEPLOYMENT_PATTERN.test(value))

  return NextResponse.json(
    {
      commit,
      commitShort: commit ? commit.slice(0, 7) : null,
      environment,
      deployment,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
