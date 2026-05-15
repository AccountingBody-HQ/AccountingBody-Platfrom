import requests, os, sys

PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ["SANITY_API_TOKEN"]
QUERY_URL  = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
HEADERS    = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

DRY_RUN = "--dry-run" in sys.argv

print("=" * 60)
print("ACCOUNTING BODY — WIPE PRACTICE POSTS ONLY")
print("=" * 60)
print("SCOPE: practicePost + canonicalOwner == accountingbody ONLY")
print("Articles and HRLake/EthioTax documents are NEVER touched.")
print("=" * 60)

if DRY_RUN:
    print("DRY-RUN MODE — nothing will be deleted")
    print("")
else:
    print("")
    print("You are about to permanently delete all Accounting Body")
    print("practice posts from Sanity production.")
    print("")
    confirm = input("Type WIPE PRACTICEPOSTS to confirm: ").strip()
    if confirm != "WIPE PRACTICEPOSTS":
        print("Confirmation did not match. Aborting — nothing deleted.")
        sys.exit(0)
    print("")

resp = requests.get(QUERY_URL, params={"query":'*[_type == "practicePost" && canonicalOwner == "accountingbody"]._id'}, headers=HEADERS, timeout=30)
ids = resp.json().get("result",[])
print(f"Found {len(ids)} Accounting Body practice posts in Sanity")

if DRY_RUN:
    print(f"DRY-RUN: would delete {len(ids)} practice posts — no action taken")
elif ids:
    for i in range(0, len(ids), 100):
        batch = ids[i:i+100]
        requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"delete":{"id":bid}} for bid in batch]})
    print(f"Wiped {len(ids)} practice posts from Sanity")
    import json
    log_file = "/workspaces/AccountingBody-Platfrom/scripts/quiz_migration_log.json"
    with open(log_file, "w") as f:
        json.dump({"done":[],"failed":[],"skipped":[]}, f, indent=2)
    print(f"Cleared: {log_file}")
else:
    print("No practice posts to wipe")

print("")
print("DONE")
