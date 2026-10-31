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

The existing local verification selection and execution owner must enforce
Syntax → ESLint → TypeScript → affected Governance/Contracts → targeted
behavioral QA → fresh Admission/Automatic Preflight → Full E only after
qualification. A failed early stage prevents dependent heavier work and retains
the original exit, stage and raw diagnostics. Independent safe checks may
finish without rerunning successful leaves. Exact leaf identity includes argv
and its execution/source context; a differently named npm lifecycle is not
automatically interchangeable. Existing canonical commands, their failure
conditions and Required Checks remain mandatory. Added source/targeted stages
must not execute the same qualified leaf twice, and unsupported or missing
positive qualification keeps the conservative fallback rather than granting
permission to execute. Controlled rejection must prove that TypeScript failure
starts no heavier dependent leaf and preserves cancellation/owned cleanup.
The targeted recovery after the retained TypeScript exit 2 and V8 exit 134
does not itself authorize Admission, long Build/Admin, or Full E.

The first ordered recovery invocation retained four Syntax passes and a strict
ESLint pass, then stopped at TypeScript exit 2: two newly added controlled
ProcessEnv fixtures lack required NODE_ENV. Its original nine diagnostics were
absent, but that does not make the project type check PASS. Governance,
Infrastructure, Fixture34, ordering and preparation behavior remained NOT RUN.
All six owned child Jobs queried zero. Preserve this new failure separately
from the earlier TypeScript nine-error receipt and V8 exit 134; no retry or
commit follows an incomplete required targeted verification.

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
values before Node starts and executes no selected Product candidate command,
Browser or database fixture lifecycle. When changed predicates or typed inputs
need execution correspondence, the existing admission owner first runs the
three registered affected-control profiles (Form, Page Block and isolated
verification controls) with one fresh invocation nonce. Their source, installed
dependency and runtime closure, original assertion/loader observations, raw
exits and owned-process cleanup must qualify before source consistency can
pass. A live invocation seal is required; saved JSON cannot grant admission.
Unknown projection, stale inputs, lost predicates and incomplete evidence block
the source step. The top-level report remains source consistency, not Product
Behavioral PASS or release evidence. Preserve its sanitized JSON together with
the referenced admission and affected-control artifacts after success or
failure; missing evidence fails. This does not change canonical commands or
authorize a parallel verification workflow.

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
literal command steps and the reviewed harness bytes qualify the existing Form leaf:
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
execution pilot supports `win32` and `linux` only after their source-bound
qualification receipts. Other platforms return `BLOCKED` before starting the
leaf. The qualified Windows path uses a private native Job Object through the
existing owned-child lifecycle. The root must be created suspended, assigned
before resume, and retain a held process identity; child/root exit alone cannot
prove cleanup. Native job membership must reach zero before PASS or evidence/TEMP
removal. Linux uses
an inherited, redacted ownership marker plus same-UID PID/starttime identities
to discover detached Chromium descendants and reparented children. It verifies
identity before signaling, bounds discovery, attempts TERM, freezes remaining
owned processes before KILL and proves no live owned processes before removing
the registration or TEMP. The reviewed fixture inherits the marker; unknown
environment-clearing detached descendants are outside qualification. Actual
timeout, cancellation, orphan, fast-exit and unrelated-process preservation
controls are required; source inspection alone cannot qualify a platform.
Linux source selection and ordinary mandatory CI commands retain their existing
behavior and obligations. The read-only CI source step is unchanged; this
explicit qualified path does not add a second execution of the same leaf to
the mandatory full CI chain.

