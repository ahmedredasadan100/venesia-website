# Entity SEO persisted-score cutover

This runbook operates the existing Entity SEO tooling for the Topic and Project adopters in PR #162. It is an execution procedure, not evidence that a migration, backfill, deployment, or smoke check has already succeeded. Pages remain excluded. Original entity inputs remain authoritative; the existing TypeScript SEO owner calculates the derived score/version/hash. SQL validates or invalidates provenance and does not calculate SEO scores.

## Migration identity and application order

| Portion | Repository artifact | Purpose |
|---|---|---|
| EXPAND 1 | [20260914004050_entity_seo_persisted_score.sql](../../sql/migrations/20260914004050_entity_seo_persisted_score.sql) | Nullable tuple, canonical hash projection, transitional invalidation triggers, list view/index and nullable SEO average |
| EXPAND 2 | [20260914004118_project_seo_persisted_score.sql](../../sql/migrations/20260914004118_project_seo_persisted_score.sql) | Existing Project save/duplicate RPCs support both legacy calls and adopted proofs during transition |
| ENFORCE | [20260914151556_entity_seo_score_enforcement.sql](../../sql/migrations/20260914151556_entity_seo_score_enforcement.sql) | Locked completeness check followed by the strict deferred trigger installation |

The two original PR migrations were corrected before their first Production application. Their previous applications were confined to disposable isolated fixtures. Rewriting these unapplied versions avoids applying a known incompatible strict state and immediately undoing it. ENFORCE has a separate CLI-generated migration version so activation remains a distinct, reviewable operation.

Before using that decision, prove that neither original version is present in the Production registry and that their schema effects are absent. If registry or schema shows an earlier application, **stop**: do not rewrite migration history, replay an edited version, or claim that a function's presence proves registry provenance. Reconcile the actual state and obtain the appropriate correction strategy first.

Stage the complete reviewed corpus under a private CLI work directory's `supabase/migrations`: **105 files for EXPAND** (the existing 103 plus the first two files above, excluding ENFORCE), then **106 files for ENFORCE**. Normalize only line endings to LF; preserve all SQL content and record the normalized source hashes. Never stage just the pending files or include ENFORCE in the early directory.

Use the receipt-identified official Supabase CLI binary with `db push --db-url <privately supplied verified-TLS URL> --skip-vault --workdir <phase directory> --dry-run`. Require exactly the two EXPAND versions initially, or only ENFORCE at its later gate; then use the same arguments with `--yes` instead of `--dry-run`. Do not include roles or seeds (`--include-roles` / `--include-seed`), replay historical migrations, or apply unexpected pending versions. CLI TLS uses `sslmode=verify-full` and the independently verified official CA; do not print the URL.

The isolated actual-CLI application proof is retained in `.tmp-qa/entity-seo-cutover/cli-migration-rehearsal.json` and `cli-registry-receipt.json`. The separate `production-cli-readonly.json` proves a verified-TLS dry-run selected exactly the two EXPAND versions; it does **not** prove Production application.

After each successful CLI phase, normalize **only that phase's selected registry entries** through the existing [registry owner](../../scripts/reconcile-migration-registry.mts), using the actual-CLI receipt:

```text
node --experimental-strip-types scripts/reconcile-migration-registry.mts
  --selected-cli --confirm selected-cli-migration-registry
  --versions <comma-separated phase versions> --receipt <actual-cli-receipt.json>
  --cli-binary <receipt-identified binary> --database postgres
  --production-confirm production-selected-cli-migration-registry
  --project-ref <approved reference> --expected-host <approved host>
  --ssl-ca-file <verified official CA>
```

The displayed command is one invocation, wrapped for readability. Inject `SUPABASE_DB_URL` privately. Start without `--apply`: exit 2 means verified selected entries need canonicalization; inspect that bounded diff, then add `--apply` and require the next dry-run to exit 0. EXPAND selects `20260914004050,20260914004118`; ENFORCE selects only `20260914151556`. The owner validates the exact 103-entry baseline, CLI binary, source hashes and raw CLI statements against the receipt before changing selected metadata. Missing selected entries, mismatched provenance or unexpected history must stop the operation. **Do not use the broad `reconcile:migration-registry` package command or historical reconciliation as a shortcut.** Schema application and registry-format proof remain separate.

