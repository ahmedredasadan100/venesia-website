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

### 2.1 Responsibilities within the existing layers

These responsibilities classify the existing owners; they do not introduce a
second test registry or change any command, blocking rule or proof boundary.
One entry can protect several responsibilities. Select its actual supported
mode and arguments, rather than treating its filename as an execution identity.

| Responsibility | Protection and existing examples | Evidence boundary |
| --- | --- | --- |
| Engine | Form, Entity List and Data Engine owners; `verify-admin-form-system.mts`, `verify-admin-entity-list.mjs`, `verify-admin-data-engine-contracts.mts` | Execute the actual owner through its existing ports; source/import checks alone do not establish behavior. |
| Capability | Form Section/Field composition and Page Block presentation; the two existing Form/Page Block entries share `fixtures/admin-form-section-contract.mts` vectors | Preserve positive, negative and boundary states, native children/callbacks, and approved standalone geometry. Caller binding and consumer checks remain local. |
| Contract | Save/cache failure, taxonomy and media RPC contracts; `verify:admin-query-save-failure-contracts`, `verify:content-taxonomy`, `verify:media-coordination-rpc-acl` | Data shape, rejection, rollback and permissions remain owned by their current contracts and guards. |
| Adoption | Current Shared Capability Set and Collection/Form manifests; `verify:consumer-capability-adoption`, existing content-editor and Page Block adoption checks | Applicability, Source Proof, observed behavior, presentation and Owner approval remain distinct. Generated or unresolved consumers remain explicit gaps. |
| Functional | Existing save/edit/delete/duplicate/failure/read-back journeys and their domain owners | A controlled owner test proves its tested ports; Browser or persisted round-trip claims require that actual runtime. |
| Integration | Existing isolated Supabase/Public owner, `*-postgres` entries, PGlite fixtures and Public/Admin Browser journeys | Keep PG17, PGlite and Browser environments separate. Do not run a writable entry with Production data or real credentials. |

Shared vectors remove duplicated assertion maintenance, not ownership or the
independent execution of each consumer entry. Retain consumer-specific checks,
failure propagation and source-provenance inputs when extracting a fixture.
Consolidation requires an explicit before/after obligation map and rejection
controls; name, age, size, or an import edge alone never justifies retirement.

## 3. Development and release verification

Constitution Section 25.4 and ADR-028 define the Owner-approved sequence:

`Local Implementation -> Impact-Based Targeted QA -> Owner Visual Approval -> Local Commits -> Risk-Selected Batch Local Verification -> Push -> PR -> Required GitHub CI -> Ready -> Standard Merge -> Automatic Production`

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

## 3.2.2 Same-task maintenance of affected verification

Every local development task must discover, test, and maintain its entire
affected verification chain within that task: direct and indirect consumers,
Product Tests, Guards, test scripts, Fixtures, and CI Workflows. Use the current
owners, contracts, manifests, command registrations, and execution/CI entry
points to identify impact; do not create a parallel inventory, runner, or QA owner.

Before editing, identify the affected paths and expected behavior. During
implementation, maintain their affected checks and fixtures at the existing
owners. Correct proven stale expectations in the same task; do not defer that
maintenance until release. Before local completion, record changed behavior,
affected checks, failure classifications, corrections, retained evidence, and
remaining blockers. An affected mandatory Development Verification check that
is failed, blocked, skipped, or unverified prevents claiming local completion.

Classify each failure from evidence before changing an expectation:

| Cause | Required response |
| --- | --- |
| Proven Product or Contract regression | Correct the existing owner within the approved contract and scope; rerun affected consumer and regression checks. |
| Proven stale test or guard expectation | Show the approved current contract and matching observed behavior, plus the expected/actual mismatch; correct the expectation at its owner while preserving positive, negative, and boundary coverage. Current code or a failed assertion alone is not that proof. |
| Fixture, harness, guard implementation, or CI workflow defect | Repair the existing verification owner and affected dependents; preserve the behavior and security properties being asserted. |
| Environment, tooling, or external dependency failure | Record the evidence and its effect on coverage; correct or rerun only within the existing authority. Report unavailable proof as blocked/unverified, never PASS. |
| Cause not yet established | Retain the failure evidence and investigate within scope; do not presume a stale expectation or claim PASS. Existing Stop Conditions still apply. |
| Unresolved Product, Architecture, security, permission, or data decision | Apply the existing Stop Conditions to the affected boundary; do not invent policy or expand authority. |

