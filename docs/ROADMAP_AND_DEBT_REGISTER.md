# Roadmap and Debt Register

**Status:** Controlled work ledger
**Updated:** 2026-07-25
**Official baseline:** `47b662d0761adeae15ada412652fc8c92f5e3d53`

This file records accepted, evidence-backed work. It is not a brainstorming dump and must not become a second project-state file.

## 1. Current phase

| ID | Work | Mode | State | Implementation authorized |
|---|---|---|---|---|
| AUDIT-001 | Full repository architecture, Runtime, Capability, pages, relationships, Quality Gate, and performance audit | Audit only | Completed and accepted on the official baseline | No |
| DOCS-RESET-001 | Canonical Documentation Reset | Documentation-only | Correction and closure pass in progress | Documentation scope only |

The audit completed without repository mutation. Its accepted findings are recorded below. Documentation Reset does not authorize implementation of any finding.

## 2. Classification rules

Every finding has a type and evidence level. A proven defect must remain separate from a verification blocker, performance risk, product decision, or optional proposal.

### Types

- Confirmed Defect
- Architecture Violation
- Runtime Adoption Gap
- Capability Adoption Gap
- Domain/Data Integrity Risk
- Performance Risk
- Security Risk
- UX/Accessibility Defect
- Specialized Exception
- Explicit Exception
- Architecture Debt
- Improvement Proposal
- Product Decision Required

### Evidence levels

- Proven from code
- Proven from contract/test
- Proven from Git
- Strong inference
- Needs Browser QA
- Needs database verification
- Needs Production evidence
- Needs Product decision

## 3. Priority model

| Priority | Meaning |
|---|---|
| P0 | Data loss, security exposure, wrong-source persistence, non-atomic corruption, Production storage risk, or Auth bypass |
| P1 | High architecture or functional defect, invalid boundary, broken rollback, or false broad closure |
| P2 | Adoption, measurable performance risk, and systemic UX/accessibility work |
| P3 | Diagnostics, developer experience, optional formalization, and non-blocking cleanup |

Product priority controls sequence. It does not erase, resolve, or downgrade technical risk.

## 4. Confirmed Defects

| ID | Priority | Classification | Evidence | Current behavior and risk | Correct owner | Product state | Required proof |
|---|---|---|---|---|---|---|---|
| AUD-01 | P0 | Confirmed Defect; Domain/Data Integrity Risk | Repository correction implemented in active branch | Media Catalog, typed providers, exhaustive live scan, and fail-closed delete replace the capped permissive scanner | Media reference/deletion capability | Repository foundation implemented; remote proof pending | Remote migration/reconciliation plus authenticated destructive failure-path proof before closure |
| AUD-02 | P0 | Confirmed Defect; Domain/Data Integrity Risk | Proven from code | Project root save and duplicate can commit before child operations finish, leaving partial aggregate state | Projects domain transaction/RPC | **Deferred by Product Priority** | All-or-nothing root/children failure injection, concurrency, and retry proof |
| AUD-03 | P0 | Confirmed Defect; Domain/Data Integrity Risk | Proven from code | Page/Menu delete and reorder flows use multiple independent mutations and can leave partial deletion or ordering | Page Composition and Menu domains | Active; second implementation priority | Transactional delete/reorder tests, parent failure, second-swap failure, and concurrent reorder proof |

## 5. Verification Blockers and Security Findings

| ID | Priority | Classification | Evidence | Current truth | Product state | Required proof |
|---|---|---|---|---|---|---|
| AUD-04 | P0 verification blocker | Security Risk | Strong inference; Needs database verification | Repository migrations do not prove live RLS, grants, policies, or anonymous denial for several sensitive tables | **Deferred by Product Priority** | Read-only remote table/grant/policy matrix and anonymous-access denial |
| AUD-05 | P1 | Architecture Violation; Security Risk | Privileged exports proven from code; exploitability unproven | Topic validation modules export privileged reads from `"use server"` modules without internal auth | **Deferred by Product Priority** | Build action manifest and controlled unauthenticated boundary tests before remediation |
| AUD-06 | P1 | Security Risk; Product Decision Required | Proven from code | Admin login has no application rate limiting, throttling, or lockout policy | **Deferred by Product Priority** | Approved abuse policy, trusted-client identity model, and concurrency tests |
| AUD-14 | P2 | Architecture Debt; Verification Blocker | Proven from test | Migration gate proves file presence, not applied order, checksums, registry provenance, or remote drift | Active proof requirement; no migration authorized | Read-only remote migration inventory and provenance contract |
| AUD-15 | P2 | Security Risk; Improvement Proposal | Repository private-cache correction implemented; Needs Production evidence | Media routes now emit private no-store headers; CSP/HSTS and deployed-edge behavior remain unproven | Security portion **Deferred by Product Priority** | Production response headers and cache behavior |
| AUD-19 | P2 | Product Decision Required | Proven from code | Roles are stored and editable, but active Admin users share the same real server-side access model | **Deferred by Product Priority** | Product authorization matrix before a Permissions capability is designed |

