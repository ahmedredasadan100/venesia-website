# DEEP SYSTEMS PERFORMANCE AUDIT — 8-Axis Admin Performance Global Closure

Date: 2026-09-18  
Accepted baseline: `155f8fb59a3e1e018c38d8049c5c4f7b79e93817`  
Product-delta HEAD: `7e87576fdb9525232d76a0f8f9713aab01d389d2`
Scope: existing Admin Project/Page evidence plus the affected Project Save path; no Production benchmark or mutation

## Executive outcome

**Admin Performance Global Closure — NOT PROVEN.**

The accepted product correction is real and bounded: successful Project Save no longer repeats the `project_floor_plans`, `project_media`, and `project_videos` reads during post-save reconciliation. Required persisted-identity reads return a request-scoped reconciliation seed consumed by the existing `loadProjectEntry` owner. The deterministic request delta is `-3` for both Normal and Heavy Save, while authorization, atomic RPC, revision/concurrency, audit, revalidation, failure, and lease semantics remain intact.

The broader eight-axis audit does not support a universal performance closure. The remaining multi-second variance is concentrated at the remote data-fetch boundary. Current evidence can separate that boundary from browser work, local SQL execution on the fixture, and most local server residual work, but cannot causally split the remote tail among Production database execution, connection/queueing, PostgREST/Supabase service time, Docker/OS scheduling, and transport. No speculative optimization follows from that uncertainty.

## Eight-Axis Findings Matrix

