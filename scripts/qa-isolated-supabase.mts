import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { runApplicationHandoff } from "./lib/isolated-public-application.mts";
import { assertDatabaseSecurityCatalog, captureDatabaseSecurityCatalog, loadDatabaseSecurityContract } from "./lib/database-rls-security-contract.mts";
import { IsolatedSupabaseError, runIsolatedSupabase, type IsolatedSupabaseOptions, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

const root = resolve(import.meta.dirname, "..");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const migrationSources = () => readdirSync(resolve(root, "sql/migrations"))
  .filter(file => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file)).sort()
  .map(file => ({ file, version: file.slice(0, 14), name: file.slice(15, -4),
    sql: readFileSync(resolve(root, "sql/migrations", file), "utf8").replace(/\r\n?/gu, "\n") }));
type QaOptions = IsolatedSupabaseOptions & { retainedProof?: string };

/** Read-only structural comparison for two new runs of this same lifecycle. */
async function applicationStructure(handle: OwnedLocalHandle) {
  const result = await handle.query(`select jsonb_build_object(
    'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),
      'acl',nspacl::text) order by nspname collate "C") from pg_namespace
      where nspname !~ '^pg_' and nspname <> 'information_schema'),
    'relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,
      'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
      'acl',c.relacl::text,'options',c.reloptions) order by n.nspname collate "C",c.relname collate "C")
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'position',a.attnum,
      'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))
      order by n.nspname collate "C",c.relname collate "C",a.attnum)
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attnum>0 and not a.attisdropped and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,
      'type',k.contype,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,
      'deferrable',k.condeferrable,'deferred',k.condeferred,'local',k.conislocal,'inheritCount',k.coninhcount,
      'noInherit',k.connoinherit) order by n.nspname collate "C",c.relname collate "C",k.conname collate "C")
      from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'indexes',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
      'definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready)
      order by n.nspname collate "C",c.relname collate "C") from pg_index i join pg_class c on c.oid=i.indexrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'views',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
      'definition',pg_get_viewdef(c.oid,false)) order by n.nspname collate "C",c.relname collate "C")
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind in ('v','m') and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'sequences',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
      'type',format_type(s.seqtypid,null),'start',s.seqstart,'increment',s.seqincrement,
      'min',s.seqmin,'max',s.seqmax,'cache',s.seqcache,'cycle',s.seqcycle)
      order by n.nspname collate "C",c.relname collate "C")
      from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'enumValues',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'type',t.typname,
      'position',e.enumsortorder,'value',e.enumlabel) order by n.nspname collate "C",t.typname collate "C",e.enumsortorder)
      from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
      'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),
      'acl',p.proacl::text,'definitionSha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))
      order by n.nspname collate "C",p.proname collate "C",pg_get_function_identity_arguments(p.oid) collate "C")
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and p.prokind in ('f','p')),
    'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,
      'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid))
      order by n.nspname collate "C",c.relname collate "C",t.tgname collate "C")
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'),
    'policies',(select jsonb_agg(to_jsonb(p) order by schemaname collate "C",tablename collate "C",policyname collate "C")
      from pg_policies p where schemaname !~ '^pg_' and schemaname <> 'information_schema'),
    'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)
      order by e.extname collate "C") from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
    'registry',(select jsonb_agg(jsonb_build_object('version',version,'name',name,
      'statementCount',cardinality(statements),'statementsSha256',encode(sha256(convert_to(array_to_json(statements)::text,'UTF8')),'hex'))
      order by version collate "C") from supabase_migrations.schema_migrations),
    'storageMigrations',(select jsonb_agg(to_jsonb(m)-'executed_at' order by id) from storage.migrations m)
    ) as structure`);
  assert.equal(result.rows.length, 1);
  return result.rows[0].structure;
}

