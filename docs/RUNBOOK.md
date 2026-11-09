# AccountingBody: Runbook

## 1. Backups

AccountingBody runs on Supabase's Free plan, which keeps **no backups for you**. This backup is the safety net.

**Status: built; first run and restore rehearsal not yet done.** Nothing here has run against the real database yet. The scripts have been proven on throwaway local copies of Supabase's Postgres, with made-up data only: backup and restore both worked, and a restored copy matched exactly. That did not test the Session pooler, the real Storage service, GitHub, or the real data. **This backup is not proven until a real one has been restored.** Update this line after the first run and after the first rehearsal.

One backup is **one encrypted file**. It holds:

- every project area of the database: `public` (articles, practice questions, courses, jobs, recruitment and contact submissions, subscribers, and the rest), plus the archived areas `hrlake`, `birrbank`, `ab` and `et`, and any new project area that appears;
- Supabase sign-in records (none today) and stored files and their records (none today);
- the list of extensions, and the definitions of the scheduled database jobs (pg_cron);
- a manifest (what is in the backup, with row counts) and checksums.

It contains personal data, so it is locked with a passphrase. The backup only **reads** the database and never changes anything there.

**How it connects:** through Supabase's **Session pooler** (port 5432, user `postgres.<PROJECT-REF>`), always over a secure connection. It uses one connection at a time, with no parallel copying and no retry loops. If a table stays locked for more than 2 minutes the run stops rather than holding up the site. Do not run a database migration during a backup.

### 1a. What runs, and when

- **At 02:17 UTC on the 1st and 15th of each month**, GitHub runs the workflow **"AccountingBody backup"** (`.github/workflows/backup.yml`), on `main` only. GitHub can start a scheduled run hours late. It never starts on a push or a pull request.
- After making the file, it **checks it** (the self-check): it opens the file again with the passphrase, checks that every part and every checksum is there and matches, then deletes the opened copy. If anything is wrong, the run fails and keeps nothing.
- It keeps **only the encrypted file and its `.sha256` fingerprint** on GitHub for **90 days**, under the run's **Artifacts**. Nothing unencrypted is uploaded, and the run's log names no table, file or count.
- Nothing reminds you it ran. **Look at GitHub → Actions → AccountingBody backup after each date.**

### 1b. The three secrets (set up once)

They live in GitHub: the code repository → **Settings → Environments → backup → Environment secrets → Add environment secret**. GitHub never shows a secret again after you save it, and the workflow never prints them.

| Name (exactly) | What goes in it |
|---|---|
| `AB_BACKUP_DB_URL` | The connection line (format below). |
| `AB_BACKUP_SERVICE_ROLE_KEY` | A secret API key from Supabase → **Project Settings → API Keys**. Use the legacy **service_role** key if the page shows one; otherwise use a **secret key** (it starts `sb_secret_`). The publishable and anon keys are refused. |
| `AB_BACKUP_PASSPHRASE` | Your **backup passphrase**: 64 random letters and numbers. The script refuses anything under 32 characters. The repository is public, so anyone signed in to GitHub can download the encrypted file and try to guess this. Never use words you chose yourself. |

**The connection line format** (one line, no spaces):

```
postgresql://postgres.<PROJECT-REF>:<PASSWORD-URL-ENCODED>@<POOLER-HOST>:5432/postgres?sslmode=require
```

Copy `<POOLER-HOST>` from Supabase → **Connect** → **Session pooler**. It ends in `.pooler.supabase.com`. Replace each placeholder, including its `<` and `>`.

- **Encoding the password.** A password of only letters and numbers needs nothing, and is the simplest choice. Otherwise write these characters as: `%` → `%25` (the one that matters most), `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`, `?` → `%3F`, `&` → `%26`, `+` → `%2B`, space → `%20`, `[` `]` → `%5B` `%5D`.
- **Never paste the password, the connection line or the passphrase into a chat**, not even to your developer or assistant.
- **The passphrase can never be recovered.** Without it, nobody can ever open a backup. If you change it, older backups still need the old one, so keep both.
- **Network restrictions:** Supabase → **Database → Settings → Network restrictions** must allow all addresses, because GitHub's machines change.
- If a secret is missing, the run stops at its first step with a message naming all three.

### 1c. Run it by hand

1. GitHub → the repository → **Actions** → **AccountingBody backup** (left-hand list).
2. **Run workflow** (right) → keep **Branch: main** → the green **Run workflow** button.
3. A green tick means it worked; a red cross means it failed (1e). Press it **once**: repeated wrong passwords can make Supabase block connections for a while.

Check Supabase's Disk IO chart first. A backup reads nearly every table, so do not run one while the Disk IO budget is low.

You can also run it from a Codespace terminal on `main`: `bash scripts/backup-supabase.sh`. It asks for everything at hidden prompts. Then download the files from `backups/` and delete them from the Codespace.

### 1d. Download a backup and keep it