Phase 06 additionally selects the two direct, registered source leaves of the
existing Executable Governance and Verification Infrastructure owners. Automatic
execution requires a reviewed fingerprint of the complete native eager import
closure, build/dependency inputs, installed lock and actual Node/runtime identity,
recomputed from immutable source bytes. The existing executable graph owns the
explicit eager-import option; its ordinary callers retain their default behavior.
Missing or unresolved generated/dynamic execution remains unqualified. The
existing Infrastructure owner may qualify only its reviewed finite producers:
actual selected guard/scheduler/fixture statements, literal and recipe-derived
Jiti imports, read-input membership and the complete eager source closure.
Producer bytes, installed native-resolved package distributions, dependency
locks and actual runtime identity bind that footprint. Unknown paths, loaders,
fragments, packages or runtime changes reject qualification; a success marker or
caller-supplied hash cannot replace it. This is a bounded current-owner effect
contract, not a resolver for arbitrary generated code. Executable Governance
retains its separately reviewed closure.
This does not qualify their named composite commands, Database effects or
Browser behavior. QA/fixture changes automatically nominate these
existing quality owners even without an import-graph edge; unresolved fixture
coverage remains explicit and retains the conservative Full obligation.
The existing impact report emits selected/not-selected reasons, owners,
contracts, current commands, duration, result, evidence and source bindings.
Before execution its rows remain NOT RUN. Overlapping selections execute each
qualified literal step once, write distinct retained leaf receipts and stop at
the first executed failure. Independently qualified leaves may execute while an
unqualified required selection stays NOT RUN and the aggregate stays BLOCKED;
failed global source coherence still prevents all execution. Source-guard PASS
remains `qualifiedBehavioralPass=false`.
Loss of AST-observed assertion count blocks source coherence; this bounded
protection does not claim to detect every semantic assertion weakening or prove
equivalent protection. Contract-specific relevance and Owner review remain
required. No mandatory machine hook, new workflow or parallel registry is added.

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

Within one selection, overlapping registered wrappers resolve the qualified leaf
once. Existing exclusive receipt and child-log writes refuse evidence-name reuse
before another command starts. Each targeted receipt carries commit/source SHA,
Run ID, owners/capabilities/contracts/consumers, test and canonical command,
status/duration, attempt/retry, first failure, evidence hashes and cleanup.
There is no automatic retry; a single attempt has
`flakyStatus=NOT_ASSESSED_SINGLE_ATTEMPT`. An evidence failure cannot erase the
original attempt. Categories are Product, QA / Test, Fixture, Harness, Environment
and UNKNOWN. A directly observed OS error code can establish Environment; a
zero-exit process with an invalid required terminal receipt establishes a
Fixture protocol failure. Assertion labels, nonzero exit, timeout and cancellation
alone remain UNKNOWN and cannot establish a Product diagnosis.

The existing classifier additionally separates observed failure disposition
from initiating cause: retained native V8 CHECK plus abort exit/signal and log
hash may establish Runtime Crash; the owned pg control-client error code may
establish Database Transport failure. Timeout and Cancellation retain UNKNOWN
causal category while naming their observed termination reason. None proves a
Sleep, memory, Docker, Codex transport or Product cause. Primary child evidence
and cleanup classification remain separate.

The same bounded Form fixture retains at most 128 passive events per scenario.
Its exact ordinary command keeps light event order/elapsed history and defers
snapshot collection until failure. The explicit bounded
`--save-cache-only --save-cache-diagnostics=deep` arm adds the existing permitted
length/boolean/enum facts and successful scenario summaries. Diagnostic argument
typos reject before resource creation; they cannot activate another family.
Neither mode reconstructs facts that were not observed. Input/DOM, controlled
state-update/render/action/source/cache/API/readback and assertion boundaries
retain their proof levels. The collector cost is measured separately from
Browser preparation/execution and snapshot RPC; constant-clock collector-only
benchmarks exclude callsite allocations and DOM reads. It records no field values, arbitrary
objects, URLs or credentials; no diagnostic timer, microtask or React setter is
added. Render observations are not React commit proof. Failure collection must
rethrow the original error even if collection fails; unavailable evidence stays
unavailable and causal divergence stays UNKNOWN. The parent receipt's existing
hashes/source binding cover this evidence. Broader consumers and native
persistence are not qualified by the thirteen controlled scenarios.

When that existing fixture observes a failed second-save dirty DOM contract
before a later aggregate assertion, it retains the first safe scenario and
expected/observed enum while the page still exists. Failure-only collection
uses the same bounded ring; a later assertion or a failed snapshot cannot
overwrite that boundary or the original error. The terminal fixture receipt
declares its consumer/contract, observed runtime, missing React commit/native
persistence/causal-owner evidence and the parent's ownership of actual exit
status. A light-mode event history is never relabeled as deep metadata, and a
controlled DOM counterexample is not a Product root-cause claim.

