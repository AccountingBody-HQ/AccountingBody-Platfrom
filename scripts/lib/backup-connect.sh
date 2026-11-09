# shellcheck shell=bash
# AB-P0-5: plain-English reasons when scripts/backup-supabase.sh cannot connect, a sanitiser that keeps every secret out
# of what is printed, safe shape checks on AB_BACKUP_DB_URL and the service key, the rules for which database areas
# (schemas) are backed up, and the row counter. Loaded by the backup and restore scripts; tested by
# tests/unit/bk1b-connection-errors.test.ts and tests/unit/ab-p0-5b-backup.test.ts.
# Nothing here prints a password, a key or a connection string.

# The error text with every secret removed: each value given after the text (the password in plain and %-encoded form,
# the connection string, keys) is replaced by [hidden], then anything that looks like a connection string, a
# "password=" setting or a key. At most two lines of 300 characters.
sanitise_error() {
  local text="$1" secret
  shift
  for secret in "$@"; do
    if [ -n "$secret" ]; then text="${text//"$secret"/[hidden]}"; fi
  done
  printf '%s\n' "$text" | sed -E \
    -e 's#postgres(ql)?://[^[:space:]"'"'"']*#[hidden]#g' \
    -e 's#(password|passwd|pwd)[[:space:]]*=[[:space:]]*[^[:space:]"'"'"']*#\1=[hidden]#Ig' \
    -e 's#eyJ[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*#[hidden]#g' \
    -e 's#sb_(secret|publishable)_[A-Za-z0-9_-]+#[hidden]#g' \
    -e 's#^(psql|pg_dump): error: ##' |
    grep -v '^[[:space:]]*$' | head -n 2 | cut -c1-300
}

# One plain-English line for the database client's error text.
connection_reason() {
  local e
  e="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$e" in
    *"password authentication failed"*)
      echo "The database refused the password. The address and user were accepted, so only the password is wrong. Supabase cannot show it: reset it (Project Settings → Database), put the new one in the connection string (and in the secret AB_BACKUP_DB_URL), then run it once." ;;
    *"circuit breaker"* | *"too many authentication"*)
      echo "Supabase has paused new connections for a while after too many failed sign-in attempts. Wait about 30 minutes, check the password in the connection string, then run it once." ;;
    *"tenant or user not found"* | *"tenant not found"* | *"user not found"* | *"role \""*"\" does not exist"*)
      echo "Supabase does not recognise the project or user in the connection string. Copy the Session pooler string again; the user must be postgres.<project ref>." ;;
    *"could not translate host name"* | *"name or service not known"* | *"temporary failure in name resolution"* | *"nodename nor servname"* | *"no address associated"*)
      echo "The database address could not be found. Check the part after @ in the connection string." ;;
    *"too many connections"* | *"remaining connection slots"* | *"max client connections"* | *"maxclientsinsessionmode"* | *"too many clients"*)
      echo "The database has too many open connections right now. Wait a few minutes and run it again." ;;
    *"project is paused"* | *"paused"* | *"restricted"* | *"suspended"*)
      echo "Supabase refused the connection because the project is paused or restricted. Open the project in Supabase, check it is active, and run it again." ;;
    *ssl* | *tls*)
      echo "The secure connection could not be set up." ;;
    *"timeout expired"* | *"timed out"* | *"connection refused"* | *"network is unreachable"* | *"no route to host"*)
      echo "The database could not be reached from this machine (network). Check Supabase → Database → Settings → Network restrictions allow all addresses, and that you used the Session pooler (port 5432)." ;;
    *"server closed the connection unexpectedly"* | *"connection reset"*)
      echo "The database closed the connection straight away. It may be restarting or paused: open the project in Supabase, check it is active, and run it again." ;;
    *)
      echo "Reason from the database: $(sanitise_error "$1" "${@:2}" | head -n 1)" ;;
  esac
}

# Is this error about setting up the secure connection?
is_ssl_error() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    *"password authentication"* | *"tenant"*) return 1 ;;
    *ssl* | *tls*) return 0 ;;
    *) return 1 ;;
  esac
}

# Shape checks on the Session pooler string, before connecting. $1 = the string with the password taken out,
# $2 = the password as written in it. Prints one plain line per problem (never the password); prints nothing when
# the shape is right.
url_shape_problems() {
  local url="$1" pw="$2" user host port db
  if [[ "$url$pw" =~ [[:space:]] ]]; then echo "it contains a space (a space in the password must be written as %20)."; fi
  if [[ "$url" == *[\[\]]* ]] || [[ "$pw" == \[*\] ]]; then echo "it still has square brackets [ ]: remove them (only the password goes between : and @)."; fi
  if [[ "$(printf '%s' "$url$pw" | tr '[:lower:]' '[:upper:]')" == *"YOUR-PASSWORD"* ]]; then echo "it still contains YOUR-PASSWORD: put the database password in its place."; fi
  if [[ ! "$url" =~ ^postgres(ql)?://([^@/]+)@([^:/?]+)(:([0-9]+))?(/([^?]*))?(\?.*)?$ ]]; then
    echo "it is not in the form postgresql://postgres.<project ref>:<password>@<host>:5432/postgres."
    return 0
  fi
  user="${BASH_REMATCH[2]}" host="${BASH_REMATCH[3]}" port="${BASH_REMATCH[5]}" db="${BASH_REMATCH[7]}"
  if [[ ! "$user" =~ ^postgres\.[a-z0-9]{20}$ ]]; then echo "the user (before the password) should be postgres.<project ref> (postgres, a dot, then 20 letters and numbers)."; fi
  if [[ "$host" != *.pooler.supabase.com ]]; then echo "the address after @ should end with .pooler.supabase.com (the Session pooler address from Supabase → Connect)."; fi
  if [ "$port" = 6543 ]; then echo "the port is 6543 (the Transaction pooler): use the Session pooler, port 5432."
  elif [ "$port" != 5432 ]; then echo "the port (after the address) should be 5432."; fi
  if [ "$db" != postgres ]; then echo "the database name at the end should be postgres (…:5432/postgres)."; fi
  return 0
}

# Is this service key usable? Prints one plain line if not (never the key); prints nothing if it looks right.
# Accepted: a new secret key (sb_secret_...) or the legacy service_role key (a JWT whose role is service_role).
service_key_problem() {
  local key="$1" role
  case "$key" in
    sb_secret_*) return 0 ;;
    sb_publishable_*)
      echo "it is the publishable key, which is public. Use the secret key (legacy service_role, or sb_secret_...)."
      return 0 ;;
    eyJ*.*.*)
      # The key reaches python through a pipe, never the command line. An unreadable role is left for Storage to judge.
      role="$(printf '%s' "$key" | python3 -c 'import base64, json, sys