## Prerequisites and evidence record

Before the first Production mutation, record:

- The exact reviewed PR head and hashes of the three migration files, backfill tooling, existing SEO owner and persistence adapters. Any code change invalidates evidence for the affected boundary and the prior backfill receipt.
- Terminal GitHub checks and Vercel Preview status for that same head, with migration provenance and the isolated cutover rehearsal passing. An earlier head's successful checks are insufficient.
- The explicitly selected Supabase project reference, approved direct/session endpoint, database `postgres`, verified TLS trust root, population counts and an authorized numeric upper bound. Keep credentials in the approved secret source; do not include connection strings in logs or reports.
- A recovery decision that preserves source fields and derived-data consistency. A partial backfill is resumed through the same tool; it is not repaired by ad-hoc SQL scoring or restoring an incompatible old writer after enforcement.

The rehearsal must start from the pre-#162 schema and source baseline, then prove EXPAND, legacy writes, explicit invalidation, adopted writes, backfill, independent verification, idempotency, a late legacy write and catch-up, ENFORCE, adopted writes after enforcement, legacy-write rejection and persisted list/metrics/sort reads. Use the maintained [rollout proof](../../scripts/verify-entity-seo-rollout.mjs), [native cutover proof](../../scripts/verify-entity-seo-cutover-postgres.mts), [backfill proof](../../scripts/verify-entity-seo-backfill.mts) and [Topics read proof](../../scripts/verify-topics-seo-read.mjs). Native Projects coverage invokes the real save/duplicate RPCs and shared proof builder; it does not execute the full Project form actions or Browser flow. Article import coverage proves its shared persistence boundary, not the import workflow. Source reachability or a final-state-only test does not replace the staged proof.

Keep operation artifacts outside tracked source: exact-head/provenance records; dry-run receipts; counts-only dry-run/apply/verify/rerun reports; migration results; deployment identity; and safe smoke results. Retain failures and partial progress. Do not copy row contents, free-form database errors, credentials, cookies or tokens into that evidence.

## 1. EXPAND and old-application compatibility

1. Apply EXPAND 1, then EXPAND 2. Verify each file's schema behavior and registry identity independently.
2. Confirm the current Production application still serves its declared routes. Use safe reads; the isolated rehearsal proves legacy mutation behavior without requiring Production writes merely to test compatibility.
3. Confirm the transitional triggers are installed and enabled, and strict deferred triggers are not yet installed.

During EXPAND, legacy inserts without proof remain explicitly unresolved. A well-shaped carried tuple whose fingerprint no longer matches the final inputs is invalidated to an all-null tuple. Partial or malformed tuples fail. Matching adopted proofs remain intact. Legacy writes must never leave a stale numeric score looking current.

The adopted Topics reader keeps unresolved entities visible through the existing shared unavailable-score presentation. Null scores sort last in either direction, with the existing ID tie-break. The SEO average is null if any active Topic needs backfill; unrelated counts remain authoritative. `staleScores` also counts unresolved trash rows, so a nonzero value alone does not imply that the active-only average is unavailable. No read-time analysis or zero-score substitution is permitted.

## 2. Official Production backfill

Use [scripts/backfill-entity-seo-scores.mts](../../scripts/backfill-entity-seo-scores.mts), exposed by `npm run backfill:entity-seo`. The existing isolated API retains its loopback-only guard. Production requires an explicit, separate opt-in; do not disguise a remote target as loopback.

The Production target contract requires:

- `--production --confirm production-entity-seo-backfill`.
- `--project-ref`, `--host`, `--database postgres` and an explicit numeric `--max-rows`.
- `ENTITY_SEO_BACKFILL_DATABASE_URL` injected privately. `.env.local` is never loaded automatically.
- A direct Supabase endpoint with the matching project reference, or a session-pooler endpoint with its project-qualified Postgres username, on port 5432. The tool verifies the database role and database name after connection.
- Certificate verification enabled. When an additional official CA is required, set `ENTITY_SEO_BACKFILL_CA_FILE` to the independently obtained and verified certificate file. The API equivalent is `production.sslCaFile`. Never use `rejectUnauthorized: false`, an untrusted certificate captured from a failed connection, or an insecure TLS fallback. URL query options cannot override the TLS policy.

