# QA, Release, and Closure Process

**Status:** Canonical verification and delivery contract
**Applies to:** Codex, Cursor, Claude, developers, and reviewers

## 1. Testing philosophy

Tests prove architecture and behavior, not only syntax.

A valid suite should detect:

- duplicate owners;
- stale contracts;
- unclassified consumers;
- unsafe migration assumptions;
- missing failure rollback;
- inaccessible interaction;
- false closure.

A green check on an older commit does not prove a newer commit.

## 2. Test layers

### Layer 1 — Architecture guards

Examples:

- required owners exist;
- obsolete duplicate owners are absent;
- adapters and adopters are registered;
- global closure remains false while generic gaps exist;
- native confirmation debt matches the declared ledger;
- client code does not import privileged providers.

### Layer 2 — Static quality

- TypeScript;
- ESLint;
- `git diff --check`.

### Layer 3 — Contract tests

- query parsing and normalization;
- adapter schemas;
- cache scope and rollback;
- structured Form action state;
- storage provider selection;
- Slug, SEO, publishing, taxonomy, and audit contracts.

### Layer 4 — Integration tests

- controlled Supabase operations;
- RPC atomicity;
- storage upload/list/delete;
- database count parity;
- migration/read-model behavior.

### Layer 5 — Browser QA

- real navigation;
- responsive layout;
- keyboard and focus;
- pending and dirty guards;
- Create → Edit handoff;
- instant list behavior;
- network counts;
- optimistic failure rollback;
- console/page/request health;
- cleanup.

### Layer 6 — Production build and CI

- Production build;
- GitHub Quality Gate on exact head;
- Vercel status where applicable.

### Layer 7 — Production smoke

Required only when Production behavior is part of the closure claim and a safe trusted session exists.

## 3. Development and release verification

Constitution Section 25.4 and ADR-028 define the Owner-approved sequence:

`Local Implementation -> Impact-Based Targeted QA -> Owner Visual Approval -> Local Commits -> Batch Final Quality Gate -> Push -> PR -> Required GitHub CI -> Ready -> Standard Merge -> Automatic Production`

Development Verification and Batch Release Verification are distinct. A small
change does not trigger the full release suite. Vercel Preview is not required
for Local development or Owner Visual Approval. Existing CI and branch
protection remain mandatory at release; this policy changes no platform setting.

## 3.1 Architecture review sequence

After the coherent implementation pass and targeted proof, apply the mandatory matrix in Constitution Sections 27.2 and 29.4.1 to every changed behavior.

The review reports only blocking issues and ends with:

```text
Architecture PASS | Architecture FAIL
Blocking Issues: <count>
Eligible for next authorized gate: yes | no
```

If the architecture direction is correct but blockers remain, perform one focused correction pass for those blockers only, rerun affected targeted checks, and run one final architecture review. Architecture PASS does not itself authorize Ready, Merge, deployment, migration, or Production mutation.

## 3.2 Development Verification

For each bounded change:

1. Identify the current owner, affected consumers, contracts, and risks.
2. Implement at that owner. New or materially extended Admin consumers retain the existing applicability preflight and post-implementation Source Proof; axes come from the Current Shared Capability Set.
3. Run targeted TypeScript, lint, and guards according to impact. Use existing supported commands; do not invent a parallel QA system or narrow a check so that affected shared consumers escape coverage.
4. Prove changed behavior, save/reload parity, and failure paths where relevant. For UI changes, select proof by impact on Desktop, Mobile, RTL, and relevant keyboard/focus behavior; reuse valid unaffected evidence under Section 3.4.
5. Correct actual defects and rerun only affected checks. Apply Section 3.1 where architecture is in scope.
6. Obtain Owner Visual Approval of appearance and function on Local, then create the authorized local commit after targeted checks pass.

Local Product Review follows Source Proof and targeted verification, without
waiting for remote CI. Local commits retain their evidence and approval; they
do not claim Ready, batch release, or Production closure. Documentation-only
local changes use Section 15's applicable consistency checks, without Browser
QA, UI approval, or a Full Quality Gate.

## 3.2.1 Shared UI visual regression protection

This standing Owner requirement applies to every current and future change to a
shared UI owner or its presentation contract. It uses Development Verification
and the existing QA commands/fixtures; it does not create a parallel runner,
manifest, approval system, or an additional Full Quality Gate.

