# Roadmap and Debt Register

**Status:** Controlled work ledger
**Updated:** 2026-08-12
**Current baseline:** `5948620314083008a73c668835f1ec789e36dab2`

This ledger contains only evidence-backed open work and explicit boundaries. Closed historical stages remain available in Git history and must not be kept as active debt.

## 1. Closed architecture phases and debt

| ID | Closure | Current proof owner |
|---|---|---|
| CLOSED-MEDIA-01 | Media Catalog/reference safety, global writer adoption, and public media truth use one owner | Media adoption manifest and Media verification suite |
| CLOSED-PROJECTS-01 | Project aggregate persistence, publication, database project truth, and row actions use current Project domain owners | Project migrations, parity audit, and Project capability guards |
| CLOSED-ATOMIC-01 | Menu ordering and Page Composition ordering are aggregate atomic mutations | Global Truth/Atomic migration and behavioral/Postgres guards |
| CLOSED-SEO-01 | Global SEO and shared Entity SEO owners are established and adopted | Global SEO and Entity SEO manifests/guards |
| CLOSED-DASHBOARD-01 | Dashboard KPIs and diagnostics use the Dashboard Truth read model | Dashboard Truth contract and guards |
| CLOSED-REPORTS-01 | Reports and Analytics use one Reports read model and one provider adapter registry | Reports/Analytics contract and guards |
| CLOSED-DB-01 | Repository migrations, Production registry provenance, public catalog ownership, RLS, indexes, constraints, views, and function overloads are reconciled | `verify-database-reconciliation.mts` structural/live modes |
| CLOSED-LEGACY-01 | Proven zero-consumer migration helpers, obsolete probes, stale RPC owner, and tracked QA artifacts are removed | Final database reconciliation structural guard |
| CLOSED-PAGES-01 | Pages and Page Block shell, table, assignment, editor, module-status, feed-module, and presentation contracts use their current owners | PRs #74–#81 and their targeted guards |
| CLOSED-PUBLIC-SEARCH-01 | Public Topics and media search use the entity-neutral public content read owner | `verify:public-content-search` and PR #83 |
| CLOSED-DELTA-82-01 | All remaining valid PR #82 behavior was reimplemented on current `main`; old owners/contracts/runtimes were excluded and PR #82 was closed superseded | `verify:pr-82-delta-recovery`, PR #84, and closed PR #82 |
| CLOSED-CI-PG17-01 | GitHub CI Media Coordination, Dashboard Truth, and Reports Analytics service jobs align with Production PostgreSQL 17 | `.github/workflows/quality-gate.yml`, exact-head checks, and PR #85 |
| CLOSED-DOC-DRIFT-01 | The stale Medium Hardening baseline and 74-version Production registry snapshot were replaced with the verified 2026-08-12 current state | Constitution Refresh review and read-only database inventory |

## 2. Open Product/Auth decisions

These are not Legacy or drift. They require authority beyond cleanup and must not be resolved by inventing local policy.

| ID | Decision | Why implementation is blocked | Required authority/proof |
|---|---|---|---|
| DEC-AUTH-01 | Role/permission matrix | Stored roles do not define an approved product authorization matrix | Product and security approval, server-boundary tests |
| DEC-AUTH-02 | Login throttling/lockout | Client identity, limits, reset, and support policy are product/security choices | Abuse model and security approval |
| DEC-AUDIT-01 | Compliance-grade blocking audit | Current Admin audit contract is intentionally non-blocking | ADR/product decision covering failure and availability semantics |
| DEC-FAILURE-01 | Maintenance dependency failure | Fail-open, fail-closed, and last-known-good produce different product outcomes | Product availability decision |
| DEC-FAILURE-02 | Redirect dependency failure | Outage and stale-cache behavior have different public outcomes | Product/operations decision |
| DEC-ANALYTICS-01 | External Analytics providers | Credentials, consent, retention, and business mappings are not repository facts | Provider activation plus privacy/business approval |
| DEC-OBSERVABILITY-01 | External monitoring and alerting provider | Vendor, billing, retention, PII policy, routing, and incident ownership are not repository facts | Product/Platform operations decision |

