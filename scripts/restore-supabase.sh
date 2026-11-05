#!/usr/bin/env bash
# AccountingBody restore (AB-P0-5): puts a backup made by scripts/backup-supabase.sh into a TARGET Supabase project:
# a NEW empty project or a local copy (for a rehearsal). Restoring over the live project is a last resort only after
# talking it through (docs/RUNBOOK.md section 1), and needs a typed phrase.
#
# Usage, from the repository root:   bash scripts/restore-supabase.sh backups/accountingbody-backup-<date>.tar.gz.enc
#
# What it does, in order: checks the file's checksum, decrypts it (passphrase at a hidden prompt) into a private
# temporary folder, checks every file inside and that this machine's tools can read the dumps, EMPTIES every database
# area it is about to restore (and auth.users) on the target and nothing else, creates each extension separately,
# restores any sign-in records, every area's tables and the project's auth trigger, re-uploads any stored files, then
# compares the target with the backup's manifest. The temporary folder is deleted at the end, whatever happens. Secrets
# are never printed or saved. It never schedules jobs: it prints where the saved definitions are.
#
# A RESTORE THAT STOPS PARTWAY CANNOT SIMPLY BE RUN AGAIN: the target needs to be empty before retrying (delete the
# hosted project and create a new one, or reset the local copy). A wrong passphrase or a mistyped phrase is different:
# those stop before anything changes, so you can simply try again.
set -euo pipefail
umask 077

LIVE_REF="sydiwnburwxutuuvkcjt"
LIVE_PHRASE="RESTORE OVER LIVE ACCOUNTINGBODY"
REPLACE_PHRASE="REPLACE ALL DATA IN TARGET"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/lib/backup-connect.sh
. "$ROOT/scripts/lib/backup-connect.sh"
ARCHIVE="${1:-}"
TMP=""
DB_URL=""
API_URL=""
SERVICE_KEY=""
CHANGING=0
FINISHED=0
EXTENSION_FAILURES=()

