# AccountingBody Platform

The codebase behind [accountingbody.com](https://accountingbody.com) and [ethiotax.com](https://ethiotax.com): study content, practice questions, courses, calculators and a jobs board for accounting and tax professionals.

## Stack

- Next.js 14 App Router, React 18, TypeScript in strict mode
- Tailwind CSS
- Supabase (through supabase-js)
- Resend for email
- Sentry for error reporting
- Cloudflare Turnstile for bot checks
- Anthropic SDK for admin AI tools
- vitest for tests
- Vercel for hosting

## Prerequisites

- Node.js 24, the single version for local work, CI and hosting. It is defined in `.nvmrc` and `package.json` `engines`; CI reads `.nvmrc`.
- npm
- Access to the project's service accounts for real values

## Setup

```bash
npm ci
cp .env.example .env.local
```

Then fill in `.env.local` privately. It is git-ignored; never commit real values. Delete any line you do not use, because a blank value is not the same as an unset variable.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Builds for production |
| `npm run start` | Runs the production build |
| `npm run lint` | Runs `next lint` |
| `npm test` | Runs the tests once with vitest |

**Codespace warning:** the project's Codespace has too little memory for `npm run build`, which runs out of memory there. CI runs the production build, and Vercel builds a preview of each pushed branch. See `CLAUDE.md` for the exact checks to run in the Codespace.

## Tests

Tests sit beside the code they cover, as `*.test.ts`, and run without network access or real services.

```bash
npm test
```

CI runs lint, the type check, the tests and the production build on every push and pull request (`.github/workflows/ci.yml`). It uses placeholder configuration only, with no real secrets and no live services.

## Deployment

The site is hosted on Vercel. A branch gets a preview deployment; check the preview first. A push to `main` deploys to production.

## Project guide

Read [`CLAUDE.md`](CLAUDE.md) before making changes. It holds the codebase map, safety rules, conventions and how work is checked. Older numbered rules are listed in [`docs/RULES.md`](docs/RULES.md).

## Licence

MIT License. Copyright (c) 2026 AccountingBody-HQ. See [`LICENSE`](LICENSE).
