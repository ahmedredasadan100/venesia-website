<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Admin consumer capability adoption

The mandatory local consumer workflow is:

`Discover -> Consumer Capability Adoption Audit -> Architecture -> Implementation -> Source Proof -> Impact-Based Targeted QA -> Owner Visual Approval (Local Product Review) -> Local Commit`

Before implementing or materially extending an Admin consumer, register it in
the existing Collection or Form adoption manifest and run the applicability
preflight:

`npm run verify:consumer-capability-adoption -- --consumer <manifest-id> --boundary <collection|form> --phase applicability`

After implementation, run the same command with `--phase source_proof`. The
audit derives every axis from the Current Shared Capability Set in the existing
manifest; no copied key list or fixed capability count is allowed. Existing
Admin Runtime guards remain mandatory according to impact; adopted capabilities
must resolve to their canonical owner, and local or parallel rendering fails
the guard. Local Product Review follows Source Proof and targeted verification;
it does not wait for remote CI or require a Vercel Preview.

For every shared UI change, follow the mandatory visual regression protection in
`docs/QA_RELEASE_CLOSURE.md` Section 3.2.1: identify the existing owner and direct/
indirect consumers before editing, then provide targeted Desktop/Mobile/RTL
visual proof and exact live routes needing manual review. Code/source guards
alone are not visual proof. Preserve behavior and reuse valid unaffected evidence;
this requirement does not add a Full Quality Gate or expand the feature scope.

At batch completion: freeze Final HEAD and the combined scope, then select the
local release verification under Constitution Section 25.4 and
`docs/QA_RELEASE_CLOSURE.md` Section 3.3. Proven bounded A (UI/CSS/Presentation)
and B (Shared Presentation) changes use affected checks, TypeScript, ESLint,
required visual/behavior proof, Final Build, Product Surface, Platform Contracts,
Public E2E, and cleanup; B also requires owner, direct/indirect consumers,
Adoption/Source Proof, and affected contract/failure-path proof. C (Domain /
Contracts / Data) and D (Auth / RLS / Permissions / Migrations) require Full
Local Gate plus their affected specialized checks. E (Unknown / Mixed /
Architecture / Verification Infrastructure) follows the highest risk; unknown
or unbounded impact requires Full Local Gate, as do architecture or verification-
execution code changes. Documentation-only work retains QA Section 15. Do not
infer unaffected behavior from a missing import-graph edge. Record impact and
evidence validity in the existing QA evidence; affected Tests/Guards/Fixtures
must be maintained and run.
Then follow authorized Push/PR, full required GitHub CI on Exact HEAD,
separately authorized Ready and Standard Merge with Expected Head SHA, and
automatic Production deployment. Do not run a Full Quality Gate after each
small change. ADR-028, the dynamic adoption contract, release authorizations,
Branch Protection, Post-Merge CI, and deployment policy remain authoritative.

## Local development verification maintenance

Every local development task must discover, test, and maintain all affected
consumers, Product Tests, Guards, test scripts, Fixtures, and CI Workflows within
the same task. Follow `docs/AI_WORKING_RULES.md` Section 10.1.2 and the detailed
verification contract in `docs/QA_RELEASE_CLOSURE.md` Section 3.2.2 for failure
classification and correction of proven stale expectations. Do not weaken
assertions or defer affected maintenance to release. Existing ownership,
contracts, Stop Conditions, authorizations, and batch-gate timing remain intact.
