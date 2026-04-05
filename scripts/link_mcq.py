import requests, os, json, re

# ============================================================
# MCQ LINKING SCRIPT
# Links articles to their practice posts by matching the
# WordPress _abcm_practice_url slug to the Sanity practicePost slug.
#
# Before running: ensure both article and quiz migrations are done.
#
# What it does:
# 1. Fetches all practicePost slugs from Sanity
# 2. Fetches all articles with mcqUrl set
# 3. Extracts slug from mcqUrl
# 4. Matches to practicePost slug
# 5. Updates article mcqUrl to /practice-questions/[slug]
# ============================================================

PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ["SANITY_API_TOKEN"]
QUERY_URL  = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
MUTATE_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
HEADERS    = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

def extract_slug(url):
    url = url.strip().rstrip("/")
    return url.split("/")[-1]

print("Fetching practicePost slugs from Sanity...")
resp = requests.get(QUERY_URL, params={"query": '*[_type == "practicePost"]{_id, "slug": slug.current}'}, headers=HEADERS, timeout=30)
practice_posts = resp.json().get("result", [])
slug_map = {pp["slug"]: pp["_id"] for pp in practice_posts if pp.get("slug")}
print(f"Found {len(slug_map)} practice posts in Sanity")

if not slug_map:
    print("No practice posts found — run migrate_quiz_posts.py first")
    exit()

print("Fetching articles with mcqUrl...")
resp = requests.get(QUERY_URL, params={"query": '*[_type == "article" && defined(mcqUrl)]{_id, title, mcqUrl}'}, headers=HEADERS, timeout=60)
articles = resp.json().get("result", [])
print(f"Found {len(articles)} articles with mcqUrl")

matched = 0
unmatched = 0
already_updated = 0

for article in articles:
    mcq_url = article.get("mcqUrl", "")
    title   = article.get("title", "")
    doc_id  = article.get("_id", "")

    if mcq_url.startswith("/practice-questions/"):
        already_updated += 1
        continue

    slug = extract_slug(mcq_url)
    if slug in slug_map:
        new_url = f"/practice-questions/{slug}"
        resp = requests.post(MUTATE_URL, headers=HEADERS, json={
            "mutations": [{"patch": {"id": doc_id, "set": {"mcqUrl": new_url}}}]
        }, timeout=30)
        if resp.status_code == 200:
            print(f"  LINKED: {title[:60]} -> {new_url}")
            matched += 1
        else:
            print(f"  FAIL: {title[:60]} -- {resp.json()}")
    else:
        print(f"  NO MATCH: {title[:60]} | slug: {slug}")
        unmatched += 1

print(f"")
print(f"MCQ LINKING COMPLETE")
print(f"Linked:          {matched}")
print(f"Already updated: {already_updated}")
print(f"No match:        {unmatched}")