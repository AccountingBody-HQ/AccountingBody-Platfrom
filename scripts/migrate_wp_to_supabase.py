import os
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]
XML_PATH     = Path("/workspaces/AccountingBody-Platfrom/accountingbodycom.WordPress.2026-04-03.xml")

NS = {
    "content":  "http://purl.org/rss/1.0/modules/content/",
    "wp":       "http://wordpress.org/export/1.2/",
    "dc":       "http://purl.org/dc/elements/1.1/",
    "excerpt":  "http://wordpress.org/export/1.2/",
}

CATEGORY_SLUG_MAP = {
    "Financial Accounting":  "financial-accounting",
    "Financial Management":  "financial-management",
    "Management Accounting": "management-accounting",
    "Financial Market":      "financial-market",
    "Business Management":   "business-management",
    "Audit and Assurance":   "audit-assurance",
    "Auditing":              "audit-assurance",
    "Tax":                   "taxation",
    "Economics":             "economics",
    "Cryptocurrency":        "cryptocurrency",
    "Tools and Templates":   "tools-templates",
    "Calculator":            "tools-templates",
    "Mock Exams":            "mock-exams",
}

def strip_wp_blocks(html: str) -> str:
    if not html:
        return ""
    clean = re.sub(r"<!-- /?wp:[^>]* ?/?-->", "", html)
    clean = re.sub(r"\[abcm_post_quiz\]", "", clean)
    clean = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", clean)
    clean = re.sub(r"\n{3,}", "\n\n", clean).strip()
    return clean

def get_meta(item, key):
    for meta in item.findall("wp:postmeta", NS):
        k = meta.find("wp:meta_key", NS)
        v = meta.find("wp:meta_value", NS)
        if k is not None and k.text == key:
            return v.text if v is not None else None
    return None

def get_categories(item):
    cats = []
    for cat in item.findall("category"):
        if cat.get("domain") == "category":
            cats.append(cat.text)
    return cats

def parse_pub_date(date_str):
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str.strip(), "%a, %d %b %Y %H:%M:%S %z")
        return dt.isoformat()
    except Exception:
        return None