Supabase documents [direct and session connections](https://supabase.com/docs/guides/database/connecting-to-postgres). The published CA used for this cutover is [prod-ca-2021.crt](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt); record the actual retrieved file's hash and verify its trusted provenance before use. Its content hash is part of the receipt's target fingerprint.

Example PowerShell invocation, after private credential injection; replace placeholders with the approved values:

```powershell
$seoBackfillArguments = @(
  '--production', '--confirm', 'production-entity-seo-backfill',
  '--project-ref', '<approved-project-reference>',
  '--host', '<approved-direct-or-session-host>',
  '--database', 'postgres',
  '--max-rows', '<approved-numeric-population-limit>'
)
$seoReceipt = '<private-receipt-file>'
$env:ENTITY_SEO_BACKFILL_CA_FILE = '<verified-official-ca-file>'

npm.cmd run backfill:entity-seo -- @seoBackfillArguments --dry-run --receipt $seoReceipt
if ($LASTEXITCODE -ne 0) { throw 'Backfill dry-run blocked.' }

npm.cmd run backfill:entity-seo -- @seoBackfillArguments --apply --receipt $seoReceipt
if ($LASTEXITCODE -ne 0) { throw 'Backfill apply blocked; preserve counts and investigate.' }

npm.cmd run backfill:entity-seo -- @seoBackfillArguments --verify
if ($LASTEXITCODE -ne 0) { throw 'Independent backfill verification blocked.' }

npm.cmd run backfill:entity-seo -- @seoBackfillArguments --apply --receipt $seoReceipt
if ($LASTEXITCODE -ne 0) { throw 'Backfill idempotency check blocked.' }
```

The default mode is dry-run. Choose only one of `--dry-run`, `--apply`, or `--verify`. Programmatic callers use the same exported `runEntitySeoBackfill` with `production: { confirmation, projectRef, expectedHost, maxRows, sslCaFile?, dryRunReceipt? }`; the dry-run returns `dryRunReceipt` for the subsequent apply.

The receipt binds the target, certificate choice, owner/tooling source hash, score version, maximum authorized population and each table's bounded snapshot count/upper ID. It contains no entity content or credential. Production apply requires a matching successful receipt and repeats a complete read-only preflight before its first update. A changed population or source requires a fresh dry-run. An unchanged receipt may be reused to resume partial progress.

Reads use bounded keyset batches; the API accepts `batchSize` from 1 to 1000, default 100. Each update changes only the derived tuple and uses the existing final-input fingerprint CAS. Source fields and editorial timestamps must remain unchanged. A conflict never overwrites a newer input snapshot; the operation fails its completion gate and can be resumed from current data. There is no single transaction across all rows, so earlier successful updates may remain committed after a later failure.

Reports contain `targeted`, `calculated`, `written`, `unchanged`, `conflicted`, `failed` and `unresolved`, per entity and in aggregate. Production apply exposes its repeated dry-run counts separately as `preflight`; these are not included silently in the apply-phase calculation count.

- Positive `unresolved` in a successful dry-run means work remains; it is not an enforcement success. `failed` and `conflicted` must be zero before apply.
- Apply and independent verify must have zero `failed`, `conflicted` and `unresolved`. Connection, SQL and cleanup failures block completion without printing raw errors.
- Verify recomputes through the actual SEO owner and never writes. Only a successful independent verify sets the tool's `readyForEnforcement` prerequisite. An apply or zero-write rerun does not establish that proof.
- An idempotent apply on unchanged data must report zero calculations and zero writes. If independent verify detects a mismatched score despite an apparently reusable version/hash, investigate; a controlled fresh dry-run and apply with `--recalculate` use the same owner to recompute instead of reusing the tuple.
- Invalid canonical input is not silently skipped, normalized into invented content, or repaired by this tool. Preserve blocking counts and resolve any source-data issue only through its authorized owner and scope.

This pre-backfill runs while old main may still receive writes. It is not the final enforcement gate: a later legacy SEO edit can correctly make a tuple unresolved again.

## 3. ADOPT through merge and automatic deployment

Keep EXPAND semantics active while completing the reviewed Standard Merge Commit using the exact corrected PR head. Do not use squash, rebase, auto-merge, or a manual Production deployment.

Wait for the automatic Vercel Production deployment of the merge SHA to be READY and verify **all Production aliases** serve that deployment. The authenticated read-only preflight observed Skew Protection **Disabled**, plan **Hobby**, and Fluid Compute **Enabled**; retain `.tmp-qa/entity-seo-cutover/vercel-retirement-preflight.json` and recheck these settings at cutover. [Skew Protection](https://vercel.com/docs/skew-protection) can route requests to an older deployment, so readiness or an alias change alone does not prove retirement.

Confirm old deployments no longer receive Production writer requests through aliases, pinned routing, direct deployment URLs or other active callers. Record that routing cutoff, then allow **more than 300 seconds** for prior invocations to drain: the verified [Hobby Fluid Compute maximum duration](https://vercel.com/docs/functions/configuring-functions/duration#duration-limits) is 300 seconds. Only afterward obtain the fresh catch-up receipt and run apply/independent verify/idempotency. Restart the drain gate if an old writer receives another request; if routing retirement cannot be established, remain in transition and stop before ENFORCE. This is a required future gate, not a claim that Production retirement has happened. New readers remain compatible with unresolved tuples meanwhile.

The logical order is **EXPAND → ADOPT → BACKFILL → ENFORCE**, with an optional early pre-backfill. Enforcement before merge/deployment would recreate the original compatibility failure and is prohibited by this runbook.

## 4. Catch-up, independent verify and ENFORCE

1. After the adopted deployment is active and legacy execution is retired, obtain a fresh dry-run receipt and run apply, independent verify and idempotent rerun through the commands above.
2. Require zero conflicts, failures and unresolved records across both Topics and Projects, including trash. Preserve the counts and source/target fingerprints. If a population change or late legacy write occurred, repeat the bounded catch-up with a fresh receipt as necessary; do not force enforcement past it.
3. Use the 106-file CLI directory and the phase-specific registry procedure above to apply only ENFORCE. It obtains a bounded table lock, checks every row's current tuple version and canonical fingerprint under that lock, then swaps transitional triggers for strict deferred triggers in the same transaction. The tool's verify result alone cannot freeze writes that arrive later.
4. If lock acquisition times out or completeness/provenance validation fails, the migration rolls back; preserve that failure and remain in EXPAND. Investigate and rerun the appropriate catch-up or deployment-retirement gate. Do not disable triggers or weaken the preflight.
5. Prove the ENFORCE registry entry and installed/enabled strict triggers, with transitional triggers removed. Verify the existing RPC contracts and privileges remain as approved.

After ENFORCE, legacy writes lacking required proofs are rejected. Adopted writers still calculate through the shared TypeScript owner before entering their existing atomic write boundary. If an application rollback is needed, do not reactivate an incompatible legacy writer against strict enforcement; stop and use the separately reviewed forward-fix/recovery decision.

## 5. Final verification and closure

Verify schema and registry provenance, stored tuple completeness, persisted Topics rows/metrics/sort, public route smoke, and Admin smoke when a trusted session exists. A missing Admin session is a reported smoke limitation; do not create a Production admin user for this check. Do not perform Production writes merely to measure latency.

Keep Pages semantic adoption and the remaining Project form/action/Browser proof limits explicit; native RPC evidence must not be promoted into full workflow coverage. Do not claim global SEO closure. Record the final PR head, merge SHA, automatic deployment identity, backfill/ENFORCE results and safe smoke outcome before Git alignment and the separately authorized branch cleanup.

Stop before Production mutation if transitional invalidation cannot be proven. Stop before proceeding across any gate when provenance differs, the old/new writer rehearsal fails, backfill has failures/conflicts/unresolved records, enforcement cannot be safely activated, or an unexpected data-loss/Auth/permissions issue appears. Rehearsal success, registry application, deployment readiness and Production behavior are separate evidence requirements.
