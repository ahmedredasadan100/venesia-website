# A10 — Authenticated Content Flows & Persistence Proof

Local review evidence, 2026-09-12. Baseline `eeb204bb890f97aaaffa902eaa0ca86541d16dca`, branch `codex/a10-authenticated-content-persistence-proof`, plus the uncommitted A10 delta. `globalClosed=false`; A04 remains deferred. This report extends the existing Form, Content Editor and Interaction adoption ledgers; it is not another registry or runtime.

## Environment and proof boundary

The app runs on loopback against a synthetic PostgreSQL/PostgREST database. Before writes, both the server environment and a real database read established the isolated target. Existing applicable SQL contracts were assembled locally; this is **not** a claim of whole-platform or Production schema parity. No Production data, backup/restore rerun, new migration, Auth bypass, permission-policy change, external service write or Git delivery occurred.

The current Admin Auth owner performed real login, password verification, active-user/session checks and cookie issuance. The active synthetic administrator saved the fixtures; an inactive identity was rejected. Secrets and session files remain in the ignored local evidence directory, outside this report.

All evidence below is under `.tmp-qa/a10-content/`. The local delivery and file fingerprint inventory bind the evidence to the exact delta. Failed attempts are retained separately. An application save or render claim requires its successful result record, not a screenshot, source assertion or mock alone.

| Consumer and action | Actual evidence | Boundary |
| --- | --- | --- |
| Auth and database isolation | `before-write-isolation.json`, `app-before-write-target.json`, `auth-result.json` | Real current Auth; synthetic active/inactive identities. No external Auth provider claim. |
| Live protected reads and preview access | `preview-access-results.json` | Four actual registered APIs return 200 for the real session and 401 anonymously; anonymous internal preview redirects to login. Category renders the saved Article in public Topics; Series renders its six assigned saved Topics in Admin. |
| Category create/edit/reload | `taxonomy-results.json` | UI → Action → Taxonomy owner → actual database → mounted reload. |
| Series create/edit/reload | `taxonomy-results.json` | Its category relationship contract is exercised separately. |
| Category/Series commands | `taxonomy-actions.json` | Information, visibility, duplication, trash, restore, final deletion; Category relation deletion rejection; declared preview destinations. Temporary duplicates removed. |
| Category/Series stale revision and retry | `taxonomy-conflict-results.json` | Two real editors; stale write rejected, submitted input retained, database unchanged by rejection, reload then successful retry. |
| Six Topic edit consumers | `content-results.json` | Real save/reload of shared fields and typed differences for article/news/press/site_update/video/gallery. Audit actor is the synthetic administrator. |
| Article and Video creation | `create-results.json` | Actual create form, Action, database insert, create-to-edit handoff and mounted reload. Other Media create payload combinations are not separately claimed. |
| Topic Row Actions | `topic-actions.json` | Article/Gallery duplication and lifecycle; Gallery visibility, featured, information and preview. Hidden Gallery public route rejects access while authorized preview remains available. Other type payload rules reuse the existing duplication/validation guards within their limits. |
| Six typed preview/public renders | `render-results.json` | Saved fixture → real read → browser rendering, with no page errors in accepted runs. Text, public Article FAQ, Video iframe and ordered Gallery URLs/alt/captions are checked. |
| Hero/Content save and reload | `blocks-results.json` | Each successful record names its exact schema branch and fields. Hero uses the real `replace_hero_template` RPC and publication trigger. Content uses its real save and assignment owners. |
| Hero/Content application failure and retry | `blocks-results.json` | Invalid identity rejected by the actual Action; database revision unchanged and inputs retained, then successful save. |
| Acceptance of the editor's own saved revision | `revision-save-results.json` | Real failure/retry on the final shared runtime; the successful redirect updates the revision and clears dirty state without a browser reload. A subsequent edit becomes dirty. |
| Hero/Content Media warning | `media-warning-results.json` | Real core save. Only one HTTP failure at the media-reference synchronization side service is injected; warning preserves saved data and a subsequent real retry succeeds. No mocked core RPC or save. |
| Hero/Content late read | `late-read-committed-results.json` | A second authenticated editor saves a newer revision. The first real RSC request is paused, newer input is typed, then the real request proceeds. A QA-only non-UI revision attribute outside the form proves the new payload committed before the input assertion. |
| Activity Log | `readers-results.json` | Real authorized actor/entity/date filters, next/previous pages and browser reload. No row commands exist. |
| Topics Without Image | `readers-results.json` | Real filters, pages, reload, information and edit navigation. No mutation or confirmation command is added. |
| Related Series rejection and report preview | `remaining-actions-results.json` | Series deletion with six linked Topics is refused without database change. The report's actual preview command opens and renders the saved Article. |

Successful block branches: Hero `internal-page` and `home-cinematic`; Content `generic/topics-intro`, `about-intro`, `vision-goals`, `about-approach`, `about-cta`, `about-principles`, `about-intro-single-image`, `topics-listing`, `search-platform`, `home-story`, `home-trust`, and `home-contact`. Each record enumerates tested fields. Shared failure/media-warning/late-read cases use internal Hero and generic Content, rather than being repeated for equivalent branches.