Before Docker allocation, the existing isolated lifecycle invokes the existing
owned-child process owner to qualify creation and cancellation in the actual
caller context. The approved Windows creation/handle capability is implemented
by `windows-owned-process.mts` and its tracked C# source; policy, selection,
deadlines, logs and admission remain in the existing public verification owner.
The native helper owns the private job, receives the owner's control pipe and
passes the root's stdout/stderr through; the root receives NUL stdin. Owner-pipe
EOF and the independent native deadline require cleanup, including after root
exit. The job handle is verified noninheritable. A bounded helper watchdog may
end a stalled helper. Two evidence kinds remain distinct:

- Ordinary native cleanup retains accounting/member-list zero evidence while
  the valid Job handle is held. A missing or corrupt normal execution receipt
  remains FAIL; a separate containment certificate cannot turn that run PASS.
  Accounting zero does not replace termination of a known retained member:
  every acquired exact-Job process handle must also signal within the original
  shared cleanup deadline and close before acceptance. Receipts bind its PID,
  birth time and native membership; the adapter rejects omitted, duplicate,
  foreign, unsignaled or unclosed retained-member evidence. The initial
  `activeProcessesBeforeCleanup` snapshot and the strict natural-exit zero
  assertion remain separate from final cleanup zero.
- Kernel last-close containment cannot query zero membership after the final
  Job handle closes. Its safety certificate instead requires native pre-close
  complete actual Job membership with process birth times, verified limit
  `0x2000`, noninheritability and helper-only Job-handle ownership. An independent
  observer retains only target process query/synchronization handles with rights
  `0x101000`; it holds no Job handle and performs no termination, discovery or
  daemon work. Every helper/member handle must be live/nonsignaled before READY,
  then every retained handle must become signaled within one shared bound of at
  most six seconds measured with both Stopwatch and UTC, never reset per handle.
  All target process handles must close on success or failure. Missing ownership,
  complete membership/birth-time binding, READY, bounded exit or handle-close
  evidence rejects the certificate; self-expiry or PID/helper polling is not proof.

The fixed bounded `--observe-close` entry in the same C# source/executable is a
read-only native wait primitive within the approved capability. Its explicit
`IndependentObservation` evidence introduces no other module, executable, runner,
runtime or registry. Receipt availability remains separate; root exit stays
UNKNOWN unless independently observed. Expected-fault safety acceptance never
fabricates a native queried-zero receipt or successful Product execution.
Required negatives cover live/unsignaled targets, stale or mismatched identities,
incomplete member evidence, invalid rights/ownership, malformed inputs, deadline
failure and handle cleanup; original errors and prior failures remain preserved.
For nested-job breakaway probes, creation denial5 is one valid result, not a
universal invariant. A created suspended candidate instead needs the native
exact private-ancestor checkpoint bound to its PID and birth time; membership in
any Job or a probe-only guard is insufficient. The probe's own creation-time
Job guards its unexecuted candidate against escape/probe crash, without proving
private-ancestor membership. Unknown ancestry remains unqualified.
Native waits on Windows8+ exclude low-power time, so native and UTC bounds and
the scoped awake-window evidence must remain explicit; no future Sleep or
long-run transport guarantee follows ([Microsoft wait semantics](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject)).
The original root exit is distinct from the helper/capability outcome. Normal
and abnormal root exit, cancellation, timeout, detached descendants, owner loss
and unrelated-process preservation need actual scoped controls.

The ordinary noninteractive Windows root uses `DETACHED_PROCESS` with its
existing suspended creation, explicit Job/handle attribute lists, NUL stdin
and output pipes. Engineering03 identified an actual exact-Job `conhost.exe`
member with its held process identity during the previous `CREATE_NO_WINDOW`
launch. A flags-only counterfactual removed that additional allocation in the
actual Success/Nonzero controls without forced cleanup; it did not relax the
pre-cleanup zero assertion. Existing failure-only diagnostic enrichment retains
at most64 initially reported members within at most1000ms of the original
cleanup budget. Query/synchronization handles establish identity and exact Job
membership; a filtered `PROCESSENTRY32W` snapshot supplies PPID as context only.
Unavailable or raced metadata remains PARTIAL. No normal-path polling,
historical PID ownership, external-process termination, new runtime or global
console setting is introduced. The scoped evidence and original failures live
in the [Engineering03 report](../.tmp-qa/qa-engineering-final-closure-03-20261031/final-engineering-closure-report.json);
this correction alone does not qualify PostgreSQL, Full E, CI or human review.