Before editing, identify the canonical owner, its direct and indirect consumers,
and the exact screens/routes whose appearance can change. Record the intended
visual delta and preserve product behavior, controls, values, serialization,
permissions, and data/media ownership. An opt-in presentation change must also
identify consumers that retain the default contract.

After editing, run impact-based Targeted Visual Regression for the affected
consumers on Desktop, Mobile, and RTL, plus related keyboard/focus, save/reload,
and failure paths where relevant. Compare Before/After when evidence exists.
TypeScript, source/architecture guards, and functional success alone are never
proof of visual correctness. Correct a proven related defect at its existing
owner and rerun the affected checks only.

Use actual consumer components in isolated fixtures when a live screen cannot
be tested. Record fixture scope and transport substitutions, the exact live
screen/route requiring Owner review, and the visual/functional/manual status of
each affected consumer. Never label an unobserved screen visually verified or
change another consumer's appearance without documenting the impact.

Shared UI changes therefore require this bounded visual proof even when other
Local changes can use code-only checks under Section 6. Reuse valid unaffected
evidence under Section 3.4; do not repeat Full QA or broaden work to unrelated
modules. Final visual approval remains with the Owner, and local proof does not
authorize commits, release actions, or data mutations.

## 3.3 Batch Release Verification

At completion of the group of changes:

1. Freeze the committed Final HEAD and inventory the combined release scope, including QA fixes already in the branch.
2. Run one Full Quality Gate on that state using the existing release commands. Include the required Final Build and Public E2E; when the gate already runs them, do not run them again. `package.json` and the existing CI contract define the executable requirements.
3. Prove cleanup of owned fixtures/processes, preservation of original resources, and environment integrity; retain evidence under Section 8.
4. Perform authorized Push, prove branch alignment, and create the authorized PR with the evidence.
5. Require existing GitHub CI, including Admin Runtime verification, on the current PR head before Ready. Do not change required checks, branch protection, or Vercel settings.
6. Obtain separate Ready and Standard Merge authorizations. The existing integration deploys Production automatically after merge; Section 12 governs Production closure.

The full gate is a batch release requirement, not a prerequisite for each small
local commit. A stopped or incomplete gate is never a pass; record
`Stopped by Owner — Not Passed` when stopped by the Owner. Completed targeted
checks remain scoped evidence, not a replacement for unexecuted release checks.

## 3.4 Evidence validity after a HEAD change

For each reuse decision, record the original tested SHA/tree, new Final HEAD,
changed files, affected owners/consumers, relevant test/build inputs and
environment, retained receipts, and the checks to rerun with a reason.

- A documentation-only change can retain runtime evidence when the relevant source, dependency/configuration, test, and environment inputs are unchanged; verify the documentation delta separately.
- Product, shared-owner, contract, dependency/configuration, or QA-script changes invalidate the corresponding proof and affected consumer coverage. Rerun those checks and any affected build/E2E steps.
- Rerun the full gate when a material impact or contract requirement cannot be bounded and covered by valid retained proof plus affected reruns. Do not repeat successful unaffected checks merely because a SHA changed.
- Required GitHub CI must still pass on the current PR head; local evidence reuse does not waive remote required checks.
- Report executed-on-HEAD evidence separately from retained evidence with proven input equivalence. Never rewrite an old receipt or relabel an older gate as a fresh exact-head run.
- Release readiness requires complete valid coverage for the final state and successful cleanup. An old, failed, stopped, or incomplete gate alone cannot establish that coverage.

This is evidence accounting in the existing contract, not a new runner,
manifest, or QA system. Assertions may not be weakened and tests may not be
deleted to obtain a pass.

## 4. Repository command matrix

The current package exposes commands including:

### Core

```bash
npm run lint
npm run typecheck
npm run build
npm run verify
npm run ci:check
npm run test:e2e:public
npm run test:e2e:authenticated
```

### Architecture and Admin runtime

```bash
npm run verify:admin-entity-list
npm run verify:admin-data-engine-contracts
npm run verify:content-taxonomy
npm run verify:admin-form-system
npm run verify:venesia-modal-accessibility
npm run verify:seo-redirect-form-runtime
npm run verify:admin-instant-pages
npm run verify:admin-instant-projects
npm run verify:admin-shell-system
npm run verify:admin-runtime
```

### Data, media, audit, and content

