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

## 3. Default verification sequence

1. Run targeted checks while developing.
2. Fix actual defects.
3. Run only affected targeted checks after each correction.
4. Run Browser QA for changed behavior.
5. Prove failure paths.
6. Perform one focused correction pass.
7. Run one final full Quality Gate on the exact final HEAD.
8. Do not change code after the final gate without rerunning affected checks and, when material, the final gate.

Do not repeat expensive full suites without a code change, new evidence, a failed gate, or a defined risk.

## 4. Repository command matrix

The current package exposes commands including:

### Core

```bash
npm run lint
npm run typecheck
npm run build
npm run verify
npm run ci:check
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
npm run verify:legacy-media-admin
npm run verify:production-media-storage
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
npm run verify:project-child-fail-closed
npm run verify:projects-hub-readiness
```

The package manifest is the authority for the exact current command set.

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

Use one server and the expected authenticated session.

For changed UI, test:

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
- generated local artifacts.

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
- final Quality Gate passes on exact head;
- fixtures and processes are cleaned;
- branch is pushed and aligned;
- PR evidence is complete;
- Project Owner explicitly authorizes Ready.

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
- successful Production deployment;
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

## 15. Documentation-only reset QA

A documentation reset should prove:

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

For a Documentation Reset correction pass, run in this order:

1. targeted reference scan for every deleted file and `docs/qa`;
2. syntax and output-path checks for any changed QA scripts, without Browser execution when behavior did not change;
3. `git diff --check`;
4. `git diff --cached --check`;
5. `git diff --cached --name-status`;
6. `git diff --cached --stat`;
7. `git status --short`.

The accepted Full Repository Audit on baseline `9e420620f4a802dc8f070334c7d8d210a4a693f8` supplies the current finding inventory. Documentation Reset records that inventory and its product deferrals; it does not implement or retest those findings.