The same native capability also owns the long-lived Windows `next start` child
inside `runOwnedPublicVerification`, for Public E2E, Admin interactions/adoption,
media upload and Hero compatibility. Its existing decorated child goes directly
to `stopChild`; no plain Windows spawn fallback or historical PID claim is
allowed. Server root/helper results and native cleanup evidence remain separate
from the test driver's result. Unexpected completion fails the active gate;
intentional cleanup awaits the server close/log lifecycle and preserves an
earlier failure when cleanup also fails. The native lifetime includes the
existing120-second readiness window, unchanged driver limit and existing
20-second cleanup allowance. Linux retains its direct process branch. Actual
adoption controls and Full E results must qualify this consumer separately from
native capability tests. An interrupted attempt without an owner terminal
receipt remains incomplete even after separately verified owned-resource
recovery; neither recovery nor preserved partial gates converts it to PASS.
The second Engineering03 attempt reached a genuine diagnostic assertion failure:
the existing client-config expectation omitted the approved `query_timeout`
of30000ms while the actual owner already supplied it. Maintenance adds that
required field to the exact comparison and retains every previous field and
assertion. It changes no connection policy. Original gate exit1 and its raw
failure remain preserved; native zero-process cleanup and owned-resource
cleanup succeeded independently. A new source still requires fresh live
Admission and the complete canonical gate sequence; partial attempts cannot
be combined into a passing Full E.

The third attempt on`a574bffc` passed42 prefix gates, including the complete
content-editor Browser aggregate, then failed the platform-performance
command's existing Admin control-lease verifier. Direct execution of its
unchanged guard bodies reproduced two adoption-maintenance gaps: the restart
guard expected an immediate bare awaited driver and the former plain shutdown,
and a controlled execution projection omitted the new native lifecycle locals.
Maintenance belongs to those existing verifier helpers. It must bind the exact
first-failure-preserving catch, native and Linux shutdown branches, original
launch count/arguments, failed-measurement rejection and successful Hero typegen
ordering. Controlled cleanup must receive the actual lifecycle ports and retain
its original failure and cleanup assertions. No runtime policy, canonical
command, Product contract or timeout changes to satisfy these checks. Original
gate43 exit1, native queried-zero and complete owned-resource cleanup remain
independent evidence; later targeted or Full E results belong to their own
source and execution.

The affected default Source/Offline verifier must also pass before another
Full E. Its historical retained-lifecycle fixture derives a finite predecessor
from current declarations; a later Native cleanup envelope is not the earlier
nineteen-transform Async correction. The retained-source guard correctly rejects
that mismatched seed. Fixture maintenance may reconstruct the exact historical
cleanup shape for this controlled test only, preserving the original guard,
production baseline, authority and every existing rejection. A Native cleanup
substitution must remain rejected under that historical contract. This fixture
cannot authorize retained evidence for the current Native adoption; current
execution still requires fresh Admission and the complete canonical sequence.

The complete Quality prefix also runs the default verifier from the owned
Windows source copy. Its installed dependency distributions must resolve physically
inside that copy, with the same project/installed locks and executable bytes;
a junction to the original project does not satisfy that boundary. The fourth
Engineering03 run on `a292b3d2` passed56 gates, then exited1 at gate57 in the
unchanged Infrastructure footprint control. A bounded unchanged-control
reproduction reached its first assertion and retained
`unresolved_executable_import_closure`; native package resolution crossed the
copied project's strict installed-root boundary. Original inner CLI error
details remain unavailable; this is a proved staging-context conflict, not a
Product regression or evidence that the footprint assertion is stale.
Provisioning belongs to `runOwnedPublicVerification`: its Windows private dependency
copy must yield for the existing control pulse, honor cancellation and a bounded
setup deadline, retain source/lock/file-byte identity, reject unqualified links
or escapes, and settle filesystem work before owned cleanup. Do not relax the
physical package boundary or the controlled installed-package byte mutation.
The original56-pass/one-fail/eighteen-not-run result and complete10-resource,
zero-process cleanup remain separate from any corrected source or later run.
The exact helper copied24,929 files/652,881,707 bytes in369624.4508ms and
the unchanged named footprint control passed its positive and mutation cases.
Original dependency bytes, source and Git were preserved; owned-copy removal
and zero-process cleanup passed. The616,011 awaited callbacks/max996.9541ms
gap are copy observations, not actual PostgreSQL continuity or a hard I/O
interrupt guarantee. The source-stat512MiB ceiling is not an adversarial
concurrent-growth memory guarantee. Existing Linux dependency linking remains
unchanged; the earlier Linux transport/process receipt does not qualify Linux
Full E staging. Final affected checks and renewed whole-run evidence belong in
the existing Engineering03 report; no fifth Full E is inferred here.