The late-read driver calls the existing `router.refresh()` from an ignored, test-only client probe; it adds no product route, screen, data or Auth bypass. The functional owner changes were copied into the isolated app with measurement attributes, local runtime configuration and Tailwind source scanning. The refresh probe was removed from its layout before the final compiled review runtime; ledger/documentation verification runs against the canonical checkout. This is not a byte-for-byte claim for the entire QA copy. External requests are blocked in the scoped browser harness and server fetch. Its original view-block matcher omitted the numeric topic segment, so earlier A10 runs do **not** prove browser view-request blocking; they ran in the server-excluded localhost environment. The matcher was corrected for subsequent review. The official Metrics browser cases separately isolate the endpoint and check the real localhost exclusion. Storage uploads and external video playback are not tested.

## Proven defects and existing owners

1. **Controlled SEO input loss.** The form-level native input observer ran before React's controlled input handler and triggered a render with the previous SEO state. The real Gallery save succeeded with old SEO values. `AdminEntitySeoPanel` now observes input/change on the owner document, after the React root handler, and filters events to its form. `seo-loss-before.json`/`seo-events.json` retain the failure; `seo-loss-probe.json` and six real save/reload records prove the correction.
2. **Content late-read input loss.** Keying the form by `updated_at` remounted it when an unrelated saved revision arrived, discarding newer input. The failure is retained in `late-read-commit-failure-content-*.txt`. The existing `AdminFormRuntime` now owns optional saved-revision acceptance through its live dirty/pending guard. Hero and Content pass that revision with a stable entity key. Clean revisions and matching successful submissions can reset the form; a dirty later edit prevents replacement. The private instance remains inside the same canonical owner. The mounted regression tests clean acceptance, dirty retention and subsequent acceptance; the actual RSC tests cover both consumers.

`scripts/qa-admin-form-guarded-navigation.mts` also tests the SEO event-order regression. Its transport-isolated mounted assertions support owner behavior only. Actual domain persistence claims come from the isolated application evidence above. The source guard now requires delegation of revision acceptance instead of requiring the destructive `id:updated_at` consumer key.

## Reused evidence and remaining gaps

PR153 owner/adoption evidence and the existing Duplication, publication validation, Gallery, Metrics and ADM-01 trigger evidence retain their original scope. They are not relabeled as authenticated end-to-end proof. Old Smoke view-request blocking remains **unproven**; no old Smoke round was rerun.

- Internal Article preview does not render FAQ under its current contract. Public Article FAQ is actually rendered and exercised. No new preview behavior is invented.
- External YouTube playback, Storage uploads and provider failures beyond the explicitly isolated Media synchronization fault remain unproved.
- Broad `registered-editor-save-round-trip`, `registered-public-content-rendering` and `form-save-parity-across-consumers` stay open beyond the enumerated fixtures, field options and create/failure combinations. Six successful types do not prove every optional field/state combination.
- Hero `project-detail`, Projects/Locations/Tracking, Pages and unrelated block editors, Settings, Users and Integrations remain outside this phase's behavioral coverage. A04 remains deferred.
- Category uses public Topics; Series uses filtered Admin Topics. No public Series page is declared. Full Home/Page Composition rendering is not inferred from a block save.

## Verification and review

The ignored local `DELIVERY.md`, `FILES.md`, `final-gate.json` and per-command logs record final checks and exact fingerprints. Four affected consumer Source Proofs, TypeScript, ESLint, the canonical full default build and the project gate recipe completed. The 34-assertion mounted form regression was reused unchanged. Two source guards were aligned with safe revision acceptance; their prior failures remain recorded.

The official browser layer initially selected an unrelated server on port 3000; that attempt is not accepted A10 evidence. On the isolated app, six cases passed and five encountered development reload/network-idle problems. Those five subsequently passed unchanged using `next build --experimental-build-mode compile`, `generate-env`, and `next start` on port 3002. This real on-demand SSR runtime avoids prerendering unrelated Projects against an intentionally incomplete Project fixture schema; it is not a full isolated platform build claim. The canonical full project build passed separately. A dedicated synthetic Search fixture supplies the existing test's fixed Arabic query, which had no match in the isolated inventory. Failed webpack/full-isolated/selective-build/start attempts remain evidence, not passes.

One optional gate entry, `verify-media-coordination-postgres`, was not executed because its dedicated isolated URL was not configured. Its optional exit code is not a concurrency proof. Existing isolated owner tests and the actual scoped media-warning proof keep their own boundaries. `review-browser-blocking.json` proves the corrected numeric view-endpoint matcher in one fresh read-only review: aborted before network, page rendered, isolated counter unchanged. It does not upgrade older blocking evidence.

Review starts at `http://127.0.0.1:3002/admin/login`. Synthetic fixtures are described in the local delivery inventory. The production checkout and unrelated local servers are not repointed to this database. No CI, deployment or Production behavioral claim is made by this local phase.
