import xml.etree.ElementTree as ET
import requests, json, re, os, time, uuid

# ============================================================
# CONFIGURATION
# ============================================================
XML_FILE   = "/workspaces/AccountingBody-Platfrom/accountingbodycom.WordPress.2026-04-03.xml"
PROJECT_ID = "4rllejq1"
DATASET    = "production"
TOKEN      = os.environ["SANITY_API_TOKEN"]
LOG_FILE   = "/workspaces/AccountingBody-Platfrom/scripts/quiz_migration_log.json"
API_URL    = f"https://{PROJECT_ID}.api.sanity.io/v2026-03-16/data/mutate/{DATASET}"
WP_NS      = "http://wordpress.org/export/1.2/"

# ============================================================
# LOG — Resumable migration. Completed posts are never re-sent.
# ============================================================
if os.path.exists(LOG_FILE):
    with open(LOG_FILE) as f: log = json.load(f)
else:
    log = {"done":[],"failed":[],"skipped":[]}

def save_log():
    with open(LOG_FILE,"w") as f: json.dump(log,f,indent=2)

def uid(): return uuid.uuid4().hex[:12]

def make_slug(text):
    slug = re.sub(r"[^a-z0-9-]","-",text.lower())
    return re.sub(r"-+","-",slug).strip("-")[:180]

# ============================================================
# NORMALISE DIFFICULTY
# Maps WordPress difficulty values to Sanity accepted values.
# Schema accepts: beginner, intermediate, advanced
# ============================================================
def normalise_difficulty(val):
    if not val: return None
    v = val.strip().lower()
    if v in ("beginner","intermediate","advanced"): return v
    if v == "hard": return "advanced"
    if v == "easy": return "beginner"
    if v == "medium": return "intermediate"
    return None

# ============================================================
# MAP QUESTION
# Maps a single WordPress quiz question to Sanity quizQuestion
# schema. Field mapping:
#   question          → questionText
#   type              → type
#   options           → options
#   answer            → correctIndex (zero-based)
#   explanation       → explanation
#   meta.primary_topic → primaryTopic
#   meta.difficulty   → difficulty (normalised)
#   meta.time_target_minutes → timeTargetMinutes
# ============================================================
def map_question(q, idx):
    meta = q.get("meta", {})
    diff = normalise_difficulty(meta.get("difficulty",""))
    doc = {
        "_type"            : "quizQuestion",
        "_key"             : uid(),
        "id"               : str(idx + 1),
        "type"             : q.get("type","multiple-choice"),
        "questionText"     : q.get("question",""),
        "options"          : q.get("options",[]),
        "correctIndex"     : q.get("answer", 0),
        "explanation"      : q.get("explanation",""),
        "primaryTopic"     : meta.get("primary_topic","") or None,
        "difficulty"       : diff,
        "timeTargetMinutes": meta.get("time_target_minutes") or None,
        "points"           : 1,
    }
    return {k:v for k,v in doc.items() if v is not None}

def send_to_sanity(doc):
    resp = requests.post(API_URL, headers={"Authorization":f"Bearer {TOKEN}","Content-Type":"application/json"}, json={"mutations":[{"createOrReplace":doc}]}, timeout=30)
    return resp.status_code, resp.json()

# ============================================================
# MAIN MIGRATION LOOP
# Finds all 181 practice question posts in the WordPress XML
# (identified by _abcm_quiz_json in post meta) and migrates
# them as practicePost documents in Sanity.
#
# These posts were SKIPPED by migrate_wp_to_sanity.py because
# they contain ONLY quiz JSON — no article body content.
#
# TO RUN TEST (5 posts): leave quiz_posts[:5] as is
# TO RUN FULL MIGRATION: change quiz_posts[:5] to quiz_posts
# ============================================================
print("Parsing XML...")
tree = ET.parse(XML_FILE)
root = tree.getroot()
items = root.findall(".//item")
posts = [i for i in items if
    i.find(f"{{{WP_NS}}}post_type") is not None and i.find(f"{{{WP_NS}}}post_type").text == "post" and
    i.find(f"{{{WP_NS}}}status") is not None and i.find(f"{{{WP_NS}}}status").text == "publish"]