An unrelated baseline finding requires current evidence and an explicit scope
boundary; it does not authorize unrelated fixes or reopening accepted work.
An unresolved mandatory Development Verification gate remains a blocker even
when its cause is outside the implementation scope. Necessary affected
verification maintenance is part of the task, while unrelated QA improvements
remain out of scope.

Do not delete or weaken assertions, narrow affected consumer coverage, disable
security checks, or convert failure to Skip to obtain a pass. Preserve failed
receipts and historical fixture/measurement identities under Section 3.4; never
relabel old evidence as a new execution. Reuse valid unaffected evidence and
rerun affected checks only. This obligation does not add a Full Quality Gate to
each small change or require remote CI before Local Product Review. Workflow
maintenance uses applicable local checks; required GitHub CI remains a release
gate on the current PR head under Section 3.3.

Constitution Sections 25.4 and 28.8, existing ownership, contracts, Source of
Truth, Stop Conditions, and authorization boundaries remain unchanged. This
rule grants no additional Product, Architecture, Auth, Permission, Database,
Migration, required-check, branch-protection, or Vercel-setting authority.
Documentation-only work uses the applicable consistency checks in Section 15.

## 3.3 Batch Release Verification

At completion of the group of changes:

1. Freeze the committed Final HEAD and inventory the combined release scope, including QA fixes already in the branch.
2. Complete the risk-selected local release profile under Constitution Section 25.4 and Section 3.3.1 below. Bounded A/B do not automatically require Full Local Gate; C/D require Full Local Gate plus affected specialized proof, and unresolved/unbounded E requires Full Local Gate. Use existing commands and owners. Include Final Build, Product Surface, Platform Contracts, Public E2E, and cleanup for A/B Product batches; when the selected gate already runs a required step, do not run it again. `package.json` and the existing CI contract remain the executable authorities.
3. Prove cleanup of owned fixtures/processes, preservation of original resources, and environment integrity; retain evidence under Section 8.
4. Perform authorized Push, prove branch alignment, and create the authorized PR with the evidence.
5. Require complete existing GitHub CI, including Admin Runtime verification, on Exact HEAD before Ready. Required checks, Branch Protection, Post-Merge CI, and Vercel deployment policy remain unchanged; do not skip or weaken a required check to obtain PASS.
6. Obtain separate Ready and Standard Merge authorizations. Standard Merge Commit retains Expected Head SHA protection. The existing integration deploys Production automatically after merge; Section 12 governs Production closure.

The selected profile is a batch release requirement, not a prerequisite for each
small local commit or permission to cross an authorized Local-only stop. The
documentation-only exception in Section 15 remains applicable. A stopped or
incomplete required gate is never a pass; record
`Stopped by Owner — Not Passed` when stopped by the Owner. Completed targeted
development checks remain scoped evidence, not a replacement for unexecuted
requirements of the selected release profile.

### 3.3.1 Risk and impact-based check selection

Constitution Section 25.4 owns classes A–E. Classify the combined batch, including
QA changes, against the actual behavior and contracts rather than its label or
file count. A/B eligibility requires positive proof of bounded presentation
impact and unchanged behavior/contracts. C/D require Full Local Gate. Mixed E
takes the highest constituent risk; unknown/conflicting dependencies or inability
to prove bounded impact require Full Local Gate. Architecture or verification-
execution code changes are high risk and require Full Local Gate; they cannot
be relabeled A/B because the diff is small. Documentation-only work retains
Section 15's applicable checks.

Record this decision in the existing QA evidence, not a new registry, manifest,
runner, or source of truth:

