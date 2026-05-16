#!/usr/bin/env python3
"""
link_practice_categories.py
Copies category references from articles to their linked practice posts
via the mcqUrl field on articles.

Usage:
  python3 scripts/link_practice_categories.py --dry-run
  python3 scripts/link_practice_categories.py
"""
import os, sys, requests, argparse

PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ.get("SANITY_API_TOKEN", "")
QUERY_URL  = f"https://{PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2023-05-03/data/mutate/{DATASET}"
HEADERS    = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

if not TOKEN:
    print("ERROR: SANITY_API_TOKEN not set")
    sys.exit(1)

print("Fetching articles with mcqUrl and categories...")
query = '*[_type == "article" && defined(mcqUrl) && defined(categories) && length(categories) > 0]{_id, title, mcqUrl, "categories": categories[]{_type, _key, _ref}}'
resp  = requests.get(QUERY_URL, params={"query": query}, headers=HEADERS, timeout=60)
articles = resp.json().get("result", [])
print(f"Found {len(articles)} articles with mcqUrl and categories")

print("Fetching all practice posts...")
pq_query = '*[_type == "practicePost" && "accountingbody" in showOnSites]{_id, "slug": slug.current}'
pq_resp  = requests.get(QUERY_URL, params={"query": pq_query}, headers=HEADERS, timeout=60)
practice_posts = pq_resp.json().get("result", [])
slug_to_id = {p["slug"]: p["_id"] for p in practice_posts}
print(f"Found {len(practice_posts)} practice posts")

mutations = []
matched   = 0
skipped   = 0

for article in articles:
    mcq_url = article.get("mcqUrl", "")
    if not mcq_url.startswith("/practice-questions/"):
        skipped += 1
        continue
    slug = mcq_url.replace("/practice-questions/", "").strip("/")
    pq_id = slug_to_id.get(slug)
    if not pq_id:
        skipped += 1
        continue
    cats = article.get("categories", [])
    if not cats:
        skipped += 1
        continue
    # Ensure each category ref has a _key
    import uuid
    keyed_cats = []
    for cat in cats:
        keyed_cats.append({"_type": "reference", "_key": uuid.uuid4().hex[:8], "_ref": cat["_ref"]})
    mutations.append({"patch": {"id": pq_id, "set": {"categories": keyed_cats}}})
    matched += 1

print(f"Matched: {matched} | Skipped: {skipped}")

if not mutations:
    print("Nothing to update.")
    sys.exit(0)

if args.dry_run:
    print(f"DRY RUN — would update {len(mutations)} practice posts")
    for m in mutations[:5]:
        print(" ", m)
    sys.exit(0)

# Send in batches of 50
batch_size = 50
total_sent = 0
for i in range(0, len(mutations), batch_size):
    batch = mutations[i:i+batch_size]
    r = requests.post(MUTATE_URL, json={"mutations": batch}, headers=HEADERS, timeout=60)
    if r.status_code == 200:
        total_sent += len(batch)
        print(f"Batch {i//batch_size + 1}: updated {len(batch)} posts")
    else:
        print(f"ERROR on batch {i//batch_size + 1}: {r.text}")

print(f"Done. Total updated: {total_sent}")