Security/Users hardening is one deferred workstream containing RLS/Grants verification, Permissions/Roles, login rate limiting, and Server Action hardening. The required timing is before final launch or multi-user operation.

## 6. Performance Risks

No performance number is accepted without measurement.

| ID | Priority | Risk | Evidence | Measurement required before optimization | Correct owner |
|---|---|---|---|---|---|
| AUD-08 | P2 | Topics initial-read and metrics amplification | Query structure proven; impact unmeasured | Server-Timing subsegments, query logs, row counts, and EXPLAIN | Topics read model |
| AUD-09 | P2 | Page block internal-link N+1 resolution | Per-link resolution structure proven; impact unmeasured | Multi-link page query trace | Link capability and Page composition adapter |
| AUD-10 | P2 | Menu item count per row | Per-menu count calls proven | Query count and aggregate/RPC comparison | Menus read model |
| AUD-11 | P2 | Recursive storage listing and linear redirect lookup at scale | Algorithms proven; scale impact unmeasured | Folder depth/object volume and redirect-cardinality benchmarks | Media Storage and Redirect owners |
| AUD-20 | P3 | Heavy client and bundle boundaries | Source-size risk only | Bundle analyzer, route JS sizes, and React profiler | Owning UI/domain surfaces |

## 7. Runtime and Capability Adoption Gaps

| ID | Priority | Classification | Current state | Active direction | Closure truth |
|---|---|---|---|---|---|
| AUD-12 | P2 | Runtime Adoption Gap | Media Topic create/edit, Projects create/edit, and Page quick-create remain generic Form Runtime gaps | Entity-by-entity adoption after owner defects are safe | Reference consumers are closed; Form Runtime is not globally closed |
| AUD-13 | P2 | Runtime Adoption Gap; UX/Accessibility Defect | Four declared native confirmation calls remain in three consumers | Adopt shared Confirmation with keyboard/focus Browser QA | Confirmation adoption is not globally closed |
| CAP-01 | P2 | Capability Adoption Gap | Media Topic Preview/Public View adoption remains incomplete | Dedicated reference-consumer tranche | Preview/Public View is partial |
| CAP-02 | P2 | Capability Adoption Gap | Publishing, SEO, Slug, and Visibility semantics remain partly shared and partly entity-local | Formalize only where a proven reusable contract exists | No global capability closure |
| CAP-03 | P3 | Improvement Proposal | Revision History, Localization, and Scheduling are not implemented as typed capabilities | Require product need and ADR before creation | Proposed only |

Projects-related Form adoption remains recorded but is **Deferred by Product Priority** with the Projects workstream.

## 8. Accepted Specialized and Explicit Exceptions

| ID | Workflow | Classification | Why it remains separate | Shared owners still required |
|---|---|---|---|---|
| EX-01 | Page Builder, Menus, and Footer builders | Specialized Exception | Composition and ordered-assignment lifecycles do not automatically fit a generic entity form | Design, Feedback, Confirmation, Media, link, audit, and collection contracts where applicable |
| EX-02 | Production Admin smoke for PR #18 | Explicit Exception | No trusted Admin session was available | The result remains Skipped, not Passed and not a software failure |
| EX-03 | Legacy media path compatibility | Explicit compatibility boundary | Existing `/images/**` and `/files/**` values may remain readable without permitting new Production filesystem uploads | Media Storage Adapter and managed-deletion rules |

## 9. Architecture Debt

| ID | Description | Risk | Planned handling | Removal proof |
|---|---|---|---|---|
| AUD-16 | Several verifiers prove text/marker presence without transactional or failure behavior | Regressions can pass CI | Add behavioral gates after the owning defect is fixed | Failure injection that fails before the correction and passes after it |
| AUD-17 | Admin Interaction adoption ledger contains stale/contradictory blocker text | False closure reporting | Reconcile during the relevant adoption tranche | Manifest and guard agree with a fresh consumer inventory |
| AUD-18 | Legacy media source labels and fallback semantics remain transitional | Duplicate-source confusion | Preserve until data/config provenance and retirement decision exist | Proven zero required legacy consumers and approved retirement |
| DEBT-04 | Migration provenance verification is shallow | False migration closure | Add registry/checksum/drift evidence later | Repository, remote behavior, and registry truth reconciled |
| DEBT-05 | Browser QA evidence for 390px, RTL, keyboard, focus, and sticky actions is incomplete | Shared UX regression risk | Dedicated UX closure stage | Authenticated browser evidence and cleanup proof |