1. Baseline and final SHA/tree, all changed files, combined risk class and rationale, boundedness proof, and any unknowns.
2. Canonical owners, affected contracts, direct and indirect consumers, routes, and affected Tests/Guards/Fixtures/scripts/workflows; cite the existing manifests, registries, executable graph, and relevant non-import dependencies.
3. Selected existing commands and proof obligations, each linked to its affected owner/consumer/contract. For a declared unaffected boundary, record why its inputs and contracts are unchanged; absence from the import graph alone is never that proof, especially for CSS, images, SQL, fixtures, configuration, and dynamic reads.
4. Executed checks and receipts, mandatory visual/behavior coverage, failures and cleanup, plus any retained evidence with input/contract equivalence under Section 3.4. Never use a prior PASS solely because its SHA, path, or timestamp looks suitable.

Operationally, provide this reviewed batch record through the existing
`PublicGateRequest.localVerification` in `scripts/lib/isolated-public-verification.mts`.
Its typed contract and `planLocalVerification` bind the actual source delta to
existing named npm checks, followed by the four canonical Public gates above.
This is reviewed classification with conservative risk floors, not an automatic
semantic classifier. Affected Test/Guard/Fixture execution needs a positive
binding to a current command and executable graph; missing or conflicting edges
expand verification or block the unsupported claim, never prove exclusion.
The existing focused contract guard is
`node --experimental-strip-types scripts/verify-isolated-supabase.mts --local-risk-verification-only`.

The same reader derives an ephemeral source-impact report from the exact current
snapshot and baseline Git bytes. It consults the existing Collection/Form and
Current Shared Capability Set declarations, executable graph and literal source
inputs to report owners, capabilities, consumers, contracts, candidate checks
and unresolved relationships. These are discovery results, never Behavioral
PASS. Candidates do not automatically execute Browser, database or other
expensive commands. Review actual effects, mode/arguments, non-import inputs and
cleanup before selecting the existing commands. Unknown mappings cannot justify
a bounded release.

For an actual read-only Git inspection, use the same existing verifier:
`npm run verify:isolated-supabase -- --change-impact-only --impact-baseline=<40sha>`.
Add `--additional-source=<file>` for each explicit new source input; private and
generated inputs are rejected. Discovery returns `REVIEW_REQUIRED` or `DRIFT`
with exit 2, not PASS. Supply `--impact-record=.tmp-qa/<reviewed-record>.json` to
check the existing typed batch record against current bytes. A valid record can
return `PASS_SOURCE_CONSISTENCY` (exit 0) only with positive affected-verification
bindings and maintained obligations; malformed/unsafe input is blocked (exit 1),
and drift remains exit 2. This manual mode has `checksExecuted=0` and
`releaseEvidence=false`. Run it as part of the existing reviewed impact workflow
before an authorized push. It cannot authorize a gate, mutate a contract or
substitute for execution. No mandatory local pre-push hook is installed.

The existing `quality-gate` job also invokes the same owner with
`npm run --silent verify:isolated-supabase -- --ci-change-impact` immediately
after `npm ci`, before Browser installation. This automatic mode checks actual
snapshot/delta bindings, current contract projection and applicable changed
assertion/vector correspondence. It reads immutable event Git objects from
`GITHUB_EVENT_PATH`: PR base/head and the actual head or merge checkout, or push
before/after. The checkout must equal `GITHUB_SHA`, history must exist locally,
and the baseline must be an ancestor. Optional `merge_commit_sha` is advisory
metadata: a supplied non-null value must still be a nonzero lowercase 40-hex
SHA, but its existence or equality cannot select or authorize the checkout.
The retained diagnostic CI event proved that this field can differ from the
actual checkout while that checkout, base/head objects and both ancestry checks
are valid. Every merge checkout therefore requires exactly two ordered local
Git parents equal to the immutable event base and head, regardless of whether
advisory metadata is present, absent, null, locally available or outdated. An
exact event-head checkout retains the same HEAD/GITHUB_SHA identity and baseline
ancestry requirements. This independent identity proof does not infer a
baseline/ref. Missing/zero/foreign/non-ancestor authoritative objects, malformed
advisory values, unsupported events and changed tracked checkout bytes fail
closed; there is no
fetch, guessed baseline, shell interpolation of event values, or borrowed local
approval record. Use the existing full-history checkout without persisted Git
credentials. The source step blanks all three existing Supabase environment
values before Node starts, executes no candidate command and has no Browser,
database or fixture lifecycle. Its sanitized JSON report alone is retained as
an attempt-specific artifact after success or failure; missing evidence fails.

