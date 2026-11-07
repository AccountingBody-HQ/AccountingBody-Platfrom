# Alerts

How the site tells us that a scheduled job needs a look. Meant to sit beside
the runbook; the same text can be moved into it.

## The job status address

`GET /api/ops-status` answers whether the scheduled jobs have done their work
recently. It is read fresh on every request and never cached.

```json
{ "status": "ok", "checks": { "job-import": "ok", "job-expiry": "ok", "subscriber-cleanup": "ok", "saved-jobs-cleanup": "ok" } }
```

- HTTP 200, `"status": "ok"`: every alerting check is fine.
- HTTP 503, `"status": "attention"`: at least one alerting check is not `ok`.
- HTTP 503 with `"checks": {}`: the status check itself could not run (a
  problem report is sent to Sentry).

Words for each check:

| Word | Meaning |
|---|---|
| `ok` | The job has done its work recently. |
| `late` | The job has not done its work within its time allowance. |
| `failing` | The job ran within its time allowance and every run failed. |
| `unknown` | The status could not be read from the database. |

| Check | Job | Schedule (UTC) | `late` after | Alerting |
|---|---|---|---|---|
| `job-import` | job import (scheduled runs only) | every 15 min, each source at its own interval | no completed run for 26 h | yes |
| `job-expiry` | job expiry | daily 06:00 | an active listing 26 h past its end date | no (shown only) |
| `subscriber-cleanup` | unconfirmed subscriber clean-up | daily 06:30 | an unconfirmed sign-up 7 days + 26 h old | yes |
| `saved-jobs-cleanup` | saved jobs clean-up | daily 07:00 | a saved job unused for 7 days + 26 h | yes |

A check that is not alerting is shown in the answer but never turns it to 503.
`job-expiry` is shown only for now; to make it alert, set `alerting: true` for
it in `lib/ops-status.ts`.

## Adding the monitor (owner step)

In UptimeRobot: **Add New Monitor** → type **HTTP(s)** → URL
`https://accountingbody.com/api/ops-status` → interval **5 minutes** → alert
contact: your email. An alert means the address answered something other
than 2xx (503 = attention) or did not answer at all.

Before switching it on, open the address in a browser once: it should show
`"status": "ok"`. If not, follow the steps below first.

## What to do

Open `https://accountingbody.com/api/ops-status` to see which check is not `ok`.

- `job-import` `late`: no scheduled import has completed for a day. In Vercel,
  check the cron runs for the import schedule (Settings → Cron Jobs) and the
  function logs; in the admin providers page, check whether sources are
  paused.
- `job-import` `failing`: imports run but all fail. Check the providers page
  for the latest error of each source and the Sentry issues for the import.
- `subscriber-cleanup` or `saved-jobs-cleanup` `late`: the daily clean-up has
  not removed rows that are due. Check that day's cron run in Vercel and its
  function log.
- `job-expiry` `late` (not alerting): listings past their end date are still
  active. Check the expiry cron run and its log.
- Any check `unknown`, or `"checks": {}`: the database could not be read.
  Check `/api/health`, the Supabase status page and Sentry.

The monitor recovers by itself once every alerting check is `ok` again.
