import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types.ts";
import { resolve } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle, type OwnedDatabaseConnection } from "./lib/isolated-supabase.mts";
type Connection = Pick<OwnedDatabaseConnection, "query">;
const readSql = "select public.read_public_cache_generation() value";
const bumpSql = "select public.advance_public_cache_generation() value";
const value = async (db: Connection, sql = readSql) => String((await db.query(sql)).rows[0].value);
const code = (error: unknown) => error !== null && typeof error === "object" && "code" in error ? String(error.code) : "unknown";

/** The real SDK parses real owned PostgREST responses; credentials remain inside the owner. */
function nativeGenerationOwner(handle: OwnedLocalHandle) {
  const origin = "http://127.0.0.1:54321";
  const requests: Array<{ name: string; status: number }> = [];
  const client = createClient<Database>(origin, "owned-test-placeholder", { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, origin); assert.equal(init?.method, "POST");
      const match = /^\/rest\/v1\/rpc\/(read_public_cache_generation|advance_public_cache_generation)$/u.exec(url.pathname);
      assert.ok(match); const args = JSON.parse(String(init?.body ?? "{}")); assert.deepEqual(args, {});
      const response = await handle.callDataApiRpc(match[1], args); requests.push({ name: match[1], status: response.status }); return response;
    } } });
  const entries = new Map<string, unknown>();
  type Cache = typeof import("next/cache").unstable_cache;
  const persistentCache: Cache = (callback, parts) => (async (...args: unknown[]) => {
    const key = JSON.stringify([callback.toString(), parts, args]); if (entries.has(key)) return entries.get(key);
    const result = await callback(...args); entries.set(key, result); return result;
  }) as typeof callback;
  const require = createRequire(import.meta.url), exports: Record<string, unknown> = {};
  const source = readFileSync(resolve(import.meta.dirname, "../src/lib/cache/public-cache-generation.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, process: { env: { NEXT_PUBLIC_SUPABASE_URL: origin } }, URL, BigInt,
    require: (name: string) => {
      if (name === "server-only") return {};
      if (name === "next/cache") return { unstable_cache: persistentCache };
      if (name === "next/navigation" || name === "react") return require(name);
      if (name === "../supabase-admin") return { getSupabaseAdmin: () => client };
      assert.equal(name, "node:crypto"); return require(name);
    } });
  return { owner: exports as typeof import("../src/lib/cache/public-cache-generation.ts"), client, entries, requests };
}

