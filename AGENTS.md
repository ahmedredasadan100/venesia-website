<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Admin consumer capability adoption

The mandatory consumer workflow is:

`Discover -> Consumer Capability Adoption Audit -> Architecture -> Implementation -> Source Proof -> Verification -> CI -> Product Review`

Before implementing or materially extending an Admin consumer, register it in
the existing Collection or Form adoption manifest and run the applicability
preflight:

`npm run verify:consumer-capability-adoption -- --consumer <manifest-id> --boundary <collection|form> --phase applicability`

After implementation, run the same command with `--phase source_proof`. The
audit derives every axis from the Current Shared Capability Set in the existing
manifest; no copied key list or fixed capability count is allowed. The existing
Admin Runtime verification and CI must also pass; adopted capabilities must
resolve to their canonical owner, and local or parallel rendering fails the
guard. Product Review begins only after Source Proof, Verification, and CI pass.