The existing `verifyPublicSourceHeartbeatBoundary` must distinguish the three
unchanged source-verification pulse sites from the additional awaited pulse
inside private Windows dependency staging. Its old lexical total of three
rejects that fourth call. A bounded default-tail execution reproduced4-versus-3;
the original default09 CLI still lacks its inner error and remains a separate
failure. Preserve all three source-site adjacency checks, require the private
step's ordered checkpoints/awaited pulse and operation, and reject unclassified
or shadowed pulses. Lease policy and runtime scheduling stay unchanged. Actual
negative-control timing is scoped to this guard, never overall QA speed.

The combined-source recovery after `c80fd87f` retains Full05's74 passes and
Admin Adoption failure as one failed run. Its caller saved the prepared fixture
only under `execution`, while the existing public owner supplies the Driver
`QA_ADMIN_FIXTURES` from the owned runtime directory. The temporary caller fix
proved that delivery boundary; it did not durably repair the tracked producer.
`prepareAdminInteractions` now owns publication of its returned `result.fixtures`
to the constant runtime `admin-adoption-fixtures.json` before reporting readiness.
The returned credential envelope is never serialized. Sanitization must leave
the exact JSON bytes unchanged; receipts expose only basename, size and SHA256.
The account-only Media study still returns before fixture publication.

Publication creates the first file exclusively with private requested mode,
rejects links, multiple links, reparse paths and foreign preexisting files, and
retains only the run-local accepted file identity and content hash.
File identity uses exact BigInt device/inode and nanosecond birth time from the
held descriptor and pathname; it never rounds Windows identifiers through a
JavaScript Number. Requested private file mode does not establish Windows ACLs.
Later preparation preserves the existing API's legitimate fixture/study changes:
identical bytes do not rewrite the file; changed returned fixtures update only
the verified owned descriptor after its previous hash matches. Identity is
checked before and after the operation, bytes are read back, and every opened
descriptor closes. The Media CLI consumes this producer file instead of
overwriting it. Repeated Heavy Editor preparation, Hero/Public fixture consumers,
Admin Browser and native readback consumers retain their existing contracts.
Descriptor closure errors surface; if publication and closure both fail, an
aggregate retains the publication failure first and as its cause. Path checks
qualify the private owned task boundary, not immunity to hostile concurrent
filesystem changes.
The existing verifier owns the producer/path/rejection controls; there is no new
command, runner, registry, runtime, Product behavior or credential transport.

The first bounded source verification of this correction is BLOCKED. Syntax,
strict ESLint, Executable Governance and Verification Infrastructure passed;
TypeScript exited 2 with nine errors introduced by the correction. The existing
current-infrastructure selector exited 134 with an explicit V8 semi-space commit
allocation failure, before a completed control receipt. The 34 new controls
remain unqualified. Native cleanup queried zero processes without forced
termination. A cyclic-AST identity assertion was separately identified in source;
its error-formatting hazard does not establish the actual crash location.
Preserve these original failures; no second correction/retry, fresh Admission,
Build/Admin selection or Full E is authorized by this incomplete result.
Raw evidence is retained under
`.tmp-qa/combined-source-recovery-20261031/targeted-source-verification-01/`.