```bash
npm run verify:migrations
npm run verify:database-reconciliation
npm run verify:database-reconciliation-live
npm run verify:legacy-media-admin
npm run verify:production-media-storage
npm run verify:media-library-system
npm run verify:unified-content
npm run verify:unified-content-db
npm run verify:topic-image-clear-persistence
npm run verify:audit-coverage
npm run verify:db-health
```

### Topic, Page Builder, and project contracts

```bash
npm run verify:topic-editor-basic-data
npm run verify:topic-editor-tabs
npm run verify:topic-publish-checklist
npm run verify:topic-seo-review
npm run verify:internal-slug-locks
npm run verify:page-builder-duplicate
npm run verify:composite-slot-rendering
npm run verify:composite-slot-behavior
npm run verify:assignment-presence
npm run verify:assignment-presence-behavior
npm run verify:route-slot-policy
npm run verify:projects-hub-readiness
```

The package manifest is the authority for the exact current command set.

The repository has one Playwright configuration and one reusable Browser test directory. The public/unauthenticated suite is CI-safe and starts the built application unless `E2E_BASE_URL` is supplied. Authenticated state is an external input through `E2E_ADMIN_STORAGE_STATE`; it is never committed. The authenticated suite is read-only unless an explicitly isolated, disposable fixture environment is established. Missing authenticated state or fixture authority is reported as `Skipped`/QA gap, never as passing mutable coverage.

For the Media Catalog foundation, a green static suite does not prove remote readiness. Report migration application, reconciliation, Admin authentication, Browser QA, and destructive-operation evidence independently. If no trusted Admin session exists, Browser QA is `Skipped`, not `Passed`.

Do not run every command mechanically. Select targeted proof, then the final gate required by scope.

## 5. Failure-path proof

A reusable Runtime or Capability is not closed through Happy Path only.

Relevant proof may include:

- invalid raw query;
- validation error;
- publish preflight failure;
- unsafe URL rejection;
- unauthorized session;
- duplicate submission protection;
- storage rejection;
- optimistic mutation failure and exact rollback;
- non-mutating failure before side effects.

## 6. Browser QA rules

During bounded Local development, default to targeted code checks according to
impact. Shared UI changes must additionally satisfy the targeted visual proof
in Section 3.2.1; the code-only default below does not waive that requirement.
For other changes, do not automatically open Browser Automation. If code checks
cannot prove the affected behavior, run only the minimum necessary Browser
Verification; explicit requests also authorize it, as defined in Constitution
Section 25.4 and ADR-028. Outside Section 3.2.1, do not create screenshots or visual
reports without a request.
Reuse the running Dev Server without a routine restart or a duplicate instance,
and use the expected authenticated session when required. Do not rerun successful
Browser QA without a change-related reason; retain valid evidence under Section
3.4. Final visual approval remains with the Owner reviewing Local directly.
Required architectural, behavioral, and release checks remain mandatory.

When Browser QA is needed, test the affected cases from:

- Desktop;
- approximately 390px;
- RTL;
- keyboard;
- focus;
- Tab and Shift+Tab;
- visible control focus;
- tab reveal before focus;
- dialog trap and focus return;
- sticky actions versus feedback;
- loading, empty, and error states.

When performance is claimed, record:

- list/API request count;
- duplicate first fetch;
- full document reload;
- stale response behavior;
- out-of-range page normalization;
- server timing or measured duration where available.

Do not claim performance numbers without measurement.

## 7. Fixture and cleanup policy

Use disposable fixtures.

Never mutate real Production data merely to prove a flow without explicit approval.

Track and remove:

- QA users;
- domain records;
- child relations;
- audit rows;
- preferences;
- uploaded files;
- temporary processes;
- disposable generated local artifacts, while preserving retained logs, receipts, and screenshots required by Section 8.

The report must prove cleanup or explicitly state what remains and why.

## 8. Evidence storage policy

Routine evidence must not bloat canonical documentation.

Use:

- PR body and review comments;
- GitHub Actions artifacts;
- Vercel logs;
- local `.tmp-qa/`;
- explicitly approved external evidence.

Do not commit routine screenshots and generated JSON under `docs/qa/`.

Repository QA scripts that generate local screenshots or JSON must write beneath `.tmp-qa/`. A script must create its required output directory and must not depend on previously committed QA artifacts.

Canonical docs should summarize accepted facts and link to durable evidence where appropriate.

## 9. Git verification

Before Commit:

- inspect `git status`;
- inspect staged and unstaged diffs;
- ensure only intended files changed;
- run `git diff --check`;
- record Commit SHA;
- after Push, prove local HEAD equals remote branch HEAD.

