import requests, os, json, sys
PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ["SANITY_API_TOKEN"]
QUERY_URL  = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
HEADERS    = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

DRY_RUN = "--dry-run" in sys.argv

print("=" * 60)
print("ACCOUNTING BODY — SANITY WIPE SCRIPT")
print("=" * 60)
print("SCOPE: canonicalOwner == accountingbody ONLY")
print("HRLake and EthioTax documents are NEVER touched.")
print("=" * 60)

if DRY_RUN:
    print("DRY-RUN MODE — nothing will be deleted")
    print("")
else:
    print("")
    print("You are about to permanently delete all Accounting Body")
    print("articles and practice posts from Sanity production.")
    print("")
    confirm = input("Type WIPE ACCOUNTINGBODY to confirm: ").strip()
    if confirm != "WIPE ACCOUNTINGBODY":
        print("Confirmation did not match. Aborting — nothing deleted.")
        sys.exit(0)
    print("")

# ── Wipe articles (accountingbody only) ──────────────────────────────────────
resp = requests.get(QUERY_URL, params={"query":'*[_type == "article" && canonicalOwner == "accountingbody"]._id'}, headers=HEADERS, timeout=30)
ids = resp.json().get("result",[])
print(f"Found {len(ids)} Accounting Body articles in Sanity")

if DRY_RUN:
    print(f"DRY-RUN: would delete {len(ids)} articles — no action taken")
elif ids:
    for i in range(0, len(ids), 100):
        batch = ids[i:i+100]
        requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"delete":{"id":bid}} for bid in batch]})
    print(f"Wiped {len(ids)} articles from Sanity")
else:
    print("No articles to wipe")

# ── Wipe practice posts (accountingbody only) ─────────────────────────────────
resp = requests.get(QUERY_URL, params={"query":'*[_type == "practicePost" && canonicalOwner == "accountingbody"]._id'}, headers=HEADERS, timeout=30)
qids = resp.json().get("result",[])
print(f"Found {len(qids)} Accounting Body practice posts in Sanity")

if DRY_RUN:
    print(f"DRY-RUN: would delete {len(qids)} practice posts — no action taken")
elif qids:
    for i in range(0, len(qids), 100):
        batch = qids[i:i+100]
        requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"delete":{"id":bid}} for bid in batch]})
    print(f"Wiped {len(qids)} practice posts from Sanity")
else:
    print("No practice posts to wipe")

# ── Clear migration logs (only if not dry-run) ────────────────────────────────
if not DRY_RUN:
    for log_file in [
        "/workspaces/AccountingBody-Platfrom/scripts/migration_log.json",
        "/workspaces/AccountingBody-Platfrom/scripts/quiz_migration_log.json",
    ]:
        with open(log_file, "w") as f:
            json.dump({"done":[],"failed":[],"skipped":[]}, f, indent=2)
        print(f"Cleared: {log_file}")

print("")
print("DONE")