/** Invoke at the actual pre115 application checkpoint; never drop a deployed function to simulate it. */
export async function verifyPublicCacheMissingGeneration(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  assert.equal((await handle.query("select to_regprocedure('public.read_public_cache_generation()') is null missing")).rows[0].missing, true);
  const fixture = nativeGenerationOwner(handle);
  const raw = await fixture.client.rpc("read_public_cache_generation");
  assert.ok(raw.error);
  assert.equal(raw.error.code, "PGRST202", "Need the actual missing function response from PostgREST.");
  assert.equal(await fixture.owner.readPublicCacheGeneration(), null);
  let calls = 0; const read = fixture.owner.cachePublicRead(async () => ++calls, ["missing-native"]);
  assert.equal(await read(), 1); assert.equal(await read(), 2); assert.equal(fixture.entries.size, 0);
  const result = { status: "pass", absentFunctionCode: raw.error.code, uncachedCallbacks: calls, persistentEntries: fixture.entries.size, requests: fixture.requests };
  mkdirSync(artifactDir, { recursive: true }); writeFileSync(resolve(artifactDir, "public-cache-missing-generation.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

/** Native metadata/transaction proof inside the existing owned disposable application. */
export async function verifyPublicCacheGeneration(handle: OwnedLocalHandle, artifactDir: string) {
  assertOwnedLocalHandle(handle);
  const result = { status: "running", scope: "Native primary cache metadata only; no Production/Auth/Storage rows. Actual cache adapter is a separate receipt.",
    tests: [] as Array<Record<string, unknown>>, error: null as string | null };
  const save = () => { mkdirSync(artifactDir, { recursive: true }); writeFileSync(resolve(artifactDir, "public-cache-generation.json"), JSON.stringify(result, null, 2) + "\n"); };
  const pass = (name: string, evidence: Record<string, unknown> = {}) => { result.tests.push({ name, status: "pass", ...evidence }); save(); };
  save();
  try {
    const initial = await value(handle);
    assert.match(initial, /^(0|[1-9][0-9]*)$/u);
    const security = (await handle.query(`select c.relrowsecurity rls, pg_get_userbyid(c.relowner) owner,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_table,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated_table,
      has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') service_table,
      has_function_privilege('anon','public.read_public_cache_generation()','EXECUTE') anon_read,
      has_function_privilege('authenticated','public.advance_public_cache_generation()','EXECUTE') authenticated_bump,
      has_function_privilege('service_role','public.read_public_cache_generation()','EXECUTE') service_read,
      has_function_privilege('service_role','public.advance_public_cache_generation()','EXECUTE') service_bump
      from pg_class c where c.oid='public.public_cache_generation'::regclass`)).rows[0];
    assert.deepEqual(security, { rls: true, owner: "postgres", anon_table: false, authenticated_table: false, service_table: false,
      anon_read: false, authenticated_bump: false, service_read: true, service_bump: true });
    pass("service-only RPC and no direct metadata grants", security);
    await handle.renewDatabaseControlConnection();
    await handle.withDatabaseConnection(async reader => handle.withDatabaseConnection(async first => handle.withDatabaseConnection(async second => {
      try {
        for (const db of [reader, first, second]) await db.query("set statement_timeout='12s'; set lock_timeout='5s'; set idle_in_transaction_session_timeout='30s'");
        const pids = await Promise.all([reader, first, second].map(async db => Number((await db.query("select pg_backend_pid() pid")).rows[0].pid)));
        assert.equal(new Set(pids).size, 3);
        await reader.query("begin read only; set local role service_role");
        assert.equal(await value(reader), initial);
        assert.equal((await reader.query("select pg_current_xact_id_if_assigned()::text xid")).rows[0].xid, null);
        await reader.query("commit"); pass("fresh service read is read-only and does not assign write XID");
        for (const role of ["anon", "authenticated"]) {
          await reader.query("begin; set local role " + role);
          await assert.rejects(reader.query(readSql), error => code(error) === "42501");
          await reader.query("rollback");
          await reader.query("begin; set local role " + role);
          await assert.rejects(reader.query(bumpSql), error => code(error) === "42501");
          await reader.query("rollback");
        }
        pass("anon and authenticated execution denied natively");
        await first.query("begin; set local role service_role");
        const firstValue = await value(first, bumpSql);
        assert.equal(BigInt(firstValue), BigInt(initial) + BigInt(1));
        assert.equal(await value(reader), initial, "Uncommitted generation must not escape.");
        await second.query("set role service_role");
        const pending = value(second, bumpSql).then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
        let blocked = false;
        for (let attempt = 0; attempt < 40; attempt++) {
          const row = (await reader.query("select wait_event_type from pg_stat_activity where pid=$1", [pids[2]])).rows[0];
          if (row?.wait_event_type === "Lock") { blocked = true; break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        assert.equal(blocked, true, "Need actual native row-lock waiting proof.");
        await first.query("commit");
        const completed = await pending; if (!completed.ok) throw completed.error;
        assert.equal(BigInt(completed.value), BigInt(initial) + BigInt(2));
        assert.equal(await value(reader), completed.value);
        pass("concurrent invalidators serialize without lost update", { distinctBackendPids: pids, observedLockWait: true, initial, after: completed.value });
        const beforeRollback = await value(reader);
        await first.query("begin"); await value(first, bumpSql); await first.query("rollback");
        assert.equal(await value(reader), beforeRollback); pass("rolled-back invalidation does not advance generation");
        // Deliberately discard the first successful acknowledgment, then retry only metadata.
        await value(first, bumpSql); const retry = await value(first, bumpSql);
        assert.equal(BigInt(retry), BigInt(beforeRollback) + BigInt(2)); pass("lost-ack retry only causes a safe additional generation", { before: beforeRollback, after: retry });
        await reader.query("begin isolation level repeatable read read only");
        await assert.rejects(reader.query(readSql), error => code(error) === "25006"); await reader.query("rollback");
        pass("retained repeatable-read snapshot cannot supply the fence");
      } finally {
        for (const db of [reader, first, second]) await db.query("rollback");
      }
    })));
    // Renew only after all scoped sessions have closed (the owner rejects earlier renewal).
    await handle.renewDatabaseControlConnection();
    await handle.withDatabaseConnection(async db => {
      try {
        const retained = await value(db);
        await db.query("create temporary table qa_cache_unrelated(value integer); insert into qa_cache_unrelated values(1),(2)");
        assert.equal(await value(db), retained); pass("unrelated writes do not invalidate public caches");
        await db.query("begin; update public.public_cache_generation set generation=9223372036854775806 where singleton");
        assert.equal(await value(db), "9223372036854775806"); assert.equal(await value(db, bumpSql), "9223372036854775807");
        await assert.rejects(db.query(bumpSql), error => code(error) === "22003"); await db.query("rollback");
        assert.equal(await value(db), retained); pass("64-bit text remains exact and overflow rolls back");
        await db.query("begin; delete from public.public_cache_generation");
        await assert.rejects(db.query(readSql), error => code(error) === "P0002"); await db.query("rollback");
        assert.equal(await value(db), retained); pass("missing singleton fails closed and rollback restores it");
        await db.query("begin"); await assert.rejects(db.query("insert into public.public_cache_generation(singleton) values(false)"), error => code(error) === "23514"); await db.query("rollback");
        pass("singleton cannot acquire a second identity");
      } finally { await db.query("rollback"); }
    });
    await handle.renewDatabaseControlConnection();
    const fixture = nativeGenerationOwner(handle);
    const raw = await fixture.client.rpc("read_public_cache_generation");
    assert.equal(raw.error, null); assert.equal(typeof raw.data, "string");
    const before = await fixture.owner.readPublicCacheGeneration(); assert.ok(before);
    let callbacks = 0; const cached = fixture.owner.cachePublicRead(async () => ++callbacks, ["native-sdk-key-fence"]);
    assert.equal(await cached(), 1); assert.equal(await cached(), 1);
    await fixture.owner.advancePublicCacheGeneration();
    const after = await fixture.owner.readPublicCacheGeneration(); assert.ok(after); assert.notEqual(after, before);
    assert.equal(await cached(), 2); assert.equal(await cached(), 2);
    assert.equal(fixture.entries.size, 2); assert.ok(fixture.requests.every(request => request.status === 200));
    pass("actual SDK and service-auth PostgREST read/bump reach the production fence", {
      decimalResponseType: typeof raw.data, changedKey: before !== after, callbacks, persistentKeys: fixture.entries.size, requests: fixture.requests,
      cachePort: "in-memory model; actual Vercel adapter separately verified", credentialsExposed: false,
    });
    result.status = "pass"; save(); return result;
  } catch (error) { result.status = "fail"; result.error = code(error); save(); throw error; }
}