Current targeted verification, fresh Admission/Automatic Preflight, Environment
qualification and the single newly authorized Full E remain separate evidence
requirements. The later targeted Build's`0xC000013A` is preserved with unknown
termination actor; neither the fixture repair nor Windows Job cleanup explains
that exit or establishes a V8 defect. Owner reviews remain independently pending
until actually completed. Earlier failed runs and preservation gaps are retained;
they cannot be merged into a passing run or erased by this correction.

Distribution is source-only: the installed Windows10+ x64 .NET Framework compiler
builds a fresh executable in an ignored `.tmp-qa/windows-native-build-*` directory
from an exclusive captured C# snapshot. Source/compiler/explicit Framework input
hashes are pinned before compilation and checked afterward; flags and binary
identity are retained in provenance. Only successful byte-verified provenance
publication permits reuse within that Node invocation. Before another launch,
the tracked source, captured source, compiler, Framework inputs, executable and
provenance must still match their retained hashes. Failed build/provenance writes
cannot publish a reusable build.
No committed executable, cross-invocation binary cache, downloaded dependency,
global setting, new pipeline or alternate canonical command is introduced.
Unavailable native build/launch capability or a denied actual-context probe stays
BLOCKED. Known Full Quality intent rejects before CLI resource allocation when
that prerequisite is unqualified; a direct public handoff rejects before gates,
without claiming to know its future request before initial allocation. Native
capability availability alone is not actual process/environment qualification.
Preparation has a 600-second phase
budget and 1800-second cumulative budget, excluding gate execution, with age
observation and rejection before the pinned 600-second control-connection
lifetime. Verified-idle renewal reuses the existing port; it does not replace a
failed connection or renew an active transaction. Timeout/cancellation revokes
the handle, aborts owned work and retains phase/duration/control age plus safe
pg failure metadata. Cleanup closes owned transport and drains pending work
before resource removal; a failed drain is retained, never recorded PASS.
These controls and their targeted receipts do not alone prove long-running
Environment Readiness, repair the historical V8 abort or satisfy Full Local E.

Host bridge setup retains the first failed listener's ordered service/index,
numeric loopback address/port, setup phase and sanitized native code/syscall in
the existing transport diagnostic. The original Error is private; the public
cause omits arbitrary messages, stacks, credentials and endpoints. Missing native
fields remain unknown. One setup budget is bounded by the existing15-second
connect limit, and cancellation uses the existing preparation/lifetime signal.
Partial setup closes earlier listeners, pending sockets/processes and its setup
timer before rejection; repeated close calls await the same cleanup result.
The existing environment receipt retains this diagnostic and its safe cause;
secondary evidence I/O must not replace the original setup failure. Expanded
transport cases remain bound to the actual current registered leaf, original
stdout/exit/native cleanup and complete source-derived case obligations, rather
than changing a count-only admission threshold. A successful short bind test or
cleaned Job does not prove continuous Application Client/PostgreSQL readiness.

Cold source discovery must precede allocation for a Final Quality request with
reviewed local impact. The existing live Admission invocation privately retains
only its cloned, digest-bound raw discovery, exact Git delta and explicit files.
The reader may reuse those facts only after validating the live invocation,
receipt seal, current baseline/HEAD/source/runtime and physical artifacts; every
returned discovery is cloned and current request coverage/native selection is
derived again. Missing, corrupt or incompatible private facts reject without a
cold-analysis fallback on the live control connection. Serialized receipts and
caller-owned facts grant no authority. This is bounded reuse in the current
owner, not a cache of gate success or a new registry. Bounded/default requests
retain their existing prerequisites. No idle/lifetime or preparation timeout is
raised and no worker, heartbeat timer or suspended PostgreSQL state is added.

Contract correspondence is per exported contract/symbol and its actual
assertion dependency, including lexically bound runtime aliases. An unrelated
export, message-only change, file length/hash check or unrelated vector cannot
maintain another changed contract. AST declaration kinds keep callback-bearing
interfaces/types distinct from executable exports. An assertion reading an
actually changed top-level member can bind its exact imported type through a
direct receiver type or unshadowed built-in Pick; nested/foreign types,
shadowed bindings, unchanged members and bare export names grant no credit.
Applicable compile-time negative cases still require the actual TypeScript
check; source correspondence alone does not execute the compiler.
Explicit changed expectations remain human
reviewed; source correspondence never proves arbitrary assertion semantics,
behavioral equivalence or Owner approval. Existing dynamic capability-axis
coverage and approved geometry/presentation requirements remain protected.

