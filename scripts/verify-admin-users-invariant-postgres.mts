import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.ADMIN_USERS_INVARIANT_DATABASE_URL;
if (!connectionString) {
  throw new Error("ADMIN_USERS_INVARIANT_DATABASE_URL is required.");
}
if (process.env.ADMIN_USERS_INVARIANT_DATABASE_DISPOSABLE !== "1") {
  throw new Error(
    "Refusing fixture setup without ADMIN_USERS_INVARIANT_DATABASE_DISPOSABLE=1.",
  );
}

const migrationSource = readFileSync(
  "sql/migrations/20260814174238_admin_users_active_invariant.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

type MutationResult =
  | { ok: true }
  | { ok: false; code?: string; constraint?: string; message: string };

function errorRecord(error: unknown) {
  return error && typeof error === "object"
    ? error as { code?: string; constraint?: string; message?: string }
    : {};
}

async function runConcurrentMutation(
  client: InstanceType<typeof Client>,
  statement: string,
  id: number,
): Promise<MutationResult> {
  try {
    await client.query(statement, [id]);
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback");
    const record = errorRecord(error);
    return {
      ok: false,
      code: record.code,
      constraint: record.constraint,
      message: record.message ?? String(error),
    };
  }
}

async function proveConcurrentInvariant(
  statement: string,
  expectedActiveCount: number,
) {
  const first = new Client({ connectionString });
  const second = new Client({ connectionString });
  await Promise.all([first.connect(), second.connect()]);
  try {
    await Promise.all([
      first.query("begin"),
      second.query("begin"),
    ]);
    await Promise.all([
      first.query("set local statement_timeout = '10s'"),
      second.query("set local statement_timeout = '10s'"),
    ]);

    const results = await Promise.all([
      runConcurrentMutation(first, statement, 1),
      runConcurrentMutation(second, statement, 2),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    const failure = results.find((result) => !result.ok);
    assert.ok(failure && !failure.ok);
    assert.equal(failure.code, "23514");
    assert.equal(failure.constraint, "admin_users_last_active_required");
    assert.match(failure.message, /admin_users_last_active_required/u);

    const proof = new Client({ connectionString });
    await proof.connect();
    try {
      const activeCount = Number(
        (await proof.query(
          "select count(*)::integer as count from public.admin_users where is_active is true",
        )).rows[0]?.count,
      );
      assert.equal(activeCount, expectedActiveCount);
    } finally {
      await proof.end();
    }
  } finally {
    await Promise.allSettled([first.end(), second.end()]);
  }
}

const setup = new Client({
  connectionString,
  application_name: "admin-users-active-invariant-proof",
});
await setup.connect();

try {
  const databaseName = String(
    (await setup.query("select current_database() as name")).rows[0]?.name ?? "",
  );
  assert.match(databaseName, /admin.users.*invariant/i);
  const publicTableCount = Number(
    (await setup.query(
      "select count(*)::integer as count from pg_tables where schemaname = 'public'",
    )).rows[0]?.count,
  );
  assert.equal(publicTableCount, 0, "proof database must start empty");

  await setup.query(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.admin_users (
      id bigint primary key,
      is_active boolean not null default true
    );
  `);
  await setup.query(migrationSource);
  await setup.query(
    "insert into public.admin_users(id, is_active) values (1, true), (2, true)",
  );

  const functionContract = (await setup.query(`
    select procedure.prosecdef, procedure.proconfig
    from pg_proc as procedure
    where procedure.oid = 'public.enforce_admin_users_active_invariant()'::regprocedure
  `)).rows[0] as { prosecdef: boolean; proconfig: string[] | null } | undefined;
  assert.equal(functionContract?.prosecdef, false);
  assert.ok(
    functionContract?.proconfig?.some((setting) => setting.startsWith("search_path=")),
    "trigger function must pin an empty search_path",
  );

  const privileges = (await setup.query(`
    select
      has_function_privilege('anon', 'public.enforce_admin_users_active_invariant()', 'EXECUTE') as anon,
      has_function_privilege('authenticated', 'public.enforce_admin_users_active_invariant()', 'EXECUTE') as authenticated,
      has_function_privilege('service_role', 'public.enforce_admin_users_active_invariant()', 'EXECUTE') as service_role
  `)).rows[0] as Record<string, boolean>;
  assert.deepEqual(privileges, {
    anon: false,
    authenticated: false,
    service_role: false,
  });

  await proveConcurrentInvariant(
    "update public.admin_users set is_active = false where id = $1",
    1,
  );

  await setup.query("update public.admin_users set is_active = true");
  await proveConcurrentInvariant(
    "delete from public.admin_users where id = $1",
    1,
  );

  console.log(
    "verify-admin-users-invariant-postgres: concurrent deactivate/delete invariants passed",
  );
} finally {
  await setup.end();
}