say() { printf '\n%s\n' "$*"; }
fail() { printf '\nThe restore STOPPED: %s\n' "$*" >&2; exit 1; }
report_extension_failures() {
  [ "${#EXTENSION_FAILURES[@]}" -gt 0 ] || return 0
  printf '\nThese extensions could NOT be created on the target (%s of them): %s\n' "${#EXTENSION_FAILURES[@]}" "${EXTENSION_FAILURES[*]}"
  printf 'Anything that depends on them may not work. Each one'"'"'s reason is printed above.\n'
}
cleanup() {
  unset PGPASSWORD SERVICE_KEY PASSPHRASE
  if [ -n "$TMP" ]; then rm -rf "$TMP"; fi
  if [ "$CHANGING" = 1 ] && [ "$FINISHED" != 1 ]; then
    report_extension_failures >&2
    printf '\nThe target may now be only partly restored. DO NOT run the restore again over it: make the target empty first\n' >&2
    printf '(delete the hosted project and create a new one, or reset the local copy). See docs/RUNBOOK.md section 1.\n' >&2
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

cat <<'BANNER'
==============================================================================
 AccountingBody restore
------------------------------------------------------------------------------
 Restores a backup into a TARGET project: a NEW empty Supabase project or a
 local copy (rehearsal). It REPLACES every database area it restores on that
 target (and its sign-in records).
 You need: the backup passphrase, and the TARGET's Session pooler string,
 database password and secret API key (typed at hidden prompts).
 Restoring over the LIVE project is refused unless you type a special phrase:
 read docs/RUNBOOK.md section 1 first.
 If a restore stops partway, the target must be emptied before you retry.
==============================================================================
BANNER

[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || fail "give the backup file, e.g.: bash scripts/restore-supabase.sh backups/accountingbody-backup-20261115-0217.tar.gz.enc"
for tool in curl jq openssl tar sha256sum; do
  command -v "$tool" >/dev/null || fail "the tool \"$tool\" is missing on this machine."
done
# psql and pg_restore come from the same, newest folder: a newer tool reads older dumps, never the reverse.
PG_BIN="$(newest_pg_bin)" || fail "the PostgreSQL tools (psql, pg_restore) are missing on this machine."
PSQL="$PG_BIN/psql"
[ -x "$PSQL" ] && [ -x "$PG_BIN/pg_restore" ] || fail "the PostgreSQL tools (psql, pg_restore) are missing on this machine."

# ---------------------------------------------------------------- 1. The file: checksum, passphrase, contents
if [ -f "$ARCHIVE.sha256" ]; then
  (cd "$(dirname "$ARCHIVE")" && sha256sum --quiet -c "$(basename "$ARCHIVE").sha256") || fail "the backup file is damaged (its checksum does not match). Nothing was restored."
  echo "Backup file checksum: OK"
else
  echo "Note: no .sha256 file next to the backup; the contents are still checked after decrypting."
fi
echo "Type the backup passphrase (nothing appears as you type), then press Enter:"
read -rs PASSPHRASE
echo
TMP="$(mktemp -d)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$ARCHIVE" -pass fd:3 3< <(printf '%s' "$PASSPHRASE") 2>/dev/null | tar -xzf - -C "$TMP" 2>/dev/null ||
  fail "the passphrase is wrong or the file is damaged. Nothing was restored."
unset PASSPHRASE
(cd "$TMP" && sha256sum --quiet -c SHA256SUMS) || fail "a file inside the backup is damaged. Nothing was restored."
(cd "$TMP/storage/files" 2>/dev/null && sha256sum --quiet -c ../objects.sha256) || [ ! -s "$TMP/storage/objects.sha256" ] || fail "a stored file inside the backup is damaged. Nothing was restored."
jq -r '"Backup from \(.started.utc) (London \(.started.london)), script \(.script_version): areas \(.schemas | join(", ")); \(.tables | length) tables, \([.buckets[].objects] | add // 0) files."' "$TMP/manifest.json"

# Everything that can be checked before the target is touched.
for dump in "$TMP/db/schemas.dump" "$TMP/db/auth.dump"; do
  "$PG_BIN/pg_restore" --list "$dump" >/dev/null 2>&1 ||
    fail "the PostgreSQL tools on this machine cannot read this backup. Install tools at least as new as the backup's ($(jq -r '.source.postgres_version_num' "$TMP/manifest.json") or newer). Nothing was restored."
done
SCHEMAS=()
while IFS= read -r s; do
  [[ "$s" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "this restore cannot handle the area name \"$s\". Nothing was restored."
  SCHEMAS+=("$s")
done < <(jq -r '.schemas[]' "$TMP/manifest.json")
[ "${#SCHEMAS[@]}" -gt 0 ] || fail "the backup's manifest names no database areas. Nothing was restored."
SCHEMAS_SQL="$(printf "'%s'," "${SCHEMAS[@]}")"
SCHEMAS_SQL="ARRAY[${SCHEMAS_SQL%,}]::text[]"
IDENT='([a-z_][a-z0-9_$]*|"([^"]|"")+")'
while IFS= read -r table; do
  [[ "$table" =~ ^$IDENT\.$IDENT$ ]] || fail "unexpected table name in the backup's manifest: $table. Nothing was restored."
done < <(jq -r '(.tables + .auth_tables) | keys[]' "$TMP/manifest.json")

# ---------------------------------------------------------------- 2. The TARGET (secrets at hidden prompts)
echo
echo "Paste the TARGET's Session pooler connection string (with [YOUR-PASSWORD] still in it), then press Enter:"
read -r DB_URL
if [[ "$DB_URL" != postgres* || "$DB_URL" != *":[YOUR-PASSWORD]@"* ]]; then fail "that does not look like a Session pooler string."; fi
DB_URL="${DB_URL/:\[YOUR-PASSWORD\]@/@}"
HOST="$(sed -E 's#^[a-z]+://[^@]*@([^:/?]+).*#\1#' <<<"$DB_URL")"
REF="$(sed -nE 's#^[a-z]+://postgres\.([a-z0-9]+)@.*#\1#p' <<<"$DB_URL")"
if [ -n "$REF" ]; then API_URL="https://$REF.supabase.co"; else
  echo "Type the TARGET's project address (for a local copy: http://localhost:54321), then press Enter:"
  read -r API_URL
fi
[[ "$API_URL" =~ ^https?://[A-Za-z0-9.:-]+$ ]] || fail "the project address should look like https://<ref>.supabase.co"

# Safety: the live project is refused unless the exact phrase is typed (checked before any password is asked).
if [[ "$DB_URL" == *"$LIVE_REF"* || "$API_URL" == *"$LIVE_REF"* ]]; then
  echo
  echo "WARNING: this target is the LIVE AccountingBody project."
  echo "Restoring over live replaces ALL of AccountingBody's and EthioTax's data and every archived area (hrlake, birrbank, ab, et)."
  echo "Everything added since this backup was taken would be lost."
  echo "Only do this after talking it through (docs/RUNBOOK.md section 1). To go ahead, type exactly:"
  echo "  $LIVE_PHRASE"
  read -r answer || answer=""
  [ "$answer" = "$LIVE_PHRASE" ] || fail "the phrase was not typed exactly, so nothing was changed."
fi

echo "Type the TARGET's database password (nothing appears as you type), then press Enter:"
read -rs PGPASSWORD
echo
export PGPASSWORD
case "$HOST" in localhost|127.0.0.1) export PGSSLMODE="${PGSSLMODE:-disable}" ;; *) export PGSSLMODE="${PGSSLMODE:-require}" ;; esac
echo "Paste the TARGET's secret API key: legacy service_role or sb_secret_ (nothing appears as you type), then press Enter:"
read -rs SERVICE_KEY
echo
api() { curl -sS --fail --retry 2 --retry-delay 2 -H @<(api_auth_headers "$SERVICE_KEY") "$@"; }
sql() { "$PSQL" "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

sql -c 'show server_version_num' >/dev/null || fail "could not connect to the target database."
api -o /dev/null "$API_URL/storage/v1/bucket" || fail "the target's project address or secret API key was not accepted by Storage."

# Roles are not in any dump: a grant naming a missing role stops the restore, so say so before anything changes.
MISSING_ROLES="$(jq -r --argjson have "$(sql -c "select coalesce(json_agg(rolname), '[]') from pg_roles")" '.custom_roles - $have | join(", ")' "$TMP/manifest.json")"
if [ -n "$MISSING_ROLES" ]; then
  echo
  echo "Note: these database roles existed in the backup's project but not on the target: $MISSING_ROLES"
  echo "If a permission names one of them, the restore will stop with an error. Create them on the target first if so."
fi

EXISTING="$(sql -c "select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = any($SCHEMAS_SQL) and c.relkind in ('r', 'p', 'v', 'm', 'f')) + (select count(*) from auth.users)")"
if [ "$EXISTING" != 0 ]; then
  echo
  echo "The target already holds tables or sign-in records in these areas: ${SCHEMAS[*]} (and auth.users)."
  echo "They will be DELETED and replaced by the backup."
  echo "To go ahead, type exactly:  $REPLACE_PHRASE"
  read -r answer || answer=""
  [ "$answer" = "$REPLACE_PHRASE" ] || fail "the phrase was not typed exactly, so nothing was changed."
fi

# ---------------------------------------------------------------- 3. Database
START=$(date +%s)
CHANGING=1
say "1/4  Emptying the areas to be restored (${SCHEMAS[*]}) and the sign-in records on the target..."
# Only the objects inside these areas are removed (never anything that belongs to an extension); the areas themselves
# stay, because Supabase sets the public area's own permissions and they cannot be recreated. If this would also remove
# anything OUTSIDE these areas (DROP ... CASCADE can reach further), it stops with nothing changed. The project's own
# triggers on auth tables are not counted: this restore recreates them from the backup.
read -r -d '' EMPTY_SQL <<'SQL' || true
do $$
declare
  target_ns oid[] := (select array_agg(oid) from pg_namespace where nspname = any(__SCHEMAS__));
  system_ns oid[] := (select array_agg(oid) from pg_namespace where nspname ~ '^pg_' or nspname = 'information_schema');
  outside_before bigint;
  outside_after bigint;
  r record;
begin
  perform set_config('search_path', 'pg_catalog', true);
  select (select count(*) from pg_class c where c.relkind in ('r', 'p', 'v', 'm', 'f') and not c.relnamespace = any(target_ns) and not c.relnamespace = any(system_ns))
       + (select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid where not c.relnamespace = any(target_ns))
       + (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal and not c.relnamespace = any(target_ns) and c.relnamespace <> 'auth'::regnamespace)
       + (select count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid where not c.relnamespace = any(target_ns))
    into outside_before;
  for r in
    select format('drop %s if exists %s cascade', kind, ident) as stmt from (
      select 'view' as kind, c.oid::regclass::text as ident, c.oid from pg_class c where c.relnamespace = any(target_ns) and c.relkind = 'v'
      union all select 'materialized view', c.oid::regclass::text, c.oid from pg_class c where c.relnamespace = any(target_ns) and c.relkind = 'm'
      union all select 'foreign table', c.oid::regclass::text, c.oid from pg_class c where c.relnamespace = any(target_ns) and c.relkind = 'f'
      union all select 'table', c.oid::regclass::text, c.oid from pg_class c where c.relnamespace = any(target_ns) and c.relkind in ('r', 'p') and c.relispartition is false
      union all select 'sequence', c.oid::regclass::text, c.oid from pg_class c where c.relnamespace = any(target_ns) and c.relkind = 'S'
      union all select case p.prokind when 'p' then 'procedure' when 'a' then 'aggregate' else 'function' end, p.oid::regprocedure::text, p.oid from pg_proc p where p.pronamespace = any(target_ns)
      union all select case t.typtype when 'd' then 'domain' else 'type' end, t.oid::regtype::text, t.oid from pg_type t where t.typnamespace = any(target_ns) and (t.typtype in ('e', 'd', 'r') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
    ) o
    where not exists (select 1 from pg_depend d where d.objid = o.oid and d.deptype = 'e')
    order by case kind when 'view' then 1 when 'materialized view' then 1 when 'foreign table' then 2 when 'table' then 2 when 'sequence' then 3 when 'function' then 4 when 'procedure' then 4 when 'aggregate' then 4 else 5 end
  loop
    execute r.stmt;
  end loop;
  select (select count(*) from pg_class c where c.relkind in ('r', 'p', 'v', 'm', 'f') and not c.relnamespace = any(target_ns) and not c.relnamespace = any(system_ns))
       + (select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid where not c.relnamespace = any(target_ns))
       + (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where not t.tgisinternal and not c.relnamespace = any(target_ns) and c.relnamespace <> 'auth'::regnamespace)
       + (select count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid where not c.relnamespace = any(target_ns))
    into outside_after;
  if outside_after <> outside_before then
    raise exception 'Emptying these areas would also remove objects outside them. Nothing was changed. Use a new empty project instead.';
  end if;
end $$;
delete from auth.users;
SQL
# (-f - matters: psql ignores --single-transaction for plain standard input.)
if ! printf '%s\n' "${EMPTY_SQL//__SCHEMAS__/$SCHEMAS_SQL}" | sql --single-transaction -f - >/dev/null; then
  # One transaction: it rolled back, so the target is exactly as it was.
  CHANGING=0
  fail "the target could not be emptied (reason above). Nothing was changed."
fi
say "2/4  Restoring the extensions, the sign-in records and every table..."
for s in "${SCHEMAS[@]}"; do
  [ "$s" = public ] || sql -c "create schema if not exists \"$s\"" >/dev/null
done
# Each extension on its own: one that fails (a target may not offer it) must not stop the ones after it. Every failure
# is reported. If a table needs a missing extension, the table restore below stops with a visible error.
while IFS=$'\t' read -r extension schema; do
  if [[ ! "$extension" =~ ^[A-Za-z0-9_-]+$ ]] || [[ ! "$schema" =~ ^(\"[A-Za-z0-9_$]+\"|[a-z_][a-z0-9_$]*)$ ]]; then
    echo "  Extension $extension could not be created: unexpected name in the backup."
    EXTENSION_FAILURES+=("$extension")
    continue
  fi
  if ! out="$(sql -c "create extension if not exists \"$extension\" with schema $schema" 2>&1 </dev/null)"; then
    echo "  Extension $extension could not be created: $(sanitise_error "$out" "$PGPASSWORD" "$SERVICE_KEY" | head -n 1)"
    EXTENSION_FAILURES+=("$extension")
  fi
done < <(jq -r '.[] | [.name, .schema] | @tsv' "$TMP/db/extensions.json")
# Sign-in records first (the tables' links to them are added afterwards). Triggers stay off while loading. Skipped when
# there are none: empty tables would only add a risk that the target's auth tables differ from the backup's.
if [ "$(jq '[.auth_tables[]] | add // 0' "$TMP/manifest.json")" != 0 ]; then
  "$PG_BIN/pg_restore" --data-only --file=- "$TMP/db/auth.dump" | sql --single-transaction -c "set session_replication_role = replica" -f - >/dev/null
else
  echo "  The backup holds no sign-in records, so that step is skipped."
fi
# Every area's tables: structure, data, then indexes, links, triggers and security rules, exactly as backed up, in one
# file so that pg_dump's order holds across areas. Left out: each area's schema entry (created above); the public area's
# comment and permissions (the target already has them); default permissions owned by a Supabase role.
"$PG_BIN/pg_restore" --list "$TMP/db/schemas.dump" | grep -vE ' SCHEMA - [^ ]+ | (COMMENT - SCHEMA public|ACL - SCHEMA public) |DEFAULT ACL .* supabase_[a-z_]+$' >"$TMP/restore.list"
# In ONE transaction: first switch off the target's automatic grants for new objects in every restored area (Supabase
# grants everything to anon, authenticated and service_role in public by default, and an area kept from an earlier
# restore keeps its own), and remove old grants on the areas themselves, so everything gets exactly the permissions it
# had in the backup, never more. The backup's own permission entries then put the right ones back.
read -r -d '' RESET_PERMISSIONS_SQL <<'SQL' || true
do $$
declare r record;
begin
  for r in
    select format('alter default privileges for role current_user in schema %I revoke all on %s from %s',
                  n.nspname,
                  case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' when 'T' then 'types' end,
                  case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end) as stmt
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = any(__SCHEMAS__) and d.defaclrole = (select oid from pg_roles where rolname = current_user) and a.grantee <> d.defaclrole
    union all
    select format('revoke all on schema %I from %s', n.nspname, case when a.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end)
    from pg_namespace n
    cross join lateral aclexplode(n.nspacl) a
    where n.nspname = any(__SCHEMAS__) and n.nspname <> 'public' and a.grantee <> n.nspowner
  loop
    execute r.stmt;
  end loop;
end $$;
SQL
"$PG_BIN/pg_restore" --no-owner --use-list="$TMP/restore.list" --file=- "$TMP/db/schemas.dump" |
  sql --single-transaction -c "${RESET_PERMISSIONS_SQL//__SCHEMAS__/$SCHEMAS_SQL}" -f - >/dev/null
# The project's own trigger on auth.users (it lives outside the restored areas).
[ ! -s "$TMP/db/auth-triggers.sql" ] || sql --single-transaction -f "$TMP/db/auth-triggers.sql" >/dev/null
sql -c "notify pgrst, 'reload schema'" >/dev/null

# ---------------------------------------------------------------- 4. Stored files
say "3/4  Re-creating any buckets and uploading $(jq length "$TMP/storage/objects.json") stored files..."
jq -c '.[]' "$TMP/storage/buckets.json" | while read -r bucket; do
  id="$(jq -r .id <<<"$bucket")"
  [[ "$id" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || fail "unexpected bucket name in the backup: $id"
  if api -o /dev/null "$API_URL/storage/v1/bucket/$id" 2>/dev/null; then
    api -o /dev/null -X PUT -H 'Content-Type: application/json' --data "$bucket" "$API_URL/storage/v1/bucket/$id"
  else
    api -o /dev/null -X POST -H 'Content-Type: application/json' --data "$bucket" "$API_URL/storage/v1/bucket"
  fi
done
jq -r '.[] | [.bucket, .name, (.name | split("/") | map(@uri) | join("/")), .mimetype] | @tsv' "$TMP/storage/objects.json" >"$TMP/upload.tsv"
n=0
while IFS=$'\t' read -r bucket name encoded mime; do
  api -o /dev/null -X POST -H "Content-Type: $mime" -H 'x-upsert: true' --data-binary @"$TMP/storage/files/$bucket/$name" "$API_URL/storage/v1/object/$bucket/$encoded" ||
    fail "could not upload $bucket/$name."
  n=$((n + 1))
  if [ $((n % 50)) = 0 ]; then echo "     $n uploaded"; fi
done <"$TMP/upload.tsv"

# ---------------------------------------------------------------- 5. Check the target against the manifest
say "4/4  Checking the target against the backup..."
problems=0
# Auth tables with no rows in the backup were not loaded, so only those holding rows (and auth.users) are compared.
while IFS=$'\t' read -r table expected; do
  # ONLY: a parent table's own rows, which is what its COPY block counted, not its children's as well.
  actual="$(sql -c "select count(*) from only $table" </dev/null)"
  if [ "$actual" != "$expected" ]; then echo "  rows differ in $table: backup $expected, target $actual"; problems=$((problems + 1)); fi
done < <(jq -r '.tables + (.auth_tables | with_entries(select(.value > 0 or .key == "auth.users"))) | to_entries[] | [.key, (.value | tostring)] | @tsv' "$TMP/manifest.json")
while IFS=$'\t' read -r bucket objects bytes; do
  [[ "$bucket" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || fail "unexpected bucket name in the backup's manifest: $bucket"
  got="$(sql -c "select count(*) || E'\t' || coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = '$bucket'" </dev/null)"
  if [ "$got" != "$objects"$'\t'"$bytes" ]; then echo "  files differ in bucket $bucket: backup $objects files / $bytes bytes, target ${got/$'\t'/ files \/ } bytes"; problems=$((problems + 1)); fi
done < <(jq -r '.buckets | to_entries[] | [.key, (.value.objects | tostring), (.value.bytes | tostring)] | @tsv' "$TMP/manifest.json")
# Byte-for-byte: download back up to 25 files and compare their checksums with the backup's.
mkdir -p "$TMP/check"
while IFS= read -r line; do
  sum="${line%% *}"; rel="${line#*  }"; bucket="${rel%%/*}"; name="${rel#*/}"
  encoded="$(jq -rn --arg p "$name" '$p | split("/") | map(@uri) | join("/")')"
  api -o "$TMP/check/f" "$API_URL/storage/v1/object/$bucket/$encoded" || { echo "  could not download $rel back"; problems=$((problems + 1)); continue; }
  [ "$(sha256sum "$TMP/check/f" | cut -d' ' -f1)" = "$sum" ] || { echo "  $rel differs from the backup"; problems=$((problems + 1)); }
done < <(shuf -n 25 "$TMP/storage/objects.sha256" 2>/dev/null || true)
unset SERVICE_KEY
[ "$problems" = 0 ] || fail "$problems check(s) did not match the backup (listed above)."
echo "Every table's rows, every bucket's files and bytes, and a sample of files byte for byte match the backup."
FINISHED=1

# ---------------------------------------------------------------- What this restore deliberately did not do
say "Scheduled jobs: NOT recreated. This restore never schedules anything."
if [ "$(jq -r '.cron.status' "$TMP/manifest.json")" = saved ]; then
  echo "The saved definitions ($(jq -r '.cron.jobs' "$TMP/manifest.json") jobs) are inside the backup file, as db/cron-jobs.json. To read them (openssl asks for the passphrase):"
  printf '  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "%s" | tar -xzOf - ./db/cron-jobs.json | jq .\n' "$ARCHIVE"
  echo "Only on a REAL recovery, and NEVER on a rehearsal (these jobs delete rows on a schedule): in the new project's"
  echo "Supabase SQL Editor, for each job with \"active\": true, run:  select cron.schedule('<jobname>', '<schedule>', \$\$<command>\$\$);"
else
  echo "This backup recorded: pg_cron not present. There are no saved definitions."
fi
other="$(jq -r '[.schemas_other[].name, .schemas_skipped[].name] | join(", ")' "$TMP/manifest.json")"
if [ -n "$other" ]; then
  echo
  echo "Not restored: areas the backup did not recognise ($other). See docs/RUNBOOK.md section 1."
fi
report_extension_failures
say "Restore finished in $(( $(date +%s) - START )) seconds."
