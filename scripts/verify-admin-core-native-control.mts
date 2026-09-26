import { readCoreSpecializedSettingsCheckpoint } from "./verify-admin-core-specialized-settings-isolated.mts";
import { readCoreReadonlyHubCheckpoint } from "./verify-admin-core-readonly-hubs-isolated.mts";
import { readCorePageCompositionCheckpoint } from "./verify-admin-core-page-composition-isolated.mts";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";

import { readCoreFormPermissionFingerprint } from "./verify-admin-core-form-permission-isolated.mts";

import { assertCoreAuditActor, readCoreFixedQaActor, readCoreDomainCheckpoint, verifyCoreExecutedWriteProjections } from "./verify-admin-core-domain-readback-isolated.mts";

import { createOwnedCoreDomainWriteFaults } from "./verify-admin-core-domain-write-fault-isolated.mts";

/** Fixed owned checkpoints/faults; the Browser never receives a database key, SQL or PID selector. */
export async function runOwnedAdminCoreNativeControl<T>(handle: OwnedLocalHandle, artifactDir: string, execute: () => Promise<T>): Promise<T> {
  assertOwnedLocalHandle(handle);
  const fixtures = JSON.parse(readFileSync(join(artifactDir, "admin-adoption-fixtures.json"), "utf8"));
  const faults = fixtures.commandClosure ? createOwnedCoreDomainWriteFaults(handle, fixtures) : null;
  const faultKinds = ["domain-write-fault-arm", "domain-write-fault-cancel", "domain-write-fault-release"];
  const processed = new Set<string>();
  const records: Array<Record<string, unknown>> = [];
  let finished = false, failure: unknown, value: T | undefined;
  const running = execute().then(result => { value = result; finished = true; }, error => { failure ??= error; finished = true; });
  try {
    while (!finished) {
      const requests = readdirSync(artifactDir).filter(file => /^core-native-request-[a-f0-9-]{36}\.json$/.test(file) && !processed.has(file)).sort();
      for (const file of requests) {
        const request = JSON.parse(readFileSync(join(artifactDir, file), "utf8"));
        assert.equal(file, `core-native-request-${request.id}.json`);
        assert.ok(["category-create-durable", "topic-command-durable", "terminal-domain-state", "terminal-trash-set", "form-permission-fingerprint", "form-save-native", "page-composition-state", "readonly-hub-state", "specialized-settings-state", ...faultKinds].includes(request.kind), "Only fixed native proofs may request state.");
        if (request.kind !== "terminal-trash-set" && request.kind !== "form-permission-fingerprint" && request.kind !== "readonly-hub-state" && request.kind !== "specialized-settings-state" && !faultKinds.includes(request.kind)) assert.ok(Number.isFinite(Date.parse(request.startedAt)));
        const deadline = Date.now() + 20_000;
        let response: Record<string, unknown>;
        try {
          if (request.kind === "specialized-settings-state") {
            response = await readCoreSpecializedSettingsCheckpoint(handle,request);
          } else if (request.kind === "readonly-hub-state") {
            response = await readCoreReadonlyHubCheckpoint(handle,request);
          } else if (request.kind === "page-composition-state") {
            response = await readCorePageCompositionCheckpoint(handle,request);
          } else if (request.kind === "form-permission-fingerprint") {
            response = await readCoreFormPermissionFingerprint(handle, request);
          } else if (request.kind === "form-save-native") {
            assert.deepEqual(Object.keys(request).sort(), ["caseId", "descriptors", "formConsumer", "id", "kind", "startedAt", "surface"]);
            for (const key of ["caseId", "formConsumer", "surface"]) assert.ok(typeof request[key] === "string" && /^[a-z0-9][a-z0-9:_-]{0,179}$/.test(request[key]));
            assert.ok(Array.isArray(request.descriptors) && request.descriptors.length > 0 && request.descriptors.length <= 4);
            const result = await verifyCoreExecutedWriteProjections(handle, {status: "in-progress-form-native-checkpoint", startedAt: request.startedAt, databaseReadback: request.descriptors});
            response = {id: request.id, kind: request.kind, caseId: request.caseId, formConsumer: request.formConsumer, surface: request.surface, ...result};
          } else if (faultKinds.includes(request.kind)) {
            assert.ok(faults, "Write-fault control requires the full owned domain fixture set.");
            response = await faults.handleRequest(request);
          } else if (request.kind === "terminal-domain-state" || request.kind === "terminal-trash-set") {
            response = await readCoreDomainCheckpoint(handle, request);
          } else if (request.kind === "category-create-durable") {
            assert.match(request.slug, /^qa-core-create-[a-z0-9]+$/);
            const result = await handle.withDatabaseConnection(async connection => {
              const expectedActorId = await readCoreFixedQaActor(connection);
              while (true) {
                const rows = (await connection.query("select id,name,slug,status from public.topic_categories where slug=$1 order by id", [request.slug])).rows;
                const audit = (await connection.query("select a.id,a.action,a.entity_id,a.actor_admin_user_id from public.admin_audit_logs a join public.topic_categories c on c.id=a.entity_id where a.entity_type='topic_category' and c.slug=$1 and a.created_at >= $2::timestamptz order by a.id", [request.slug, request.startedAt])).rows;
                if (rows.length > 0 && audit.length > 0) return { rows, audit, expectedActorId };
                if (Date.now() >= deadline) throw new Error("The real create did not produce durable row and actor-bound audit before reply loss.");
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            });
            assert.equal(result.rows.length, 1, "The authored create identity must have exactly one durable row.");
            assert.equal(result.audit.length, 1, "Create/retry must not manufacture an extra audit event.");
            for (const row of result.audit) assertCoreAuditActor(row, result.expectedActorId);
            response = { id: request.id, kind: request.kind, slug: request.slug, status: "pass", observedAt: new Date().toISOString(), ...result };
          } else {
            assert.ok(Number.isSafeInteger(request.topicId) && request.topicId > 0);
            assert.match(request.commandId, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
            const result = await handle.withDatabaseConnection(async connection => {
              const expectedActorId = await readCoreFixedQaActor(connection);
              const rows = (await connection.query("select id,is_featured,updated_at from public.topics where id=$1", [request.topicId])).rows;
              const audit = (await connection.query("select id,actor_admin_user_id,metadata->'command' as command from public.admin_audit_logs where entity_type='topic' and metadata->'command'->>'id'=$1 and metadata->'command'->'intent'->'ids' @> jsonb_build_array($2::bigint) and created_at >= $3::timestamptz order by id", [request.commandId, request.topicId, request.startedAt])).rows;
              const count = (await connection.query("select count(*)::integer as count from public.admin_audit_logs where entity_type='topic' and metadata->'command'->'intent'->'ids' @> jsonb_build_array($1::bigint) and created_at >= $2::timestamptz", [request.topicId, request.startedAt])).rows[0].count;
              return { rows, audit, expectedActorId, commandAuditCount: Number(count) };
            });
            assert.equal(result.rows.length, 1); assert.equal(result.audit.length, 1); assert.equal(result.commandAuditCount, 1);
            for (const row of result.audit) assertCoreAuditActor(row, result.expectedActorId);
            for (const row of result.audit) {
              const command = row.command as { actorId?: unknown };
              assert.equal(command?.actorId, result.expectedActorId, "Atomic command actor differs from the fixed owned QA identity.");
            }
            response = { id: request.id, kind: request.kind, topicId: request.topicId, commandId: request.commandId, status: "pass", observedAt: new Date().toISOString(), ...result };
          }
        } catch (error) {
          failure ??= error;
          response = { id: request.id, kind: request.kind, status: "fail", message: "The fixed native invariant failed; no passing readback is available." };
        }
        const temporary = join(artifactDir, `core-native-response-${request.id}.tmp`);
        const destination = join(artifactDir, `core-native-response-${request.id}.json`);
        assert.equal(existsSync(destination), false);
        writeFileSync(temporary, JSON.stringify(response)); renameSync(temporary, destination);
        processed.add(file); records.push(response);
      }
      if (!finished) await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (error) {
    failure ??= error;
    // Wait for the owning gate to stop before its database may be cleaned.
  } finally {
    await running;
    if (faults) {
      try { writeFileSync(join(artifactDir, "core-native-write-faults.json"), JSON.stringify(await faults.close(), null, 2) + "\n"); }
      catch (error) { failure ??= error; }
    }
    writeFileSync(join(artifactDir, "core-native-control-readback.json"), JSON.stringify({ status: failure ? "fail" : "pass", records, boundary: "Native read-only checkpoints during real authenticated HTTP commands." }, null, 2) + "\n");
  }
  if (failure) throw failure;
  return value as T;
}