function proofInputs(argv: string[]) {
  const parsed = options(argv);
  assert.ok(parsed.handoff && !parsed.cleanupOnly && !parsed.failureInjection);
  const output = resolve(parsed.artifactDir);
  assert.ok(output.startsWith(resolve(root, ".tmp-qa") + sep) && !existsSync(output));
  let ancestor = dirname(output);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  assert.equal(realpathSync(ancestor), ancestor);
  assert.equal(lstatSync(ancestor).isSymbolicLink(), false);
  const gitEnvironment: Record<string, string | undefined> = {};
  for (const name of ["PATH", "SystemRoot", "WINDIR", "PATHEXT"]) {
    if (process.env[name]) gitEnvironment[name] = process.env[name];
  }
  execFileSync("git", ["check-ignore", "--quiet", "--", output],
    // Sparse native Git environment; no Next NODE_ENV entry is needed.
    { cwd: root, env: gitEnvironment as NodeJS.ProcessEnv, windowsHide: true, stdio: "ignore", timeout: 15_000 });
  const sources = migrationSources(), sourceHash = hash(sources);
  const additional = process.env.VENISIA_PUBLIC_ADDITIONAL_SOURCE_MANIFEST;
  assert.ok(additional, "An explicit reviewed new-source manifest is required.");
  const manifestPath = resolve(additional);
  assert.ok(manifestPath.startsWith(resolve(root, ".tmp-qa") + sep));
  assert.ok(lstatSync(manifestPath).isFile() && !lstatSync(manifestPath).isSymbolicLink());
  assert.equal(realpathSync(manifestPath), manifestPath);
  const files: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.ok(Array.isArray(files) && files.every(file => typeof file === "string"));
  return { parsed, output, sources, sourceHash, files: files as string[] };
}

function createProofRecorder(output: string, sourceHash: string, files: readonly string[]) {
  mkdirSync(output, { recursive: true });
  assert.equal(realpathSync(output), output);
  const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  save("source-identity.json", { corpusSha256: sourceHash, additionalSourceFiles: files });
  return save;
}