quiz_posts = []
for item in posts:
    for meta in item.findall(f"{{{WP_NS}}}postmeta"):
        mk = meta.find(f"{{{WP_NS}}}meta_key")
        mv = meta.find(f"{{{WP_NS}}}meta_value")
        if mk is not None and mk.text == "_abcm_quiz_json" and mv is not None and mv.text and mv.text.strip():
            quiz_posts.append(item)
            break

print(f"Found {len(quiz_posts)} quiz posts")
success = failed = skipped = 0

for i, item in enumerate(quiz_posts[:5]):  # Change quiz_posts[:5] to quiz_posts for full run
    wp_id    = item.find(f"{{{WP_NS}}}post_id").text
    title    = (item.find("title").text or "").strip()
    slug_raw = (item.find(f"{{{WP_NS}}}post_name").text or "").strip()
    slug     = make_slug(slug_raw or title)
    date     = (item.find(f"{{{WP_NS}}}post_date").text or "")[:10]
    cats     = list(set([c.text for c in item.findall("category") if c.text]))
    metas    = item.findall(f"{{{WP_NS}}}postmeta")
    doc_id   = f"wp-quiz-{wp_id}"

    if doc_id in log["done"]:
        print(f"[{i+1}] SKIP: {title}"); skipped += 1; continue

    yoast_desc    = ""
    yoast_title   = ""
    difficulty    = None
    framework     = None
    exam_body     = None
    question_type = None
    quiz_json     = None

    for meta in metas:
        mk = meta.find(f"{{{WP_NS}}}meta_key")
        mv = meta.find(f"{{{WP_NS}}}meta_value")
        if mk is None or mv is None: continue
        if mk.text == "_yoast_wpseo_metadesc" and mv.text and mv.text.strip():
            yoast_desc = mv.text.strip()
        if mk.text == "_yoast_wpseo_title" and mv.text and mv.text.strip():
            yoast_title = mv.text.strip()
        if mk.text == "abcm_difficulty" and mv.text and mv.text.strip():
            difficulty = normalise_difficulty(mv.text)
        if mk.text == "abcm_framework" and mv.text and mv.text.strip() and mv.text.strip().lower() != "none":
            framework = mv.text.strip()
        if mk.text == "abcm_exam_body" and mv.text and mv.text.strip() and mv.text.strip().lower() != "none":
            exam_body = mv.text.strip()
        if mk.text == "abcm_question_type" and mv.text and mv.text.strip():
            question_type = mv.text.strip()
        if mk.text == "_abcm_quiz_json" and mv.text and mv.text.strip():
            quiz_json = mv.text.strip()

    if not quiz_json:
        print(f"[{i+1}] SKIP (no quiz json): {title}"); skipped += 1; continue

    try:
        data = json.loads(quiz_json)
        questions = [map_question(q, idx) for idx, q in enumerate(data.get("questions",[]))]
    except Exception as e:
        print(f"[{i+1}] FAIL (json parse): {title} -- {e}"); failed += 1; continue

    doc = {
        "_id"           : doc_id,
        "_type"         : "practicePost",
        "title"         : title,
        "slug"          : {"_type":"slug","current":slug},
        "publishedAt"   : f"{date}T00:00:00Z" if date else None,
        "excerpt"       : yoast_desc if yoast_desc else None,
        "seoTitle"      : yoast_title if yoast_title else None,
        "seoDescription": yoast_desc if yoast_desc else None,
        "difficulty"    : difficulty,
        "framework"     : framework,
        "examBody"      : exam_body,
        "questionType"  : question_type,
        "tags"          : cats[:10],
        "quizQuestions" : questions,
        "wpId"           : wp_id,
        "canonicalOwner": "accountingbody",
        "showOnSites"   : ["accountingbody"],
    }
    doc = {k:v for k,v in doc.items() if v is not None}

    status, result = send_to_sanity(doc)
    if status == 200:
        log["done"].append(doc_id); save_log()
        print(f"[{i+1}] OK: {title} ({len(questions)} questions)"); success += 1
    else:
        log["failed"].append({"id":doc_id,"title":title,"error":str(result)}); save_log()
        print(f"[{i+1}] FAIL: {title} -- {result}"); failed += 1
    time.sleep(0.3)

print(f"")
print(f"MIGRATION COMPLETE")
print(f"Success: {success} | Failed: {failed} | Skipped: {skipped}")
print(f"Log saved to: {LOG_FILE}")