1. GitHub → **Actions** → **AccountingBody backup** → click the run (green tick).
2. Scroll to **Artifacts** → click **accountingbody-backup-<date>**. A `.zip` downloads, holding the `.tar.gz.enc` file and its `.sha256`.
3. Keep **one copy per month** in a private folder on your computer **and in a second private place**. GitHub deletes each file after 90 days.
4. To check a downloaded file opens, in a Codespace with PostgreSQL tools: put both files in `backups/`, then run `bash scripts/backup-supabase.sh --check backups/<the file>.tar.gz.enc` and type the passphrase. It ends "Self-check passed…".
5. `backups/` is never committed to git. Delete any copy in a Codespace afterwards: `rm backups/accountingbody-backup-*`.

### 1e. When a run fails

Open the run: the red step's message says what went wrong in plain words. A failed run keeps nothing. GitHub may email you about a failure, but no email does not prove success, so check Actions. GitHub switches scheduled workflows off in a public repository after 60 days with no new commits; the Actions page then shows a button to switch it back on.

| Message | What to do |
|---|---|
| Backup not set up: add the secrets… | Add the missing secret (1b). |
| AB_BACKUP_DB_URL is not quite right | Each line names the wrong part. Build the line again (1b) and update the secret. |
| The database refused the password… | The address and user are fine; only the password is wrong. Reset it in Supabase (Project Settings → Database), wait 5 minutes, update `AB_BACKUP_DB_URL`, then run it **once**. |
| Supabase has paused new connections… | Too many failed attempts. Do nothing for about 30 minutes. Check the password in the secret, then run it **once**. |
| Supabase does not recognise the project or user… | The user part must be `postgres.<PROJECT-REF>`. Build the line again. |
| The database address could not be found… | The part after `@` is mistyped. Copy the host again. |
| The database could not be reached from this machine (network)… | Check Network restrictions (1b), and that you used the Session pooler, port 5432. |
| The secure connection could not be set up. | Run it again later. If it repeats, send the Details line to your developer. |
| The database has too many open connections right now… | Wait a few minutes and run it again. |
| Supabase refused the connection because the project is paused or restricted… | Open the project in Supabase, check it is active, then run it again. |
| The database closed the connection straight away… | The project may be restarting or paused. Check it, then run it again. |
| Reason from the database: … | Something less common. Send that line to your developer. |
| AB_BACKUP_SERVICE_ROLE_KEY: it is the… key | You saved a public key. Use the secret key (1b). |
| the project address or the secret API key was not accepted by Storage | The password worked, but the key did not. Copy it again and update the secret. If you used an `sb_secret_` key, try the legacy service_role key if the page shows one. |
| AB_BACKUP_PASSPHRASE is shorter than 32 characters | Use a longer one (1b). |
| an area of the project's own database could not be read | A project area has a permission problem, and the backup refuses to skip it. Run the backup by hand (1c) to see which, then send that to your developer. |
| `pg_dump: error…` | Part of the copy was refused, or a table stayed locked past the 2-minute limit. Check no migration was running, then run it once more. If it repeats, send that line to your developer; it holds no password. |
| self-check… | Run it once more. If it repeats, send the line to your developer. |

**Yellow warning, "found a database area it does not recognise":** the backup is good. Supabase may have added a new area of its own. Tell your developer. To see which area, check the backup's `manifest.json`, under `schemas_other` (saved separately, not restored automatically) and `schemas_skipped` (could not be read, not saved). If it is really a project area, the script's list needs updating.

### 1f. Which database areas are left out, and why

The backup finds the areas when it runs, so a new project area is picked up by itself. It leaves out Supabase's own areas:

<!-- managed-schemas -->
`information_schema` `auth` `storage` `realtime` `vault` `cron` `extensions` `graphql` `graphql_public` `net` `pgsodium` `pgsodium_masks` `supabase_functions` `supabase_migrations` `_realtime` `_supavisor` `pgbouncer` `_analytics` `pgmq` `pgmq_public` `pgtle` `dbdev` `repack` `tiger` `tiger_data` `topology`

Also left out: any name starting `pg_` or `supabase_`, and any area owned by an extension. `auth` data, `storage` records and `cron` job definitions are saved by their own steps. The manifest lists every managed area it found, under `schemas_managed_present`.

**What a backup cannot bring back:**
- Supabase dashboard settings: Auth settings, API keys, the API's exposed-schemas list, Storage settings.
- Vercel settings and environment variables.
- Anything added after the backup was taken.
- Database roles (only their names are recorded), realtime publications, and any rules someone added directly on `storage` or other managed areas.
- `vault` secrets (none today), and `pgmq` queues if Queues is ever switched on.

### 1g. Restoring

Restoring **replaces data**. **Talk it through with your developer first**: most problems are fixed forward, not by a restore. Neither restore route has been rehearsed yet.

**A restore that stops partway cannot simply be run again.** The target must be empty before you retry: delete the hosted project and create a new one, or reset the local copy. A wrong passphrase or a mistyped phrase is different: those stop before anything changes, so you can simply try again.

**A rehearsal or a real recovery into a new project (preferred):**

1. Create a new, empty Supabase project in the same region. A rehearsal holds real personal data, so do it in one sitting and always delete the project and the files afterwards.
2. On a machine with PostgreSQL tools **at least as new as the backup's**, put the `.tar.gz.enc` and `.sha256` files in `backups/`, then run:
   ```bash
   bash scripts/restore-supabase.sh backups/<the file>.tar.gz.enc
   ```
