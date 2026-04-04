import requests, os, json

PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ["SANITY_API_TOKEN"]
QUERY_URL  = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
HEADERS    = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

# ── Wipe articles ────────────────────────────────────────────────────────────
resp = requests.get(QUERY_URL, params={"query":'*[_type == "article"]._id'}, headers=HEADERS, timeout=30)
ids = resp.json().get("result",[])
print(f"Found {len(ids)} articles in Sanity")
if ids:
    for i in range(0, len(ids), 100):
        batch = ids[i:i+100]
        requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"delete":{"id":bid}} for bid in batch]})
    print(f"Wiped {len(ids)} articles from Sanity")
else:
    print("No articles to wipe")

# ── Wipe practice posts ───────────────────────────────────────────────────────
resp = requests.get(QUERY_URL, params={"query":'*[_type == "practicePost"]._id'}, headers=HEADERS, timeout=30)
qids = resp.json().get("result",[])
print(f"Found {len(qids)} practice posts in Sanity")
if qids:
    for i in range(0, len(qids), 100):
        batch = qids[i:i+100]
        requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"delete":{"id":bid}} for bid in batch]})
    print(f"Wiped {len(qids)} practice posts from Sanity")
else:
    print("No practice posts to wipe")

# ── Clear migration logs ──────────────────────────────────────────────────────
for log_file in [
    "/workspaces/AccountingBody-Platfrom/scripts/migration_log.json",
    "/workspaces/AccountingBody-Platfrom/scripts/quiz_migration_log.json",
]:
    with open(log_file, "w") as f:
        json.dump({"done":[],"failed":[],"skipped":[]}, f, indent=2)
    print(f"Cleared: {log_file}")

print("")
print("Sanity clean — ready for a fresh migration run")