| Axis | Evidence used / measurement added | Finding | Material bottleneck | Owner / source of truth | Delta | Status / remaining limit |
|---|---|---|---|---|---|---|
| 1. React rendering / rerenders / controlled-field fanout | Existing native CPU profile, readiness samples, tab actions, and exact 465-control/439-successful-entry Heavy fixture receipts. Whole-job `nativeFormData` self samples: Heavy `119.1→107.3 ms`; Normal `78.6→117.4 ms`. Heavy review recompute samples: `70.5→82.2 ms`; input/change samples `32.3→37.3 ms`. Tab medians remained about `19.7–37.4 ms`. | Large controlled form is measurable, but no repeatable dominant React rerender or controlled-field fanout regression was established. These self times are not total React, per-keystroke, or wall time. | **No material bottleneck proven.** | Existing `AdminFormRuntime`, Project form, and shared `serializeAdminForm`; no parallel owner. | No change. | **Measured / No material bottleneck / No change.** Independent React commit attribution remains unavailable and is not needed to explain the observed multi-second tails. |
| 2. RSC / Hydration / Flight | Existing App Router diagnostics. Page initial reads `22→13 GET`; decoded upstream DB bytes `24,419→4,717` (not Flight). Completed normalized Page-save RSC body `5,021→2,823 B`, headers `45.237→33.253 ms`, finish `76.4→79.8 ms`. SEO child decoded Flight `42,909→26,599 B`. Heavy Project Save decoded body `273,430→273,460 B`. | RSC read-shape reductions are proven where owners changed; Heavy Save Flight size is effectively unchanged and does not track the latency variance. Measured routes are subsequent App Router journeys, not a clean first-document hydration experiment. | **No material RSC/Flight bottleneck proven in the affected journeys.** | Existing Next App Router boundaries and page/project read owners. | No new change in this continuation. | **Measured / No material bottleneck / No change.** Initial-document hydration remains unisolated, but it is not evidence for the measured Save tail. |
| 3. PostgreSQL execution / plans / scans / DB vs transport | New targeted `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for the eight Heavy Project read shapes only. Execution range `0.029–0.113 ms`; planning `0.077–0.165 ms`; all relation access used PK/project indexes; `0` shared read blocks and no material rows removed. Atomic save RPC in prior evidence stayed about `52→47 ms`. | On the controlled fixture, SQL plans/scans are not the seconds-scale cause. The local plan result does not represent Production cardinality or isolate remote connection/queue/transport time. | **No material local query-plan bottleneck. Remote DB-vs-transport split not proven.** | Existing PostgreSQL schema/indexes and Supabase/PostgREST boundary. | No schema/index/query change. | **Measured / No material local bottleneck / No change.** Production execution and wait-event attribution remain a blocking evidence gap. |
| 4. Browser main thread / scripting / layout / paint | Existing Long Task and readiness evidence. Current Heavy diagnostic long tasks were `51/57 ms` before and `63/91 ms` after; readiness inspection was about `82.4→105.9 ms`. Native collector quiet overhead median `2.5→2.6 ms`. | Browser work is observable but too small to explain 1–3 second Save variance; no layout/paint or main-thread owner dominates the journey. Collector overhead is separated from product time. | **No material browser-render bottleneck proven.** | Browser + existing shared form/editor UI owners. | No change. | **Measured / No material bottleneck / No change.** Browser rendering is not assigned the remote/server tail. |
| 5. JavaScript delivery / parse / execute / eager loading | Existing frozen-build network/profile corpus: Heavy job load included 26 scripts, 2 stylesheets, and 5 fonts; no script/chunk source changed between the accepted cohorts. CPU profile did not identify an eager module as the Save critical-path cause. | Static delivery belongs mainly to document/job load, not the measured Save mutation. No causal parse/execute or eager-loading bottleneck was demonstrated. | **No material JS-delivery bottleneck proven for Save.** | Existing Next build/chunk graph and editor imports. | No change. | **Measured / No material bottleneck / No change.** No lazy-loading or memoization change is justified. |
| 6. Node / Next server work / serialization / RSC boundary | Existing full server traces and RSC bodies. Before Heavy diagnostic: provider-media read `1,180 ms`, reference RPC max `1,262 ms`, server span `1,541 ms`, UI `1,738.6 ms`. After earlier accepted cohort: provider-media `1,526 ms`, reference RPC max `1,590 ms`, server span `3,379 ms`, UI `3,702.5 ms`. Heavy Save body stayed near `273 KB`; the atomic mutation itself stayed tens of ms. | Server span growth co-occurs with awaited remote data-fetch tails, not body growth. Exact CPU/serialization time is not independently instrumented, but the stable body and small post-response browser work do not support serialization as the material cause. | **Material remote-fetch boundary; no material serialization bottleneck proven.** | Project save/read owners plus Supabase/PostgREST transport boundary. | Accepted `-3` duplicate reconciliation reads. | **Measured / owner-local bottleneck corrected; boundary tail remains.** Node CPU vs serialization is an upper-bound residual, not a claimed cause. |
| 7. Cold / Warm / Variance root-cause | Existing fixed-cohort results: Heavy warm open `173.2→177.9 ms`; Heavy client-reset/cold proxy `593.7→347.9 ms` (single sample, no causal claim); Normal warm open `108.4→178.3 ms`. Current quiet Save medians: Normal `301.0→421.8 ms` (After includes `3,088.6 ms`); Heavy `1,324.1→1,723.6 ms` (After `2,445.3/1,077.3/1,723.6 ms`). Host snapshots and matched collectors were retained. | Variance alone is not closure. DB: local plans sub-ms, remote DB waits unknown. Node/Next: full spans follow remote fetches. RSC serialization: stable Heavy body. Transport/service: hundreds-to-`1,590 ms` individual tails and strongest observed contributor. Browser: `≤91 ms` long tasks plus about `106 ms` readiness inspection. Harness: quiet collector median about `2.6 ms`; OS/Docker/VM scheduling cannot be excluded. | **Material variance remains. Primarily remote-boundary in observed traces; Product vs environment cannot be fully isolated.** | Supabase/PostgREST/connection/transport boundary; environment harness debt is separate. | No new product change. | **Measured / material unresolved gap.** Current evidence cannot apportion the remote tail among DB wait, service queue, bridge, network, or host scheduling. |
| 8. Heavy Editor Save pipeline | Existing end-to-end correctness, request trace, FormData, revision, audit, lease, synchronization, revalidation, restore, and exact fixture receipts. Diagnostic reads: Normal `39→36`; Heavy `49→46`. Quiet medians did not improve consistently. | Duplicate post-save reads were a proven request-amplification defect and are removed without changing the transaction or correctness contract. This is structural efficiency, not a proven latency win. | **One material request-amplification defect corrected; latency closure not proven.** | `saveProjectEntry`, project entry-data owner, and media coordination/reconciliation owner. | Real product delta: reuse request-scoped reconciliation seed; `-3` reads. | **Measured / corrected / regression-guarded.** Remaining tail is the Axis 7 boundary gap. |

## Targeted PostgreSQL plan receipt

| Read shape | Plan access | Actual rows | Planning ms | Execution ms | Shared hits / reads |
|---|---|---:|---:|---:|---:|
| Project root | `projects_pkey` Index Scan | 1 | 0.124 | 0.039 | 2 / 0 |
| Floor plans | `project_floor_plans_project_idx` Index Scan | 12 | 0.149 | 0.046 | 3 / 0 |
| Floor-plan details | indexed floor-plan scan + `project_floor_plan_details_plan_idx` Bitmap Index Scan | 48 | 0.165 | 0.113 | 27 / 0 |
| Locations | `project_location_points_project_idx` Bitmap Index Scan | 1 | 0.089 | 0.045 | 2 / 0 |
| Features | `project_features_project_idx` Bitmap Index Scan | 4 | 0.077 | 0.042 | 2 / 0 |
| Delivery | `project_delivery_items_project_idx` Bitmap Index Scan | 2 | 0.117 | 0.042 | 2 / 0 |
| Media | `project_media_project_idx` Bitmap Index Scan | 3 | 0.087 | 0.046 | 2 / 0 |
| Videos | `project_videos_project_idx` Bitmap Index Scan | 0 | 0.088 | 0.029 | 2 / 0 |

This receipt answers the missing plan/scan question only. It neither benchmarks Production nor converts a local fixture plan into a Production performance claim. The isolated measurement cleaned all 10 owned resources, preserved original resources, removed its private environment, and released its four ports.

## End-to-End Journey Matrix (reused evidence; not rerun)

| Journey | Before | After | Correctness / interpretation |
|---|---:|---:|---|
| Pages List → Page Editor, warm | 166.3 ms | 97.3 ms | Correct page, SEO, assignments, and actions usable; read-shape improved. |
| Pages List → Page Editor, client-reset proxy | 1,255.2 ms | 1,559.0 ms | Variable remote tails; no cold latency win claimed. |
| Module → Editor | 130.4 ms | 126.0 ms | Correct Content editor and actions. |
| Module Save → Page | 227.1 ms | 250.5 ms | Persist/reload/restore correct; no Save improvement. |
| Project Editor, Heavy warm | 173.2 ms | 177.9 ms | 465 controls, 439 successful entries, eight tabs correct. |
| Project Editor, Normal warm | 108.4 ms | 178.3 ms | 126 entries correct; open/read shape unchanged. |
| Project Save, Normal quiet median | 301.0 ms | 421.8 ms | `39→36` diagnostic fetches; correctness preserved; latency win not proven. |
| Project Save, Heavy quiet median | 1,324.1 ms | 1,723.6 ms | `49→46` diagnostic fetches; correctness preserved; latency win not proven. |
| Page SEO Save | 534.8 ms | 680.9 ms | Persisted/reloaded/restored exactly; remote tail remains. |

## Heavy Save pipeline attribution

The following values are deliberately not summed because several spans overlap:

1. Browser serialization/dirty comparison is tens to low hundreds of milliseconds in CPU self samples, not seconds.
2. Authorization and reference/provider reads can individually reach hundreds of milliseconds to `1.59 s` in full traces.
3. The atomic save RPC remains about `47–52 ms`; it is not the dominant tail.
4. Reconciliation previously repeated three required reads; the accepted owner-local seed reuse removes them deterministically.
5. Server Action spans can reach `1.541–3.379 s` when awaited remote calls tail.
6. Heavy decoded RSC output remains about `273 KB`; body growth is not the cause.
7. Browser Long Tasks and readiness inspection remain roughly tens to about one hundred milliseconds after the response, insufficient to explain the full outlier.

## Measurement Infrastructure Correction

Measurement corrections are not Product Performance deltas:

- The native 465-control collector calibration was median `9.95 ms` (`7.6–14.1`) versus roughly `4,069.7 ms` for the retired legacy lookup path.
- The current quiet readiness collector median was `2.5→2.6 ms`; it is retained in the journey rather than subtracted.
- The targeted database-plan run first encountered a lifecycle ordering error before measurement; the ordering was corrected, then the isolated run completed and cleaned its resources. No product code or data changed.
- Frozen cohort identity, restore-after-job, host snapshots, trace modes, and diagnostic/quiet separation remain measurement controls, not product improvements.

Further test-infrastructure redesign, causal tracing across the remote service boundary, or environment-wide scheduling telemetry is deferred as independent measurement debt.

## Architecture and source-of-truth review

- No new cache, runtime, registry, capability, schema, index, migration, or source of truth.
- No parallel Project entry owner and no persisted reconciliation cache.
- The seed is request-scoped and derived only from required post-save reads.
- No authorization, revision/concurrency, audit, revalidation, failure, lease, or partial-write semantic changed.
- No Production mutation, Auth/Cron/Permissions change, deploy, or migration occurred.

## Regression protection and verification ledger

Previously completed and reused without rerun:

- Project Admin Data Entry verifier: `127/127 PASS`.
- Production-mode isolated corpus: all `20 Before` and `20 After` jobs passed, including restoration after every warmup/sample/diagnostic.
- Fixed fixture logical identity: match.
- Existing typecheck and scoped lint: pass at product-delta HEAD.
- Request-shape guards assert reconciliation-seed reuse and prohibit the three duplicate successful-save reads.

Added in this continuation only:

- Targeted Heavy Project read-plan measurement for the eight affected read shapes: pass.
- Isolated lifecycle cleanup: complete; original resources unchanged.
- Report consistency/diff validation only; no code dependency changed, so `127/127`, `20/20`, Public E2E, and unrelated CI suites were intentionally not rerun.

## Blocking gaps and owners

| Blocking gap | Owner boundary | What is not proven |
|---|---|---|
| Remote read/RPC latency and variance | Supabase/PostgREST connection and transport boundary consumed by Project save/read owners | The split among Production PostgreSQL execution/waits, pooling/queue, service processing, network/bridge, and host scheduling. |
| Stable Heavy/Normal Save latency closure | Project Save journey, dependent on the remote boundary above | A repeatable end-user latency improvement or bounded variance; the structural `-3` request delta is proven, but quiet medians remain variable. |
| Production plan equivalence | Production PostgreSQL operational evidence owner | Whether Production cardinality, cache state, contention, and wait events match the sub-millisecond local indexed plans. No Production mutation or invasive profiling was authorized. |

React, RSC/Flight, browser main thread, JavaScript delivery, and local PostgreSQL plans were measured sufficiently to reject them as demonstrated dominant causes in the affected journeys. They are not listed as blockers merely because a deeper profiler could always collect more data.

## Exact closure claim

**Admin Performance Global Closure — NOT PROVEN.** The duplicate post-save reconciliation reads are corrected and regression-guarded, and all eight axes now have evidence-backed findings. The remaining material gap is high-variance remote data-fetch latency whose DB/service/transport/environment contributions cannot be isolated with the current evidence; therefore neither a stable Heavy Editor Save latency closure nor a Production-wide Admin performance closure is claimed. PR #168 must remain Draft, and this phase stops before Ready.