3. Answer: the backup passphrase; the new project's Session pooler string (with `[YOUR-PASSWORD]` left in); its database password; its secret API key.
4. It must end with "Every table's rows, every bucket's files and bytes, and a sample of files byte for byte match the backup." Many `NOTICE` lines before that are normal.
5. **Read any extension failures it lists.** Each extension is created separately, so one failure does not stop the rest, and every failure is named. An extension the project does not need can be ignored. If tables need it, the restore will have stopped with an error.
6. **Scheduled jobs are never recreated by the restore.** It prints where the saved definitions are and how to recreate them. Do this **only on a real recovery, never on a rehearsal**: these jobs delete rows on a schedule.
7. On a real recovery, point the site at the new project in Vercel's environment variables and redeploy. Copy the dashboard settings across by hand (1f).

**Over the live project (a last resort):**

Restoring over live replaces ALL of AccountingBody's and EthioTax's data and every archived area (`hrlake`, `birrbank`, `ab`, `et`). Everything added since the backup was taken is lost. Take a fresh backup first.

The script refuses the live project unless you type `RESTORE OVER LIVE ACCOUNTINGBODY` exactly. Any target already holding data also needs `REPLACE ALL DATA IN TARGET` typed exactly.

**What the restore empties on the target:** every area it is about to restore, and `auth.users`. Nothing else. If emptying would also remove anything outside those areas, it stops with nothing changed.

### 1h. Switch-on checklist (AB-P0-5d)

Do this once, in this order, in one sitting if you can. Never paste a password, key or passphrase into a chat, a file or a commit.

0. **Look first; change nothing.** In Supabase, confirm all three: the usage page shows the new billing cycle (after the 8th); Disk IO is healthy; at least 2.5 GB of the month's egress is left (a cycle can hold three runs — the manual run plus two scheduled — at up to 0.7 GB each). One backup run uses about 0.16 to 0.33 GB, and you should plan for up to 0.7 GB. If any of the three is not true, stop and pick another day.
1. **Put the backup on `main`.** At a quiet time, push the branch, wait for CI to go green, then merge to `main`. The schedule goes live at the merge: the next automatic run is the next 1st or 15th at 02:17 UTC. A run that starts before the secrets are in place stops at its first step ("Backup not set up") and touches nothing.
2. **Create the GitHub Environment.** The code repository → **Settings → Environments → New environment** → name it `backup` exactly. Under **Deployment branches and tags**, choose **Selected branches and tags**, add the rule `main`, and save. Add no required reviewers: they would hold up the scheduled runs. If `backup` is already listed, open it and set the same rule.
3. **Reset the database password.** Supabase → **Project Settings → Database → Reset database password**. Use letters and numbers only, and save it in your private password store first. Wait 5 minutes before step 9.
4. **Build the connection line.** Get `<POOLER-HOST>` from Supabase → **Connect** → **Session pooler**, then replace each placeholder, including its `<` and `>`. A password of only letters and numbers needs no encoding.
   ```
   postgresql://postgres.sydiwnburwxutuuvkcjt:<PASSWORD-URL-ENCODED>@<POOLER-HOST>:5432/postgres?sslmode=require
   ```
5. **Create the passphrase.** Follow 1i.
6. **Choose the secret API key.** Use the legacy **service_role** key for now. A secret key (it starts `sb_secret_`) is the long-term choice: swap to one before the end of 2026 by updating `AB_BACKUP_SERVICE_ROLE_KEY` in the `backup` Environment.
7. **Add the three secrets to the `backup` Environment.** The code repository → **Settings → Environments → backup → Environment secrets**. Use the names in 1b, and the key from step 6. These must be **Environment secrets, not repository secrets**.
8. **Check Network restrictions.** Supabase → **Database → Settings → Network restrictions** must allow all addresses, because GitHub's machines change address.
9. **Run it once by hand.** GitHub → **Actions → AccountingBody backup → Run workflow** (see 1c), **once**. Check it succeeded, and note how long it took and the size of the encrypted file. The next day, note Supabase's egress and Disk IO.
10. **Record the result** in the control documents.

### 1i. Creating and storing the passphrase

1. Open a separate terminal tab.
2. Run `openssl rand -hex 32`. It prints 64 hex characters: that is your passphrase.
3. Save it in **two** private places, for example your private password store and a private offline note.
4. Run `clear`.
5. Close the tab.

Never reuse it anywhere, and never paste it into a chat, a file or a commit. **Why so strict (A2-18):** the repository is public, so any signed-in GitHub user can download the encrypted files, and only this passphrase protects them. **If you lose it, the backups can never be opened.**

### 1j. Confirming backups keep running

1. Add calendar reminders for the **2nd and 16th of each month**.
2. On each reminder, open GitHub → **Actions → AccountingBody backup** and check the last run succeeded.
3. GitHub pauses scheduled workflows after 60 days with no repository activity (A3-11). If it has paused this one, re-enable it from the Actions tab.

A heartbeat service could automate this check later. None is set up.