async function finalPublicProof(argv: string[]) {
  const { parsed, output, sources, sourceHash, files } = proofInputs(argv);
  let retainedContract: Record<string, unknown> | undefined;
  let retainedReproducibility: Record<string, unknown> | undefined;
  if (parsed.retainedProof) {
    const retained = resolve(parsed.retainedProof);
    assert.ok(retained.startsWith(resolve(root, ".tmp-qa") + sep) && retained !== output);
    assert.ok(lstatSync(retained).isDirectory() && !lstatSync(retained).isSymbolicLink());
    assert.equal(realpathSync(retained), retained);
    const evidence = (name: string) => {
      const path = resolve(retained, name);
      assert.ok(path.startsWith(retained + sep) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink());
      assert.equal(realpathSync(path), path);
      return JSON.parse(readFileSync(path, "utf8"));
    };
    const previousSource = evidence("source-identity.json");
    assert.equal(previousSource.corpusSha256, sourceHash, "Retained A/B migration source changed.");
    assert.deepEqual(previousSource.additionalSourceFiles, files, "Retained source inventory changed.");
    const a = evidence("run-a-contract.json"), b = evidence("run-b-contract.json");
    const proof = evidence("reproducibility.json");
    assert.equal(proof.status, "pass"); assert.deepEqual(a, b);
    assert.equal(hash(a), proof.runA); assert.equal(hash(b), proof.runB);
    for (const name of ["run-a", "run-b"]) {
      const cleanup = evidence(`${name}/cleanup.json`);
      assert.equal(cleanup.status, "complete"); assert.equal(cleanup.remainingOwnedResources, 0);
      assert.equal(cleanup.originalResourcesUnchanged, true); assert.equal(cleanup.privateEnvRemoved, true);
    }
    assert.notEqual(evidence("run-b/public-normal-build.json").code, 0,
      "This bounded resume is only for the failed first Build gate.");
    const previousBuild = evidence("run-b/public-source-manifest.json");
    assert.equal(hash(previousBuild.manifest), previousBuild.sourceSha256);
    const reviewedQaCorrections = new Set([
      "scripts/lib/isolated-public-verification.mts", "scripts/lib/isolated-supabase.mts",
      "scripts/lib/isolated-supabase-cli.mts", "scripts/qa-isolated-supabase.mts",
      "scripts/verify-isolated-supabase.mts",
    ]);
    // Only QA tooling may have changed for this resume. Application/test/config,
    // migration, fixture lock and Compose source stay bound to the retained proof.
    for (const row of previousBuild.manifest as Array<{ file: string; sha256: string }>) {
      if (reviewedQaCorrections.has(row.file)) continue;
      const path = resolve(root, row.file);
      assert.ok(path.startsWith(root + sep) && realpathSync(path) === path);
      assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), row.sha256,
        "Product/config/fixture source changed after retained A/B.");
    }
    retainedContract = a;
    retainedReproducibility = { ...proof, retainedFrom: retained, reexecuted: false };
  }
  const save = createProofRecorder(output, sourceHash, files);
  if (retainedReproducibility) save("reproducibility.json", retainedReproducibility);
  let baseline: unknown;
  const runNames = retainedContract ? ["run-c"] : ["run-a", "run-b"];
  for (const name of runNames) {
    await runIsolatedSupabase({ ...parsed, artifactDir: resolve(output, name), async handoff(handle) {
      await runApplicationHandoff(handle);
      const loaded = loadDatabaseSecurityContract(sources);
      const catalog = await captureDatabaseSecurityCatalog(handle, loaded);
      const security = assertDatabaseSecurityCatalog(loaded, catalog);
      const readiness = await handle.preparePublicVerification();
      const stableReadiness = { ...readiness, syntheticTopicCreated: undefined, syntheticCategoryCreated: undefined };
      save(`${name}-security.json`, security);
      assert.equal(hash(migrationSources()), sourceHash, "Canonical migration source changed during A/B proof.");
      if (retainedContract) {
        assert.deepEqual(catalog, retainedContract.securityCatalog);
        assert.deepEqual(JSON.parse(JSON.stringify(stableReadiness)), retainedContract.readiness);
        save(`${name}-readiness.json`, stableReadiness);
        save("four-gates.json", await handle.runPublicVerification({ additionalSourceFiles: files as string[] }));
        return;
      }
      const structure = await applicationStructure(handle);
      const contract = { structure, securityCatalog: catalog, readiness: stableReadiness };
      save(`${name}-contract.json`, contract);
      if (name === "run-a") baseline = contract;
      else {
        assert.deepEqual(contract, baseline, "Canonical fresh A/B structural contract differs.");
        save("reproducibility.json", { status: "pass", runA: hash(baseline), runB: hash(contract), independentFreshResources: true });
        save("four-gates.json", await handle.runPublicVerification({ additionalSourceFiles: files as string[] }));
      }
    } });
  }
  let failedClosed = false;
  try {
    await runIsolatedSupabase({ ...parsed, artifactDir: resolve(output, "failure-proof"), failureInjection: "before-handoff",
      async handoff() { throw new Error("Failure injection must prevent application handoff."); } });
  } catch (error) {
    assert.ok(error instanceof IsolatedSupabaseError && error.code === "INJECTED_BEFORE_HANDOFF", "Unexpected failure-proof cause.");
    failedClosed = true;
  }
  assert.ok(failedClosed);
  for (const name of [...runNames, "failure-proof"]) {
    const cleanup = JSON.parse(readFileSync(resolve(output, name, "cleanup.json"), "utf8"));
    assert.equal(cleanup.status, "complete"); assert.equal(cleanup.remainingOwnedResources, 0);
    assert.equal(cleanup.originalResourcesUnchanged, true); assert.equal(cleanup.privateEnvRemoved, true);
  }
  save("final-public-proof.json", { status: "pass", retained: 131, completedRequiredGates: 4, total: 135,
    adminRuntimeRetained: "32/32", settingsRetained: "6/6", previousSuccessesRerun: false,
    productionRead: false, productionWrite: false, gitDelivery: false, failureClosed: true, cleanup: "complete",
    reproducibilityRetained: Boolean(retainedContract) });
  return { status: "complete", artifactDir: output };
}

