import requests, os, json

PROJECT_ID = "4rllejq1"
DATASET = "production"
TOKEN = os.environ["SANITY_API_TOKEN"]
QUERY_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
HEADERS = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

# Step 1 — Ensure author exists
author_doc = {
    "_id": "author-accountingbody-editorial-team",
    "_type": "author",
    "name": "AccountingBody Editorial Team",
    "slug": {"_type":"slug","current":"accountingbody-editorial-team"},
}
resp = requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":[{"createOrReplace":author_doc}]}, timeout=30)
print(f"Author upsert: {resp.status_code}")

# Step 2 — Get all wp-post articles
resp = requests.get(QUERY_URL, params={"query":'*[_id match "wp-post-*"]._id'}, headers=HEADERS, timeout=60)
ids = resp.json().get("result",[])
print(f"Found {len(ids)} articles to link")

# Step 3 — Link author to all articles in batches of 100
author_ref = {"_type":"reference","_ref":"author-accountingbody-editorial-team"}
success = 0
for i in range(0, len(ids), 100):
    batch = ids[i:i+100]
    mutations = [{"patch":{"id":doc_id,"set":{"author":author_ref}}} for doc_id in batch]
    resp = requests.post(MUTATE_URL, headers=HEADERS, json={"mutations":mutations}, timeout=30)
    if resp.status_code == 200:
        success += len(batch)
        print(f"Linked {success} articles so far...")
    else:
        print(f"Error: {resp.json()}")

print(f"")
print(f"AUTHOR LINKING COMPLETE")
print(f"Total articles linked: {success}")