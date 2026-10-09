# Phase 1 execution runbook

This is a reviewed one-time data cleanup using existing owners, not an automatically applied migration. The application/runtime has no code change. The SQL file is never imported by the app or CI.

## Authorization and target

The Project Owner authorized Phase 1 execution, one PR, full CI, Standard Merge Commit, Git-triggered Production, proof and branch cleanup. The owner separately confirmed the eight videos/six galleries are test material and may be unpublished with all files retained. Target Supabase project: pmqsfqvvekrlujqgurcu (venesia-website). Expected delegating owner: active admin 6, username ahmed. This is owner-authorized maintenance through the database command owner, not a claim of authenticated browser interaction.

Before changes, main/origin/GitHub were 59efae2a25fa0c61fb0b9984e71c0f92aa4dc46d; worktree clean; Foundation HARDENED/CLOSED; Git-triggered Production dpl_ETbG58hS6HetkfqZXpf6LtnCGMgT READY on that commit.

## Concrete data change

- Unpublish topics 1588,1592: exact aliases of 1521 after newline normalization, with matching FAQ/excerpt and pre-existing canonical to 1521.
- Unpublish site_update 1624–1630 (7), press 1632–1636 (5), video 1639–1646 (8), gallery 1647–1652 (6), news 1653–1661 and 1663 (10).
- Add two active permanent 301 rules in managed url_redirects from the two alias paths to /topics/final-faq-before-buy-beit-al-watan. No redirect for test records with no equivalent useful page.
- Preserve all 335 topic rows, stored SEO fields, body/FAQ/excerpt, slugs, media payloads, images and assets. No hard delete, soft delete or template mutation.
- Unpublish uses existing admin_mutate_topics_batch_atomically with a fixed command UUID, exact membership check and canonical immutable command audit. Redirect insert/audit use existing managed records and redirect.create vocabulary. Existing validateRedirectInput accepted both rules.
- Advance the existing public cache generation only after domain commit. This uses existing cache/sitemap publication logic.

## Safety gate and execution

1. Review the decision ledger and SQL. Retain the private full before snapshot outside Git. No credentials or draft content enter the PR.
2. Disposable PostgreSQL rehearsal must pass, including rejected actor, content drift, new incoming reference, late rollback, successful membership/preservation/audit/redirect and fail-closed replay. The actual deployed unpublish function was used. Rehearsal SQL SHA-256: 975d74eaa17defbcbbc3dd05e75c9d6ba90ae2b3ec8b625341a152a610048a0b.
3. Require targeted Foundation/lifecycle/redirect checks and all PR CI green on the exact final head; review architecture against existing domain, redirect and cache owners. No Admin consumer contract changes, so no new adoption manifest or parallel owner is introduced.
4. Standard merge with expected head. Wait for merge-SHA CI and automatic Vercel Production READY. Never manually deploy.
5. Reconfirm production project/host, read-only primary status, all 26 before fingerprints and actor identity. Use verified TLS with the independently sourced Supabase CA; never disable certificate validation. Do not print the connection URL.
6. Execute the exact reviewed SQL once via the project database connection. The bounded transaction locks reference/publication sources, checks fingerprints, exact alias equality and target count, calls the existing domain RPC and adds redirects/audits atomically. A mismatch aborts; do not replace expected hashes without re-review. The entire table guard deliberately ignores only topics.views_count. Set UTC for deterministic timestamp hashing.
7. After a transport error, inspect the fixed command receipt and both managed redirects before deciding whether anything committed. Do not blindly replay. If domain commit succeeded but generation invalidation failed, retry only advance_public_cache_generation. Record the distinction.
8. Independently compare all before/after tables. Require precisely 38 status/updated_at/updated_by changes, 2 redirects, 1 command audit plus 2 redirect audits. All other topic fields and all unrelated rows must match.
9. Read-only Production proof: test details 404; aliases 301 once to final FAQ (200/self-canonical); sitemap excludes all selected paths and remains at expected 282 URLs if unrelated publication is unchanged; retained case owners and Core/Projects/Topics/Media consumers 200; no links to selected paths in affected rendered consumers; redirects have no chains or loops.
10. Restore aligned clean main, remove only the merged authorized task branch and temporary execution processes. Keep private recovery evidence until accepted. Do not run SEO Content Optimization.

## Recovery

An error before commit rolls back the entire domain transaction including audits/redirects. A post-commit mistake requires a reviewed compensating operation; never delete immutable command receipts. Retained records can be republished through the existing Admin owner after publish validation, and the two managed redirects can be deactivated. Publication validation may reject test content; do not bypass that validator or blindly restore a full snapshot over concurrent work. The private before snapshot is the content recovery source. Cache invalidation is safely repeatable.

## Rehearsal evidence

- all 26 exact production before fingerprints reproduced in disposable PostgreSQL
- inactive actor rejected
- editorial drift rejected before mutation
- new incoming reference rejected
- late failure rolls back unpublish, redirects and audits together
- 38 unpublished; 2 managed 301s; 3 audits; cache generation advanced after commit
- replay fails closed without duplicate mutation

Limitation: disposable PGlite reproduces the relevant schema and actual deployed unpublish function, not the full Production extension/trigger environment or an authenticated browser journey. The real Production transaction retains all installed constraints/triggers and its preservation checks fail closed. Native browser automation was unavailable in this session; no browser proof is claimed. Targeted source/behavior verification and HTTP/DB proof are reported separately.