def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Connected to Supabase: {SUPABASE_URL}")

    print(f"Parsing XML: {XML_PATH}")
    tree = ET.parse(XML_PATH)
    root = tree.getroot()
    items = root.findall(".//item")

    published = [
        i for i in items
        if (i.find("wp:status", NS) is not None and i.find("wp:status", NS).text == "publish")
        and (i.find("wp:post_type", NS) is not None and i.find("wp:post_type", NS).text == "post")
    ]
    print(f"Total published posts: {len(published)}")

    articles = [i for i in published if "Mock Exams" not in get_categories(i)]
    pq_posts = [i for i in published if "Mock Exams" in get_categories(i)]
    print(f"Articles: {len(articles)}  |  PQ sets: {len(pq_posts)}")

    # ── 1. Migrate articles ───────────────────────────────────────────────────
    print("\n── Migrating articles ──")
    art_ok = 0
    art_fail = 0

    for idx, item in enumerate(articles, 1):
        try:
            title    = item.find("title").text or ""
            slug_el  = item.find("wp:post_name", NS)
            slug     = slug_el.text if slug_el is not None and slug_el.text else ""
            if not slug or not title:
                print(f"  SKIP (no slug/title): {title!r}")
                art_fail += 1
                continue

            content_el = item.find("content:encoded", NS)
            raw_html   = content_el.text if content_el is not None else ""
            clean_html = strip_wp_blocks(raw_html or "")

            excerpt_el = item.find("excerpt:encoded", NS)
            excerpt    = excerpt_el.text if excerpt_el is not None and excerpt_el.text else ""
            excerpt    = excerpt.strip() if excerpt else ""

            seo_desc  = get_meta(item, "_yoast_wpseo_metadesc") or excerpt or ""
            seo_title = get_meta(item, "_yoast_wpseo_title") or title
            wp_id     = item.find("wp:post_id", NS)
            wp_id_str = wp_id.text if wp_id is not None else None
            pub_date  = parse_pub_date(item.find("pubDate").text if item.find("pubDate") is not None else None)
            author    = item.find("dc:creator", NS)
            author_str= author.text if author is not None else "accountingbody.com"

            cats = get_categories(item)
            cat_name = cats[0] if cats else ""
            cat_slug = CATEGORY_SLUG_MAP.get(cat_name, "")

            content_id = f"AB-ART-{idx:05d}"

            row = {
                "title":           title,
                "slug":            slug,
                "content":         clean_html,
                "excerpt":         seo_desc[:500] if seo_desc else "",
                "category":        cat_slug,
                "category_title":  cat_name,
                "exam_body":       [],
                "show_on_sites":   ["ab"],
                "seo_title":       seo_title[:60] if seo_title else title[:60],
                "seo_description": seo_desc[:160] if seo_desc else "",
                "status":          "published",
                "platform":        "ab",
                "canonical_owner": "accountingbody",
                "wp_id":           wp_id_str,
                "content_id":      content_id,
                "author_name":     author_str,
                "published_at":    pub_date,
            }

            supabase.table("articles").upsert(row, on_conflict="slug").execute()
            art_ok += 1

            if idx % 100 == 0:
                print(f"  {idx}/{len(articles)} articles done...")

        except Exception as e:
            print(f"  FAIL article {idx}: {e}")
            art_fail += 1

    print(f"Articles: {art_ok} inserted, {art_fail} failed")

    # ── 2. Migrate question sets + questions ──────────────────────────────────
    print("\n── Migrating question sets ──")
    qs_ok = 0
    qs_fail = 0
    q_ok = 0
    q_fail = 0

    for idx, item in enumerate(pq_posts, 1):
        try:
            title   = item.find("title").text or ""
            slug_el = item.find("wp:post_name", NS)
            slug    = slug_el.text if slug_el is not None and slug_el.text else ""
            if not slug or not title:
                qs_fail += 1
                continue

            difficulty = get_meta(item, "abcm_difficulty") or "advanced"
            topic      = get_meta(item, "_yoast_wpseo_focuskw") or ""
            seo_desc   = get_meta(item, "_yoast_wpseo_metadesc") or ""
            learn_url  = get_meta(item, "_abcm_learning_url") or ""
            wp_id      = item.find("wp:post_id", NS)
            wp_id_str  = wp_id.text if wp_id is not None else None
            pub_date   = parse_pub_date(item.find("pubDate").text if item.find("pubDate") is not None else None)
            quiz_json  = get_meta(item, "_abcm_quiz_json") or ""
            content_id = f"AB-QZ-{idx:05d}"

            # Extract article slug from learning URL
            article_slug = ""
            if learn_url:
                article_slug = learn_url.rstrip("/").split("/")[-1]

            set_row = {
                "title":           title,
                "slug":            slug,
                "excerpt":         seo_desc[:500] if seo_desc else "",
                "difficulty":      difficulty,
                "topic":           topic,
                "exam_body":       [],
                "question_type":   "multiple-choice",
                "show_on_sites":   ["ab"],
                "canonical_owner": "accountingbody",
                "seo_title":       title[:60],
                "seo_description": seo_desc[:160] if seo_desc else "",
                "article_slug":    article_slug,
                "wp_id":           wp_id_str,
                "content_id":      content_id,
                "platform":        "ab",
                "status":          "published",
                "published_at":    pub_date,
            }

            result = supabase.table("question_sets").upsert(set_row, on_conflict="slug").execute()

            if not result.data:
                qs_fail += 1
                continue

            set_id = result.data[0]["id"]
            qs_ok += 1

            # Parse and insert individual questions
            if not quiz_json:
                continue

            try:
                quiz = json.loads(quiz_json)
                questions = quiz.get("questions", [])

                for q_idx, q in enumerate(questions, 1):
                    try:
                        opts = q.get("options", [])
                        # Ensure exactly 4 options
                        while len(opts) < 4:
                            opts.append("")

                        correct_idx = q.get("answer", 0)
                        if isinstance(correct_idx, str):
                            try:
                                correct_idx = int(correct_idx)
                            except Exception:
                                correct_idx = 0

                        meta = q.get("meta", {})

                        q_row = {
                            "set_id":               set_id,
                            "question_order":        q_idx,
                            "type":                 q.get("type", "multiple-choice"),
                            "question_text":         q.get("question", ""),
                            "option_a":             str(opts[0]) if len(opts) > 0 else "",
                            "option_b":             str(opts[1]) if len(opts) > 1 else "",
                            "option_c":             str(opts[2]) if len(opts) > 2 else "",
                            "option_d":             str(opts[3]) if len(opts) > 3 else "",
                            "correct_index":         correct_idx,
                            "explanation":           q.get("explanation", ""),
                            "primary_topic":         meta.get("primary_topic", ""),
                            "difficulty":            meta.get("difficulty", "").lower() or difficulty,
                            "time_target_minutes":   meta.get("time_target_minutes", 3),
                            "points":               2,
                        }

                        supabase.table("questions").insert(q_row).execute()
                        q_ok += 1

                    except Exception as qe:
                        print(f"  FAIL question {q_idx} in set {slug}: {qe}")
                        q_fail += 1

            except Exception as je:
                print(f"  FAIL parsing quiz JSON for {slug}: {je}")

            if idx % 20 == 0:
                print(f"  {idx}/{len(pq_posts)} question sets done...")

        except Exception as e:
            print(f"  FAIL question set {idx}: {e}")
            qs_fail += 1

    print(f"\nQuestion sets: {qs_ok} inserted, {qs_fail} failed")
    print(f"Questions:     {q_ok} inserted, {q_fail} failed")
    print("\n── Migration complete ──")

if __name__ == "__main__":
    main()