CI admission failure also retains a bounded `ciBinding` diagnostic from the
original in-memory event: canonical SHA bindings, the original commit lookup
exit/identity, local object types, parents and ancestry query outcomes. It
excludes event text, arbitrary values, environment contents and Git stderr.
These probes preserve the failed exit and never fetch or authorize execution.

Automatic `PASS_AUTOMATIC_SOURCE_PROTECTION` means syntactic source protection
correspondence only. `ownerReviewSatisfied=false`, `behavioralPass=false` and
`releaseEvidence=false` remain explicit. Missing correspondence is `DRIFT`
(exit 2) with file, owner, contract and registered consumer diagnostics; unsafe
provenance is blocked (exit 1). A changed assertion linked to a changed contract
does not prove its relevance, equivalent coverage or Owner approval. Human
contract review and applicable runtime/failure proofs remain mandatory, and
expectations are never generated or rewritten from implementation changes.

The JSON separates executed Fast source checks from explainable Targeted
candidate commands. Each candidate retains the current named command, exact
literal command steps and changed-file/owner/contract/consumer reasons. It has
`executionAllowed=false`, unknown effects and an unexecuted proof level until
its real harness, environment, cleanup and behavioral evidence are qualified.
Functional code changes retain functional and native integration/readback
obligations and a conservative `ci:check` requirement; unmapped inputs also
retain Full. A narrowly recognized literal JSX padding/radius-only change can
avoid that functional classification only when every other AST/class token is
unchanged. This is a selection fact, never visual approval. Declared geometry,
presentation/adoption obligations and applicable visual guards remain binding;
opaque CSS or unproved mappings cannot authorize bounded release.

This early source check does not prune or condition the existing eight CI jobs,
their isolated services, Browser setup or complete `npm run ci:check`. Fast
failure propagates to the same required job; a report is not a replacement gate.
Full Regression remains mandatory under release/risk policy. Local targeted
verification of this integration is separate from actual GitHub execution and
does not establish remote CI timings or Release Readiness.

One separately selected execution mode exists at the same verifier:
`npm run verify:isolated-supabase -- --execute-qualified-impact --impact-baseline=<40sha>`.
Use it only within an authorized targeted runtime task after qualifying the
actual effects. It first requires automatic source consistency for an explicit
immutable baseline and the complete current tracked snapshot; approval records,
untracked additions, stale selectors and arbitrary commands cannot authorize
execution. Current manifest owner bindings, actual changed inputs, registered
literal command steps and the reviewed harness bytes qualify one existing leaf:
`node --experimental-strip-types scripts/qa-admin-form-guarded-navigation.mts --save-cache-only`.
The exact flag selects thirteen existing controlled save/cache scenarios; it
rejects additional or combined flags before allocating resources. A changed
qualification input blocks the affected family for review. Unmapped families
remain unexecuted under their existing gates. If no qualified family is
affected, the result is `NOT RUN`; an applicable but unqualified family is `BLOCKED`.
The execution API accepts only that baseline and derives actual source impact
again inside the owner; caller-supplied analysis cannot become authority. Its
reviewed fixture fingerprint uses canonical LF text for the effect contract,
while the complete source snapshot remains bound to raw file bytes. The current
execution pilot supports `win32` only: unsupported platforms return `BLOCKED`
before starting the leaf because equivalent process-tree timeout cleanup has
not been proved there. Linux source selection and the ordinary mandatory CI
commands retain their existing behavior and obligations.