## 3. Open QA/environment gaps

| ID | Gap | Current safe boundary | Closure proof |
|---|---|---|---|
| QA-AUTH-E2E-01 | Reusable authenticated Admin save, real pending, and instant rollback Browser coverage | Public/unauthenticated behavior is automated; authenticated access is read-only through externally supplied Playwright storage state; Production mutation is prohibited | Isolated disposable Admin target, credentials/storage state, deterministic fixtures, and cleanup proof |

## 4. Outstanding architecture debt

No unresolved item is currently proven to be architecture debt under the constitutional definition. The executable Form and Interaction ledgers retain truthful `globalClosed: false` states because broader ledgers and authenticated Browser acceptance remain separate proof; they do not report an unregistered generic Form owner.

The sections below remain open as Product/Auth decisions, QA/environment gaps, measured risks, or compatibility boundaries. They must not be relabeled as debt merely to create a roadmap item.

## 5. Measured optimization backlog

No performance change is authorized by source size or query shape alone.

| ID | Area | Required evidence before implementation |
|---|---|---|
| PERF-02 | Page internal-link resolution | Multi-link request trace and cache-hit evidence |
| PERF-03 | Storage listing at scale | Object count, folder depth, latency, and provider request volume |
| PERF-04 | Redirect lookup at scale | Redirect cardinality, hit distribution, and query plan |
| PERF-05 | Client bundle boundaries | Route bundle report and React profiler evidence |
| PERF-06 | Project detail relation fan-out | Current relation cardinalities and read-only plans are small; re-evaluate only with route/query timing regression or material row growth |
| PERF-07 | Reverse FK lookups on low-cardinality/empty tables | Current live plans do not justify indexes; re-evaluate with table growth, delete/update latency, or query-plan evidence |

The measured Topics image-transfer bottleneck is closed by adopting the existing optimized Topic image owner for the Featured Topic. It is not an open caching or query-policy decision.

## 6. Roadmap

The roadmap is decision- and evidence-driven; no speculative Runtime or Capability build is scheduled.

1. Keep the architecture constitution, current-state record, ownership map, manifests, guards, and PR checklist aligned through the Contract Drift policy.
2. Address the Product/Auth decisions in Section 2 only after the named authority and security evidence exist.
3. Establish an isolated disposable authenticated Admin QA target before claiming mutable save/pending/rollback Browser closure.
4. Re-evaluate optimization items only when their required measurements exist; do not open implementation phases from suspicion alone.
5. Review the old Draft PR #1 only as a current-main delta. Never merge its old environment baseline or instructions without current architecture, migration, and security review.

## 7. Explicit compatibility boundaries

Compatibility is retained only while it has a proven live consumer or external contract.

| Boundary | Current rule | Retirement gate |
|---|---|---|
| `/images/**` and `/files/**` read values | Readable for existing content; never a Production write target or managed-delete target | Zero persisted/configured consumers plus safe media migration proof |
| Persisted legacy link values | Parsed by the shared Link owner; no parallel link runtime | Backfill and zero stored legacy link-kind proof |
| Omitted legacy form fields | Preserve existing association where the current contract explicitly distinguishes omitted from empty | All writers adopt explicit present/empty semantics |

## 8. Working rules

- Do not create a Runtime, Capability, System, adapter registry, or Source of Truth to address an item in this ledger unless current owners cannot be extended and an ADR is approved.
- Do not classify a file or database object as dead from age, naming, or zero package-script references alone. Prove active imports, runtime calls, database dependencies, operational use, and external contracts.
- Do not remove an explicit compatibility boundary until its retirement gate is satisfied.
- Keep migration file truth, live behavior, registry provenance, and deployment truth as separate proofs.
- Record completed future work here only long enough to replace the open item with its durable guard owner; preserve detailed history in Git/PR evidence.