/** Rebuild affected source once without repeating accepted behavioral/platform proofs. */
async function buildContractsProof(argv: string[]) {
  const { parsed, output, sourceHash, files } = proofInputs(argv);
  assert.equal(parsed.retainedProof, undefined, "The affected-build selection does not resume the failed four-gate proof.");
  const save = createProofRecorder(output, sourceHash, files);
  const runDirectory = resolve(output, "run");
  await runIsolatedSupabase({ ...parsed, artifactDir: runDirectory, async handoff(handle) {
    // Fresh bootstrap is solely this owned build's database prerequisite.
    await runApplicationHandoff(handle);
    save("readiness.json", await handle.preparePublicVerification());
    assert.equal(hash(migrationSources()), sourceHash, "Canonical migration source changed before the affected Build gates.");
    const gates = await handle.runPublicVerification({ additionalSourceFiles: files, selection: "build-contracts" });
    assert.deepEqual(gates.gates.map(gate => gate.name), ["normal-build", "product-surface-build", "platform-contracts"]);
    save("three-gates.json", gates);
  } });
  const cleanup = JSON.parse(readFileSync(resolve(runDirectory, "cleanup.json"), "utf8"));
  assert.equal(cleanup.status, "complete"); assert.equal(cleanup.remainingOwnedResources, 0);
  assert.equal(cleanup.originalResourcesUnchanged, true); assert.equal(cleanup.privateEnvRemoved, true);
  const processCleanup = JSON.parse(readFileSync(resolve(runDirectory, "public-process-cleanup.json"), "utf8"));
  assert.equal(processCleanup.ownedProcessesStopped, true); assert.equal(processCleanup.buildWorkspaceRemoved, true);
  assert.equal(processCleanup.otherResourcesTouched, false);
  save("final-build-contracts-proof.json", { status: "pass", selection: "build-contracts", completedRequiredGates: 3,
    gates: ["normal-build", "product-surface-build", "platform-contracts"],
    bootstrapPurpose: "owned-build-prerequisite-only", publicE2EReexecuted: false,
    reproducibilityReexecuted: false, securityAuditReexecuted: false, failureInjectionReexecuted: false,
    previousUnaffectedGatesReexecuted: false, aggregateFinalGateClaimed: false,
    productionRead: false, productionWrite: false, gitDelivery: false, cleanup: "complete" });
  return { status: "complete", selection: "build-contracts", artifactDir: output };
}

function options(argv: string[]): QaOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (key === "--platform-only" || key === "--cleanup-only") {
      if (flags.has(key)) throw new IsolatedSupabaseError("DUPLICATE_ARGUMENT", "cli");
      flags.add(key); continue;
    }
    if (!["--lock", "--output", "--retained-proof", "--docker-binary", "--docker-host", "--cli-binary", "--pg-port", "--rest-port", "--storage-port", "--api-port", "--inject-failure"].includes(key)
      || values.has(key) || !argv[index + 1] || argv[index + 1].startsWith("--")) throw new IsolatedSupabaseError("INVALID_ARGUMENT", "cli");
    values.set(key, argv[++index]);
  }
  const output = values.get("--output");
  if (!output) throw new IsolatedSupabaseError("OUTPUT_REQUIRED", "cli");
  const injection = values.get("--inject-failure");
  if (injection && injection !== "before-handoff") throw new IsolatedSupabaseError("INVALID_FAILURE_INJECTION", "cli");
  return {
    lockPath: resolve(values.get("--lock") ?? "scripts/fixtures/isolated-supabase/stack.lock.json"),
    artifactDir: resolve(output),
    retainedProof: values.has("--retained-proof") ? resolve(values.get("--retained-proof")!) : undefined,
    dockerBinary: values.get("--docker-binary"), dockerHost: values.get("--docker-host"),
    cliBinary: values.has("--cli-binary") ? resolve(values.get("--cli-binary")!) : undefined,
    pgPort: values.has("--pg-port") ? Number(values.get("--pg-port")) : undefined,
    restPort: values.has("--rest-port") ? Number(values.get("--rest-port")) : undefined,
    storagePort: values.has("--storage-port") ? Number(values.get("--storage-port")) : undefined,
    apiPort: values.has("--api-port") ? Number(values.get("--api-port")) : undefined,
    failureInjection: injection as "before-handoff" | undefined,
    cleanupOnly: flags.has("--cleanup-only"),
    handoff: flags.has("--platform-only") || flags.has("--cleanup-only") ? undefined : runApplicationHandoff,
  };
}

try {
  const args = process.argv.slice(2);
  const proofModes = args.filter(arg => arg === "--final-public-proof" || arg === "--build-contracts-proof");
  assert.ok(proofModes.length <= 1, "Choose one fixed proof mode exactly once.");
  assert.ok(!args.includes("--retained-proof") || args.includes("--final-public-proof"));
  const result = args.includes("--final-public-proof")
    ? await finalPublicProof(args.filter(arg => arg !== "--final-public-proof"))
    : args.includes("--build-contracts-proof")
      ? await buildContractsProof(args.filter(arg => arg !== "--build-contracts-proof"))
    : await runIsolatedSupabase(options(args));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const safe = error instanceof IsolatedSupabaseError ? error : new IsolatedSupabaseError("UNCLASSIFIED_FAILURE", "cli");
  process.stderr.write(`${JSON.stringify({ status: "needs_attention", stage: safe.stage, code: safe.code })}\n`);
  process.exitCode = 1;
}
