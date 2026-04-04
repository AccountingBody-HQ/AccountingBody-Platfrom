content = """# Sanity Migration Scripts

## Before running any script
No setup needed — token loads automatically on terminal start.

## The Four Scripts

### 1 — Wipe Sanity clean
Deletes all articles from Sanity and clears the migration log.
Run this before a fresh migration.

    python3 /workspaces/AccountingBody-Platfrom/scripts/wipe_sanity.py

### 2 — Run the migration
Migrates WordPress articles to Sanity.
Currently set to 10 articles for testing.
Change posts[:10] to posts in the script for the full run.

    python3 /workspaces/AccountingBody-Platfrom/scripts/migrate_wp_to_sanity.py

### 3 — Full audit
Checks overall counts and totals against expected values.
Run this after a full migration to verify everything landed.

    python3 /workspaces/AccountingBody-Platfrom/scripts/audit_sanity.py

### 4 — Per-article audit
Checks every individual article for issues.
Run this after any migration to spot specific problems.

    python3 /workspaces/AccountingBody-Platfrom/scripts/audit_per_article.py

## Correct order for a full migration run
1. Run wipe_sanity.py
2. Run migrate_wp_to_sanity.py
3. Run audit_sanity.py
4. Run audit_per_article.py
"""

with open('/workspaces/AccountingBody-Platfrom/scripts/README.md', 'w') as f:
    f.write(content)
print('README written successfully')
