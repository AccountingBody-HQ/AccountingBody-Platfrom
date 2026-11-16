# Backup scripts

This folder holds the database backup and restore scripts, and nothing else. Step-by-step instructions are in `docs/RUNBOOK.md` section 1.

## The three files

### `backup-supabase.sh`
Makes one encrypted backup file of every project area of the database and any stored files. It only reads from the project.

    bash scripts/backup-supabase.sh

To check that a backup file opens and is complete:

    bash scripts/backup-supabase.sh --check backups/<file>.tar.gz.enc

### `restore-supabase.sh`
Puts a backup made by `backup-supabase.sh` into a target project: a new empty project, or a local copy for a rehearsal. Restoring over the live project is a last resort, only after talking it through (`docs/RUNBOOK.md` section 1).

    bash scripts/restore-supabase.sh backups/<file>.tar.gz.enc

### `lib/backup-connect.sh`
Shared helpers loaded by both scripts: plain-English reasons when a connection fails, removal of secrets from anything printed, shape checks on the settings, the rules for which database areas are backed up, and the row counter. It is not run on its own.

## How the backup workflow uses them

The "AccountingBody backup" GitHub Actions workflow (`.github/workflows/backup.yml`) runs `bash scripts/backup-supabase.sh` on a schedule. When its settings are present it runs without prompts, and its output names no table, file or count. Run from a Codespace terminal, the script asks for everything at hidden prompts instead.

## Retired scripts

The old WordPress and Sanity migration scripts, their logs and other one-off scripts were retired on 16 Nov 2026. They remain in git history.
