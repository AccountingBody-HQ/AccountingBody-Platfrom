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
3. The owner has checked the preview against the private test plan, and `/api/version` on the preview shows the branch's latest commit.
4. Nothing in the release changes the database. A database change is never part of an ordinary release: it needs a fresh backup and the owner's approval of the exact change, as a separate step.
5. Any new environment variable the release needs is already set in Vercel (see "Secrets and releases").
6. You know which deployment is in production now. Note its commit from `/api/version` on accountingbody.com; that is what an undo returns to.

## Release steps

1. Merge the pull request into `main`.
2. Wait for Vercel to finish the production deployment (Vercel → project → Deployments; the newest production deployment shows "Ready").
3. Purge the Vercel cache if the release changes cached pages, and purge the Cloudflare cache for ethiotax.com.
4. Check both sites: the home page and one job page on accountingbody.com, and the same on ethiotax.com.
5. Open `/api/version` on both sites and confirm that `commitShort` matches the merged commit and `environment` is `production`.

If any check fails, undo the release (next section) before investigating.

## Undo

Target: back on the previous version within 10 minutes.

1. Vercel → project → Deployments.
2. Find the previous production deployment (the one noted before the release).
3. Open its menu and choose **Instant Rollback**, then confirm.
4. Open `/api/version` on both sites and confirm that `commitShort` shows the previous commit. Purge the Cloudflare cache for ethiotax.com if it still shows the new one.
5. Check both sites' home page and one job page again.
6. Then decide whether to keep the change out for good. If so, undo it in the code with `git revert` of the merge commit, through a new pull request that follows this same guide.

While a rollback is in place, Vercel does not automatically put later merges into production. After the fix is merged, promote its deployment in Vercel so automatic deploys resume.

A rollback restores the old code only. It never undoes a database change.

## Secrets and releases

- If a release needs a new environment variable, add it in Vercel (Settings → Environment Variables) **before** merging. Add its name, never its value, to `.env.example` in the same pull request.
- Changing a secret's value in Vercel takes effect only after a redeploy. After the redeploy, `/api/version` shows a new `deployment` with the same `commit`.
- Secret values never go in the repository, a pull request, a commit message or a report.

## Record

After every release or undo, write in the owner's control documents:

- the commit (`commitShort`) now in production;
- the date and time;
- how to undo it (the previous production deployment, and its commit).