try:
    p = sys.stdin.read().split(".")[1]
    print(json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4))).get("role", ""))
except Exception:
    print("")' 2>/dev/null || true)"
      if [ -n "$role" ] && [ "$role" != service_role ]; then
        echo "it is the $role key. Use the secret key (legacy service_role, or sb_secret_...)."
      fi
      return 0 ;;
    *)
      echo "it does not look like a Supabase secret key (legacy service_role, or sb_secret_...)."
      return 0 ;;
  esac
}

# The headers that carry the service key to Supabase's API. A legacy JWT goes in both headers. An sb_ key is not a JWT,
# so it goes in apikey only. Used through a pipe, so the key is never on a command line.
api_auth_headers() {
  case "$1" in
    sb_*) printf 'apikey: %s\n' "$1" ;;
    *) printf 'apikey: %s\nAuthorization: Bearer %s\n' "$1" "$1" ;;
  esac
}

# Supabase-managed areas (schemas): never dumped as project data. Anything matching pg_* or supabase_*, or owned by an
# extension, counts as managed too. Keep docs/RUNBOOK.md section 1 in step (a test compares them).
# auth and storage are saved by their own separate steps; cron by the scheduled-jobs step.
MANAGED_SCHEMAS=(
  information_schema auth storage realtime vault cron extensions graphql graphql_public net pgsodium pgsodium_masks
  supabase_functions supabase_migrations _realtime _supavisor pgbouncer _analytics pgmq pgmq_public pgtle dbdev repack
  tiger tiger_data topology
)
# This project's own areas. They only decide what happens if one cannot be read; they never limit what is discovered.
PROJECT_SCHEMAS=(public hrlake birrbank ab et)

# classify_schema name owner login_role extension_owned(0|1) readable(0|1). Prints exactly one of:
#   managed  Supabase's own: not dumped, named in the manifest
#   dump     project data: in the one main dump, restored, row counts checked
#   stop     project data that cannot be read: the backup must fail rather than silently miss it
#   other    not recognised, readable: saved separately, not restored automatically, flagged in the manifest
#   skipped  not recognised, cannot be read: not saved, flagged in the manifest; must not fail the backup
classify_schema() {
  local name="$1" owner="$2" login="$3" extension_owned="$4" readable="$5" s ours=0
  case "$name" in pg_* | supabase_*) echo managed; return 0 ;; esac
  for s in "${MANAGED_SCHEMAS[@]}"; do
    if [ "$name" = "$s" ]; then echo managed; return 0; fi
  done
  if [ "$extension_owned" = 1 ]; then echo managed; return 0; fi
  for s in "${PROJECT_SCHEMAS[@]}"; do
    if [ "$name" = "$s" ]; then ours=1; fi
  done
  if [ "$owner" = "$login" ] || [ "$owner" = pg_database_owner ]; then ours=1; fi
  if [ "$ours" = 1 ]; then
    if [ "$readable" = 1 ]; then echo dump; else echo stop; fi
  elif [ "$readable" = 1 ]; then
    echo other
  else
    echo skipped
  fi
}

# Row counts per table from pg_restore's data output on stdin, as "table<TAB>rows". Inside a COPY block a row's text can
# itself start with "COPY x " (the !inside guard), and a table's name can hold a space when it is quoted.
count_copy_rows() {
  awk '!inside && /^COPY .+ FROM stdin;$/ { t = $0; sub(/^COPY /, "", t); sub(/ (\(.*\) )?FROM stdin;$/, "", t); n = 0; inside = 1; next }
       inside && /^\\\.$/ { print t "\t" n; inside = 0; next }
       inside { n++ }'
}

# The folder with the newest PostgreSQL tools on this machine: a newer pg_restore reads older dumps, never the reverse.
# BACKUP_PG_BIN overrides the choice (tests and rehearsals only; the workflow never sets it).
newest_pg_bin() {
  local d m best=""
  if [ -n "${BACKUP_PG_BIN:-}" ]; then printf '%s\n' "$BACKUP_PG_BIN"; return 0; fi
  for d in /usr/lib/postgresql/*/bin; do
    m="$(basename "$(dirname "$d")")"
    if ! [[ "$m" =~ ^[0-9]+$ ]] || [ ! -x "$d/pg_restore" ]; then continue; fi
    if [ -z "$best" ] || [ "$m" -gt "$best" ]; then best="$m"; fi
  done
  if [ -n "$best" ]; then
    printf '%s\n' "/usr/lib/postgresql/$best/bin"
  elif command -v pg_restore >/dev/null; then
    dirname "$(command -v pg_restore)"
  else
    return 1
  fi
}