This leaf mounts the actual Form Runtime, Entity List controller and QueryClient
with controlled action results and an in-memory source. It covers confirmed
save/warning, Create-to-Edit handoff, cache-settlement failure, error/throw/no
confirmation, opt-out, plain/controlled second-save failure and a fresh list
read without resaving. This is `shared_owner_controlled_browser_behavior`, not
native Database persistence, authenticated domain save or behavioral adoption
of every applicable business consumer. The existing source report's
`behavioralPass=false`, `ownerReviewSatisfied=false` and `releaseEvidence=false`
remain intact; `qualifiedBehavioralPass` can describe only this actually
completed family. Native readback, permissions, duplicate/data-loss protection,
consumer parity and all other applicable obligations retain their existing
owners and required verification.

Execution reuses the existing owned Node-child lifecycle, log writer and cleanup
ports in `isolated-public-verification.mts`; it does not prepare or pretend to
have Supabase readiness. It uses a fresh owned evidence/TEMP directory, a
restricted credential-free environment, ephemeral loopback HTTP and a new
Browser context without Service Workers. Requests are fenced to the fixture
origin or inline data; Blob URLs must retain the same owned origin. Finite page
and owner deadlines remain active. Browser, server and fixture TEMP cleanup are
all attempted after body failure, the original failure is preserved, and cleanup
failure cannot emit PASS. The outer owner verifies child termination before
removing its own TEMP tree; an abort is never a successful behavioral result.
Process, filesystem and network cleanup require their actual scoped receipts,
not merely source reachability or an assumed signal-handler outcome.

The same existing receipt path records commit/source SHA, owners, capabilities,
contracts, affected-consumer reasons, exact leaf command, duration, exit/result,
log hashes/evidence reference and cleanup. Attempt and retry are explicit; this
mode runs once with no automatic retry. Unobserved network counts or Browser
completion remain unknown/null if the terminal fixture evidence is missing;
absence of evidence is never recorded as zero calls or successful cleanup.
A failed assertion or process is
initially `UNKNOWN`, with its technical failure kind and original evidence
retained. Reclassify Product/QA/Fixture/Environment only after supporting
evidence; a label or a later green attempt cannot replace the failed result.
The existing CI invocation stays read-only source selection and still executes
zero candidate commands. This explicit local execution mode does not alter,
prune or satisfy the existing eight CI jobs, complete `ci:check`, release risk
requirements or separate Owner approvals.

Changed semantic obligations require reviewed protection maintenance in this
same batch record: the changed file/contract, selected existing check, protection
source, exact before/current bytes and applicable assertion/vector binding.
Missing or stale maintenance fails with file, owner and contract diagnostics.
Existing dynamic capability-axis protection can be retained only when its actual
source proves that bounded expansion; a free-form claim or changed Product code
cannot update the expected contract. Contract types/signatures and explicit
contract declarations, plus the existing manifest obligations, remain the
authority. This bounded consistency check does not prove arbitrary behavioral
equivalence or replace the review and runtime tests.

Comments, formatting and reviewed narrative rationale are not presentation
requirements. Contract data and enforced adoption evidence remain obligations.
Ordinary CSS edits do not acquire historical numeric assertions merely by being
changed; approved geometry and presentation requirements remain protected by
their declared contracts and applicable behavioral/visual checks.

`planLocalVerification` also reports `fast` targeted development commands with
`releaseEvidence=false`; that report cannot authorize release execution. Its
cost depends on the reviewed existing command/mode and is not inferred from an
import edge. Release retains the current bounded A/B prefix and four Public
gates; Full retains the canonical package prefix and high-risk admission.
Full regression remains a separate release/high-risk obligation, not an
automatic rerun after each small development edit.

Positive command coverage may follow literal `npm run <registered-name>` chains
joined by `&&` in the bound `package.json`, retaining the selected parent check
as the execution boundary. Cycles, unknown names, dynamic commands and unsupported
shell syntax cannot establish coverage. Resolving a child entry must not append
another child execution to the canonical Full Local Gate. Likewise, a dynamic
cache query can preserve a proven fixed local module pathname; a dynamic pathname,
URL base or shadowed constructor cannot establish an executable graph edge.

