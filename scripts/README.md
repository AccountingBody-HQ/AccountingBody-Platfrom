# Sanity Migration Scripts

## Before running any script
No setup needed — token loads automatically on terminal start.

## The Seven Scripts

### 1 — Wipe Sanity clean
Deletes all articles and practice posts from Sanity and clears the migration logs.
Run this before a fresh migration.

    python3 /workspaces/AccountingBody-Platfrom/scripts/wipe_sanity.py

### 2 — Run the article migration
Migrates 2,015 WordPress articles to Sanity as article documents.
Currently set to posts[:10] for testing.
Change posts[:10] to posts in the script for the full run.

    python3 /workspaces/AccountingBody-Platfrom/scripts/migrate_wp_to_sanity.py

### 3 — Run the quiz migration
Migrates 181 WordPress practice question posts to Sanity as practicePost documents.
Currently set to quiz_posts[:5] for testing.
Change quiz_posts[:5] to quiz_posts in the script for the full run.

    python3 /workspaces/AccountingBody-Platfrom/scripts/migrate_quiz_posts.py

### 4 — Full audit
Checks overall counts and totals against expected values.
Run this after a full migration to verify everything landed.

    python3 /workspaces/AccountingBody-Platfrom/scripts/audit_sanity.py

### 5 — Per-article audit
Checks every individual article for issues.
Run this after any migration to spot specific problems.

    python3 /workspaces/AccountingBody-Platfrom/scripts/audit_per_article.py

### 6 — Link authors
Links AccountingBody Editorial Team to all AccountingBody articles.
Links HRLake Editorial Team to all HRLake articles.
Run this after the full migration.

    python3 /workspaces/AccountingBody-Platfrom/scripts/link_author.py

### 7 — Link MCQ URLs
Updates article mcqUrl fields from old WordPress URLs to new
/practice-questions/[slug] paths.
Run this after both article and quiz migrations are complete.

    python3 /workspaces/AccountingBody-Platfrom/scripts/link_mcq.py

## Correct order for a full migration run
1.  Run wipe_sanity.py
2.  Change posts[:10] to posts in migrate_wp_to_sanity.py
3.  Run migrate_wp_to_sanity.py — approximately 11 minutes for 2,015 articles
4.  Change quiz_posts[:5] to quiz_posts in migrate_quiz_posts.py
5.  Run migrate_quiz_posts.py — approximately 1 minute for 181 posts
6.  Run audit_sanity.py
7.  Run audit_per_article.py
8.  Run link_author.py
9.  Run link_mcq.py
10. Reset migrate_wp_to_sanity.py back to posts[:10]
11. Reset migrate_quiz_posts.py back to quiz_posts[:5]
12. Commit everything to GitHub