Performance memos live only within one source-read invocation: exact file/source
semantic projection, immutable AST paths with fresh Set results, and immutable
baseline Git blobs. There is no cross-SHA behavioral evidence cache. Inspector
and targeted receipts measure source snapshot/hash, discovery, coherence,
execution and evidence/cleanup; the existing fixture reports preparation,
scenario execution and cleanup. Inclusive timings are not summed as disjoint
costs. Comparable frozen-input measurements and source-bound runtime outcomes
are retained in the existing Phase 05 evidence receipt; historical timings from
different cache/load conditions cannot establish a speed improvement.

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

### 5.1 Bounded six-type content behavioral coverage — One-Shot 02

This classification covers the six current `content-types` adapters only:
Article uses `ArticleCreateEditor`/`ArticleEditor`; News, Press, Site Updates,
Video and Gallery use `MediaContentForm`. Their shared lifecycle remains
`ContentEditorShell`/`AdminFormRuntime`; primary images use
`ContentBasicDataPanel -> TopicImageField -> AdminMediaImageField`, and Gallery
retains `AdminMediaGalleryField` for ordered item state. The existing Form
manifest entries are `topic-article-create-edit` and `topic-media-create-edit`.
This is not a new consumer registry or an inventory of the entire Admin system.

The current local checkpoint for this audit is `ff1640d6857b865ce5b1e07643a94f3fb67f8e6b`.
The old published `b771` CI/Preview checkpoint remains historical and does not
qualify this local source. No new Product, Browser, database or Alt investigation
was executed for this read-only audit.

Legend: **P** = Partially Covered: actual historical behavior exists within the
stated fixture scope, but its current consumed source/runtime closure has not
been fully requalified. **S** = Source-Only: owner/test/adoption linkage is
present, without current behavioral proof. **N** = Not Covered in the bounded
audited execution receipts; this does not assert that no repository test exists.
**NA** = Not Applicable to this consumer contract. **Covered** requires actual
behavior within a fully matched or explicitly qualified input/runtime scope;
none of the combined current six-type rows below receives that label merely
from a source guard, one consumer fixture, or an old CI result.

| Behavior | Article | News | Press | Site Updates | Video | Gallery |
| --- | --- | --- | --- | --- | --- | --- |
| Create / Edit | P | P | P | P | P | P |
| Save / Failed Save | P | P | P | P | P | P |
| Readback / Persistence | P | P | P | P | P | P |
| Delete | N | N | N | N | N | N |
| Duplicate Prevention | P | P | P | P | P | P |
| Permissions / Authorization | S | S | S | S | S | S |
| Form State / Draft Recovery | P | P | P | P | P | P |
| Alt / Caption | P | P | P | P | P | P |
| Gallery Ordering | NA | NA | NA | NA | NA | P |
| Shared Component Adoption | S | S | S | S | S | S |

The existing test owners and actual assertion boundaries are:

