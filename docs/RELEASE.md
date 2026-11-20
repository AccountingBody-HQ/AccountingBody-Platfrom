# Release and rollback guide

How a change goes live on accountingbody.com and ethiotax.com, and how to undo it. Read [`CLAUDE.md`](../CLAUDE.md) first: it lists the checks every change must pass and the things that must not change without the owner's approval.

Backups and restores are covered in [`docs/RUNBOOK.md`](RUNBOOK.md).

A release is one pull request merged into `main`. Vercel deploys `main` to production automatically. ethiotax.com is served through a Cloudflare Worker that fetches accountingbody.com, so every release reaches both sites.

## Which code is live

Open `/api/version` on either site, for example `https://accountingbody.com/api/version`. It answers with:

| Field | Meaning |
|---|---|
| `commit` | The full commit the deployment was built from |
| `commitShort` | The first 7 characters of that commit, as GitHub shows it |
| `environment` | `production` or `preview` |
| `deployment` | The Vercel deployment id, as shown on the deployment's page in Vercel |

It is never cached. A field shows `null` when the value is not available, for example when running locally.

## Before a release

All of these must be true:

1. The pull request's CI run is green.
2. Vercel has built a preview of the branch.
3. The preview has been checked, and `/api/version` on the preview shows the branch's latest commit. Under the owner's hands-free arrangement Claude Code does this check itself (see "Hands-free checks" below); otherwise the owner checks it against the private test plan.
4. Nothing in the release changes the database. A database change is never part of an ordinary release: it needs a fresh backup and the owner's approval of the exact change, as a separate step.
5. Any new environment variable the release needs is already set in Vercel (see "Secrets and releases").
6. You know which deployment is in production now: its commit and its Vercel deployment id (from `/api/version`, or from the GitHub deployments list). Write both down before merging; that is what an undo returns to.

## Release steps

1. Merge the pull request into `main`. Merging is the release: Vercel puts it into production within about 2–5 minutes.
2. Wait for Vercel to finish the production deployment (Vercel → project → Deployments; the newest production deployment shows "Ready").
3. Purge the Vercel cache if the release changes cached pages, and purge the Cloudflare cache for ethiotax.com. Purges are done by the owner, never by a script.
4. Check both sites: the home page and one job page on accountingbody.com, and the same on ethiotax.com.
5. Open `/api/version` on both sites and confirm that `commitShort` matches the merged commit and `environment` is `production`.

If any check fails, undo the release (next section) before investigating.

## Hands-free checks (Claude Code)

When the owner's hands-free arrangement applies, Claude Code runs the preview and production checks itself:

- Preview and production deployment addresses (`*.vercel.app`) are behind Vercel Deployment Protection. Claude Code passes it with the Vercel "Protection Bypass for Automation" secret, available in the Codespace as `VERCEL_AUTOMATION_BYPASS_SECRET`. It is sent only as the `x-vercel-protection-bypass` request header, read from standard input (`printf 'x-vercel-protection-bypass: %s\n' "$VERCEL_AUTOMATION_BYPASS_SECRET" | curl -sS -H @- …`). Never print, log or commit any part of it.
- Checks on the preview, and after the merge on the new production deployment: `/api/version` shows the expected commit; `/jobs/listings` returns 200, and also with the header `x-et-platform: ethiotax` (the ethiotax.com view); `/api/jobs/direct?platform=ab&limit=20&offset=0` and `platform=et` return 200 with a total; plus any page the change touches. The "jobs found" text on the page is drawn in the browser, so use the `/api/jobs/direct` totals.
- Production proof after a merge: the GitHub deployments for the merge commit (`gh api repos/AccountingBody-HQ/AccountingBody-Platfrom/deployments?sha=<merge commit>`) show a Production deployment whose latest status is success; then the rows above on that deployment's address.
- Scripts never request accountingbody.com or ethiotax.com directly. The bot protection answers them with a challenge, which is correct; never weaken it to make a script pass. The owner can look at the two sites in a browser.
- One dated exception: a brief for the EthioTax proxy tidy-up may allow GET-only checks of public `ethiotax.com` addresses, as `docs/AGENT-RULES.md` (Secrets) describes. In practice the bot protection challenges those scripts too, so proofs of proxy changes come from the owner's browser.
- Owner only, never by script: Instant Rollback, Promote, cache purges, Vercel, Cloudflare and Supabase settings, and environment variables.

## Undo

Target: back on the previous version within 10 minutes.

1. Vercel → project → Deployments.
2. Find the previous production deployment (the one noted before the release).
3. Open its menu and choose **Instant Rollback**, then confirm. Never use Promote or Redeploy on any other old deployment.
4. Open `/api/version` on both sites and confirm that `commitShort` shows the previous commit. Purge the Cloudflare cache for ethiotax.com if it still shows the new one.
5. Check both sites' home page and one job page again.
6. Then decide whether to keep the change out for good. If so, undo it in the code with `git revert` of the merge commit, through a new pull request that follows this same guide.

While a rollback is in place, Vercel does not automatically put later merges into production. After the fix is merged, promote its deployment in Vercel so automatic deploys resume.

A rollback restores the old code only. It never undoes a database change.

## Secrets and releases

- If a release needs a new environment variable, add it in Vercel (Settings → Environment Variables) **before** merging. Add its name, never its value, to `.env.example` in the same pull request.
- An environment variable change takes effect only on the next deployment. Set it just before a release merges, or the owner redeploys the deployment that is Production now (Vercel → Deployments → that row → ⋯ → Redeploy). Never redeploy or promote an older row.
- Changing a secret's value in Vercel takes effect only after a redeploy. After the redeploy, `/api/version` shows a new `deployment` with the same `commit`.
- Secret values never go in the repository, a pull request, a commit message or a report.

## Record

After every release or undo, write in the owner's control documents:

- the commit (`commitShort`) now in production;
- the date and time;
- how to undo it (the previous production deployment, and its commit).
