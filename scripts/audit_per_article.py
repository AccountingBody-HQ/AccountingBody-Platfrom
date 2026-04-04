import requests, os

PROJECT_ID = "4rllejq1"
DATASET = "production"
TOKEN = os.environ["SANITY_API_TOKEN"]
QUERY_URL = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/query/{DATASET}"
HEADERS = {"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}

resp = requests.get(QUERY_URL, params={"query":'*[_type == "article"]{_id, title, slug, excerpt, seoTitle, canonicalOwner, showOnSites, "bodyLength": length(body), "tableCount": count(body[_type == "tableBlock"]), "hasMcqUrl": defined(mcqUrl)} | order(_createdAt asc)'}, headers=HEADERS, timeout=60)
articles = resp.json().get("result",[])

print(f"=========================================")
print(f"PER-ARTICLE AUDIT REPORT")
print(f"Total articles found: {len(articles)}")
print(f"=========================================")
print("")

issues = []

for a in articles:
    title = a.get("title","UNKNOWN")
    slug = a.get("slug",{}).get("current","MISSING")
    excerpt = "YES" if a.get("excerpt") else "MISSING"
    seo_title = "YES" if a.get("seoTitle") else "none"
    body_length = a.get("bodyLength", 0)
    table_count = a.get("tableCount", 0)
    canonical = a.get("canonicalOwner","MISSING")
    sites = a.get("showOnSites",[])
    mcq = "YES" if a.get("hasMcqUrl") else "no"

    has_issue = False
    if body_length == 0: has_issue = True; issues.append(f"EMPTY BODY: {title}")
    if excerpt == "MISSING": has_issue = True; issues.append(f"MISSING EXCERPT: {title}")
    if canonical != "accountingbody": has_issue = True; issues.append(f"WRONG CANONICAL: {title}")
    if "accountingbody" not in sites: has_issue = True; issues.append(f"MISSING SHOWONSITES: {title}")
    if slug == "MISSING": has_issue = True; issues.append(f"MISSING SLUG: {title}")

    status = "⚠ ISSUE" if has_issue else "OK"
    print(f"[{status}] {title}")
    print(f"  Slug: {slug} | Excerpt: {excerpt} | SEO Title: {seo_title} | Body: {body_length} blocks | Tables: {table_count} | MCQ: {mcq}")
    print("")

print(f"=========================================")
print(f"ISSUES FOUND: {len(issues)}")
for issue in issues:
    print(f"  - {issue}")
print(f"=========================================")