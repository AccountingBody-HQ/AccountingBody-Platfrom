import os
import re
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SECRET_KEY"]

def fix_links(html: str) -> str:
    if not html:
        return html
    # Fix internal WordPress links: href="/slug/" or href="/slug" -> href="/articles/slug"
    # Only fix relative links that don't already start with /articles/, /practice-questions/, /study/, /jobs/, /get-help/, /glossary/, /courses/, /free-courses/
    def replace_link(match):
        href = match.group(1)
        # Skip already correct paths
        skip_prefixes = [
            '/articles/', '/practice-questions/', '/study/', '/jobs/',
            '/get-help/', '/glossary/', '/courses/', '/free-courses/',
            '/mock-exams/', '/firms', '/global-payroll/', '/contact',
            '/about', '/privacy', '/terms', '/cookie', '/accessibility',
            '/search', '/dictionary/', '/calculators/', '/dashboard/',
            'http', 'https', 'mailto', '#', '/sign-', '/dashboard'
        ]
        for prefix in skip_prefixes:
            if href.startswith(prefix):
                return match.group(0)
        # Fix /slug/ or /slug -> /articles/slug
        clean = href.strip('/')
        if clean and '/' not in clean:
            return f'href="/articles/{clean}"'
        return match.group(0)

    fixed = re.sub(r'href="(/[^"]*)"', replace_link, html)
    return fixed

def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Fetching all articles...")

    page = 0
    page_size = 100
    total_fixed = 0
    total_articles = 0

    while True:
        result = supabase.table("articles").select("id, slug, content").range(page * page_size, (page + 1) * page_size - 1).execute()
        rows = result.data
        if not rows:
            break

        for row in rows:
            total_articles += 1
            original = row["content"] or ""
            fixed = fix_links(original)
            if fixed != original:
                supabase.table("articles").update({"content": fixed}).eq("id", row["id"]).execute()
                total_fixed += 1

        print(f"  Processed {total_articles} articles, {total_fixed} updated so far...")
        if len(rows) < page_size:
            break
        page += 1

    print(f"\nDone. {total_fixed} articles had links fixed out of {total_articles} total.")

if __name__ == "__main__":
    main()