## 10. Product and Architecture Decisions

| ID | Decision | Accepted state | Consequence |
|---|---|---|---|
| DEC-01 | Projects sequencing | **Deferred by Product Priority** | Preserve every Projects finding; execute Projects after the other active systems/capabilities |
| DEC-02 | Security/Users sequencing | **Deferred by Product Priority** | Execute before final launch or multi-user operation, not in current stages |
| DEC-03 | Maintenance dependency failure | Decision still required | Choose fail-open, fail-closed, or last-known-good behavior before changing runtime behavior |
| DEC-04 | Redirect dependency failure | Decision still required | Choose outage and telemetry behavior before implementation |
| DEC-05 | Audit durability | Current contract is non-blocking | Compliance-grade durable audit requires a new ADR/product decision |
| DEC-06 | Media reference source | Accepted in `ADR_MEDIA_CATALOG_REFERENCE_SAFETY.md` | Persist typed domain references, reconcile from exhaustive providers, and fail closed with a fresh live scan |
| DEC-07 | Performance budgets | Decision required after measurement | Do not create arbitrary gates before baseline evidence |
| DEC-08 | Legacy media retirement | Decision deferred | Do not remove compatibility without data and configuration proof |

## 11. Approved Roadmap

### Stage 0 — Documentation Reset closure

- Scope: canonical documentation, corrected references, QA evidence paths, staged static checks.
- Out of scope: every runtime, capability, data, security, and UI finding.
- Closure: documentation-only.

### Stage 1 — Media deletion safety

- Owner: Media reference/deletion capability.
- Scope: AUD-01 plus the approved catalog foundation required to make the reference source authoritative.
- Repository state: implemented in the active Media Library branch; remote migration, reconciliation, authenticated Browser QA, and declared adoption gaps remain open.
- Stop conditions: unknown reference owners, unproven remote environment, destructive cleanup, or registry drift.

### Stage 2 — Page/Menu atomic operations

- Owner: Page Composition and Menu domains.
- Scope: AUD-03 transactional delete/reorder behavior.
- Out of scope: general Page Builder redesign.

### Stage 3 — Runtime and Capability adoption gaps

- Scope: Form, Confirmation, Preview/Public View, Publishing, SEO, Slug, and Visibility tranches with one owner per tranche.
- Projects consumers remain deferred.
- No global closure without complete adopter inventory and guards.

### Stage 4 — Performance measurement, then optimization

- Measure Topics, links, Menu counts, Storage listing, Redirect lookup, hydration, and bundle boundaries.
- Implement only improvements justified by the measurements.

### Stage 5 — UI/UX, RTL, and responsive closure

- Require authenticated Browser QA at desktop and approximately 390px.
- Cover RTL, Tab/Shift+Tab, visible focus, dialogs, sticky actions, feedback, and reduced motion.

### Stage 6 — Projects

- Status: **Deferred by Product Priority**.
- Execute last after the other systems and capabilities.
- Preserve AUD-02 and all Projects adoption gaps until transactional and Browser proof exists.

### Stage 7 — Security/Users hardening

- Status: **Deferred by Product Priority**.
- Required before final launch or multi-user operation.
- Includes RLS/Grants verification, Permissions/Roles, login rate limiting, Server Action hardening, and production header evidence.

Do not combine unrelated stages into one large PR.

## 12. Documentation Reset state

The reset is actively applied on `chore/documentation-reset`:

- the canonical architecture constitution and seven supporting documents are staged;
- legacy reports, dated plans, and generated `docs/qa` evidence remain intentionally deleted;
- deleted artifacts remain available through Git history and must not be restored merely to repair a link;
- root documentation references point to canonical replacements;
- local QA scripts write routine evidence beneath `.tmp-qa/`;
- published migrations remain immutable, including historical documentation comments;
- closure requires clean working and staged diff checks for the approved scope.

## 13. Closure rule

This ledger records accepted evidence and sequencing. It does not close a Runtime, Capability, System, migration, security boundary, or Product stage by itself.
