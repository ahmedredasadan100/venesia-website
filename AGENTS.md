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

At batch completion: freeze Final HEAD, run one Full Quality Gate including the
required Final Build/Public E2E and cleanup, then authorized Push/PR, required
GitHub CI, separately authorized Ready and Standard Merge, and automatic
Production deployment. Do not run a Full Quality Gate after each small change.
Evidence validity and affected reruns follow `docs/QA_RELEASE_CLOSURE.md`.
This timing follows Constitution Section 25.4 and ADR-028; the dynamic adoption
contract remains unchanged.