Do not use blind staging, force push, or destructive cleanup.

## 10. Ready gate

Ready requires:

- implementation scope complete;
- targeted checks pass;
- failure paths pass;
- required Browser QA passes;
- batch Final Quality Gate coverage is valid for Final HEAD, with any retained evidence and affected reruns explicitly justified under Section 3.4;
- required GitHub CI passes on the current PR head;
- Owner Local Visual Approval is recorded for UI changes;
- fixtures and processes are cleaned;
- branch is pushed and aligned;
- PR evidence is complete;
- Project Owner explicitly authorizes Ready.
- the mandatory Architecture Review matrix is complete and `Blocking Issues = 0` when architecture is in scope.

Ready does not authorize Merge.

## 11. Merge gate

Merge requires a separate explicit authorization.

Approved method:

- Standard Merge Commit;
- expected-head protection;
- no squash;
- no rebase;
- no auto-merge.

Record:

- pre-merge Base and Head;
- unresolved review thread count;
- checks;
- Merge Commit;
- main alignment.

## 12. Production gate

Production closure requires, when in scope:

- merged code;
- successful automatic Production deployment through the existing integration after authorized Standard Merge;
- exact deployment/commit relationship;
- safe Production smoke on declared routes;
- no real-data destruction;
- no manual Production deployment unless explicitly approved.

If no trusted Admin session exists:

```text
Production Admin Smoke: Skipped — no trusted Admin session
```

This is not a software failure.

## 13. Closure levels

Use only exact scoped claims:

- foundation closure;
- reference-consumer closure;
- adoption-tranche closure;
- capability closure;
- Runtime global closure;
- System closure;
- implementation closure;
- merge closure;
- Production closure.

Global closure requires a complete in-scope inventory, adoption or approved exceptions, no undeclared duplicate owner, architecture guard, failure proof, and exact-head verification.

## 14. Mandatory report

For a bounded Local-only handoff, list only changed files, targeted verification
results, local commit SHA, and Git status, then stop at the authorized boundary.
Do not repeat the localhost link. The detailed fields below apply to release or
closure reports and explicit detailed-report requests. Retain required evidence
without adding unnecessary report sections or rerunning QA merely to fill them.

### A. Proven Facts

Baseline, branch, final HEAD, scope, changed files, owners, tests, Browser QA, migrations, PR/check/deployment state, cleanup, and alignment.

### B. Gaps

Incomplete adoption, untested paths, debt, exceptions, and environment limits.

### C. Assumptions

Every inference not proven directly.

### D. Skipped

Every omitted check or action and its reason.

### E. Required Proof

What remains before the next broader gate.

Finish with one exact closure claim.

## 15. Documentation-only architecture refresh QA

A documentation-only architecture refresh should prove:

- only canonical docs, entry files, and approved ignore rules changed;
- no application, package, migration, database, environment, or deployment behavior changed;
- any QA-script change is limited to the approved local evidence output path;
- links and paths are valid;
- stale baseline claims were removed;
- accepted audit findings are separated into Confirmed Defects, Verification Blockers, Performance Risks, Adoption Gaps, and Product Decisions;
- product-priority deferrals remain recorded rather than deleted or treated as resolved;
- deleted evidence remains available in Git history;
- `git diff --check` passes;
- the Project Owner reviewed the canonical authority order.
- constitutional rule changes identify their evidence and ADR;
- stale implementation/adopter statements were compared with current manifests and guards;
- current SHA, PR, check, deployment, and database facts were independently reverified or explicitly labeled historical;
- Contract Drift, duplication, contradictory closure wording, and repeated rules were scanned;
- proofreading covers headings, numbering, code fences, local links, and terminology.

For a documentation-only correction pass, select the applicable checks below; a policy-only local commit does not require product/runtime QA or the batch release gate:

1. targeted reference scan for every deleted file and `docs/qa`;
2. syntax and output-path checks for any changed QA scripts, without Browser execution when behavior did not change;
3. `git diff --check`;
4. `git diff --cached --check`;
5. `git diff --cached --name-status`;
6. `git diff --cached --stat`;
7. `git status --short`.

Current findings and decisions come from `CURRENT_PROJECT_STATE.md`, `ROADMAP_AND_DEBT_REGISTER.md`, executable manifests, current guards, and independently verified environment evidence when explicitly in scope; an old audit baseline must never be treated as live truth.