An additional selected check can be omitted from the Full prefix only when the
same named check is already positively invoked through a canonical prefix's
literal npm chain, preserving its exact ordered commands, arguments and
multiplicity. Keep the canonical prefix itself unchanged. Distinct named aliases
remain distinct even with equal Node argv, since npm lifecycle context/hooks can
differ; unsupported command syntax cannot justify pruning.

The already-owned Admin adoption tail may supply positive coverage through the
same fixed gate descriptor used by execution, bound to the complete fresh,
unscoped `admin-adoption` Final Quality Gate request and source snapshot. Its
native gate name is not an npm prefix command and must not cause early or duplicate
execution. Scoped, retained, measurement or different selections cannot borrow
that coverage; cached coverage must retain the exact selected descriptor.

For the existing layout runner, a positively bound file-derived workspace root,
literal Webpack entry, canonical compiler binding and actual compiler execution
may establish execution of that entry file only. Replacement/resource hooks make
its downstream imports opaque: never credit those dependencies through this edge.
The registered opt-in `qa:admin-form-layout:taxonomy-current` selects the existing
portable taxonomy consistency-after branch with fresh workspace-local output.
It does not select legacy/default, Settings or Meta historical-comparison branches,
and does not imply their behavior or visual coverage. Existing evidence for those
branches retains its separate input and contract validity requirements.

Run every affected check in the same task and maintain proven stale expectations
under Section 3.2.2. A changed Test/Guard/Fixture invalidates its affected proof
and dependent coverage; do not leave it outside the selected set. Use current
supported command boundaries. If an aggregate cannot be safely scoped, run the
existing aggregate; do not manufacture narrower coverage or a parallel engine.
Conflicting or incomplete mappings expand verification safely, including Full
Local Gate when the impact cannot be bounded.

For A, retain affected targeted tests/guards, TypeScript, ESLint, affected
Desktop/Mobile/RTL, image/fallback and interaction proof, plus Final Build,
Product Surface, Platform Contracts, Public E2E, and cleanup. For B, add canonical
owner proof, direct/indirect consumer verification, applicable Adoption and
Source Proof, and affected contracts/failure paths. Shared UI visual proof still
follows Section 3.2.1; source guards do not substitute for it. C/D retain Full
Local Gate and affected domain/data/integration or positive/negative security
checks. Classification does not authorize Auth, permission, data, or migration
changes.

Preserve all assertions, positive/negative/boundary and security coverage,
failure propagation, process/fixture cleanup, and original resource integrity.
An affected mandatory failure, Skip, blocked/unverified check, missing proof, or
unproven cleanup blocks local completion of that boundary and release readiness.
Local selection never waives complete required Exact-HEAD CI or Post-Merge CI.

## 3.4 Evidence validity after a HEAD change

For each reuse decision, record the original tested SHA/tree, new Final HEAD,
changed files, affected owners/consumers, relevant test/build inputs and
environment, retained receipts, and the checks to rerun with a reason.

- A documentation-only change can retain runtime evidence when the relevant source, dependency/configuration, test, and environment inputs are unchanged; verify the documentation delta separately.
- Product, shared-owner, contract, dependency/configuration, or QA-script changes invalidate the corresponding proof and affected consumer coverage. Changes to a Test/Guard/Fixture also invalidate its affected proof and dependents. Maintain and rerun those checks in the same task, and rerun any affected build/E2E steps.
- Reclassify the combined scope under Section 3.3.1 after a material change; C/D and high-risk architecture/verification-execution changes require Full Local Gate. Rerun the full gate when a material impact or contract requirement cannot be bounded and covered by valid retained proof plus affected reruns. Do not repeat successful unaffected checks merely because a SHA changed.
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
- the risk-selected batch local release profile under Sections 3.3/3.3.1 is complete and valid for Final HEAD, with any retained evidence and affected reruns explicitly justified under Section 3.4;
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