| Behavior | Existing owner → test / assertion | Raw scoped evidence and current limit |
| --- | --- | --- |
| Create / Edit | Article/Media save owners → `qa-home-story-presentation.mjs --full-form-draft-only`; actual action result and PGlite row rehydrate the Edit consumer, then native tuples are compared. | [Full Form raw Browser proof](../.tmp-qa/admin-development-batch-01/full-form-draft-recovery-20261024/full-form-draft-browser.json): 24 six-type Create/Edit RTL cases. It is historical fixture proof, not every current field/status or Production. |
| Save / Failed Save | `ContentEditorShell`/`AdminFormRuntime` and canonical save owners → failed result, unchanged native tuples, Dirty state and retained draft; successful retry is explicit. | The same [Full Form report](../.tmp-qa/admin-development-batch-01/full-form-draft-recovery-20261024/final-report.json) records 49 isolated save-adapter calls. The generic `qa-admin-form-guarded-navigation.mts --save-cache-only` family has its own controlled shared-owner scope; one such fixture cannot prove all six content consumers. |
| Readback / Persistence | `createTopicSlugSaveHarness` plus actual save owners → saved slug/canonical values and explicit Edit remount from the read row. | [Domain raw proof](../.tmp-qa/admin-development-batch-01/full-form-draft-recovery-20261024/domain-slug-save-proof.json): actual owner execution against disposable PGlite/finite infrastructure ports. Authenticated hosted/Production DB persistence and public HTTP publication remain unproved by these fixtures. |
| Delete | `actions.ts#softDeleteUnifiedContentImpl`/`runAtomicTopicsBatch` → existing adoption journey source checks acknowledged delete, row absence after reload and stale-reference rejection. | No current per-six-type executed delete/readback receipt was established in this bounded audit. A selected Topic fixture does not establish every content-type lifecycle. |
| Duplicate Prevention | Canonical save owners/`topics_slug_key` → actual PGlite `23505` maps only the slug constraint to field/focus; non-slug uniqueness remains general. Shared Runtime pending controls have separate single-action assertions. | The domain raw proof contains 13 vectors per type, including Create/Edit conflict and occupied/trashed preflight. These are not a current all-consumer double-submit/concurrency claim. Logical draft-candidate deduplication and the explicit Duplicate command are distinct contracts. |
| Permissions / Authorization | `requireAdminSession`, mutation owner and existing domain-permission journeys → canonical session/permission boundary. | The finite save harness replaces `requireAdminSession` with a synthetic actor. Draft actor/session isolation is not server Auth/RLS; no authenticated policy PASS is inferred from an injected database-error response. |
| Form State / Draft Recovery | `TopicFormDraftRecovery`/`topic-revision`/`AdminFormRuntime` → explicit Restore, native parity, Dirty/Close/Navigation, failure retention and exact accepted-draft cleanup after success. | Full Form raw proof includes four historical cases per type and separate identity/version/opaque/CAS boundaries. Restore does not save to the DB; remote revocation and closed-browser physical deletion are outside that proof. |
| Alt / Caption | `TopicImageField`/`AdminMediaImageField`; Gallery item metadata stays with `AdminMediaGalleryField` → applicable native tuple parity and item metadata persistence. | [Unified Image raw proof](../.tmp-qa/admin-development-batch-01/unified-image-system-20261024/unified-image-browser-combined.json): Article/Gallery only, eight Create/Edit RTL cases and 16 isolated attempts. Other adapters are not inferred from those eight cases. Primary-image Caption is NA for the five non-Gallery payloads; Gallery item Caption applies. This audit does not reopen Alt RCA. |
| Gallery Ordering | `AdminMediaGalleryField`/existing reorder handle → trusted desktop drag, arrows/keyboard, URL/Alt/Caption moved together, persisted image tuple equality and Edit readback. | Unified Image and [Content Panel/Gallery raw report](../.tmp-qa/admin-development-batch-01/content-panel-gallery-final-20261024/final-report.json) prove their bounded historical Gallery scope. They do not claim Touch Drag, hosted publication or current all-owner equivalence. |
| Shared Component Adoption | Current Form manifest and canonical owners → `verify-admin-row-actions-capability.mts --consumer-capability-audit`/existing Form source guards. | [Scoped actual Adoption reuse](../.tmp-qa/qa-foundation-closure-01-20261030/adoption-private-discovery-scope-actor-addendum.json) retains source-proof scope only. Component linkage, applicable capability adoption, observed behavior, visual presentation and Owner approval remain separate. |

The current-vs-recorded raw input comparison finds 16/34 differences in Full
Form, 20/55 in Unified Image and 13/16 in Content Panel/Gallery. This preserves
the old executions and their exact scopes; it prevents treating them as one
whole-current-source PASS. No semantic equivalence is invented merely from a
hash mismatch or a shared component name. The detailed per-type source/evidence
bindings and legitimate exceptions are retained in the phase
[coverage proposal](../.tmp-qa/qa-engineering-completion-02-20261030/behavioral-coverage-matrix-proposal.json);
that JSON is evidence for this existing QA classification, not a new registry
or live Admission authority.

The first proven evidence gaps are current input-closure renewal, authenticated
permissions/DB proof, and current per-type delete execution. These are evidence
gaps, not newly established Product defects. Reuse valid unaffected proof under
Section 3.4; execute existing affected modes only when authorized and necessary.
Owner Functional/Visual approval, release approval and global closure remain
pending independently.


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
