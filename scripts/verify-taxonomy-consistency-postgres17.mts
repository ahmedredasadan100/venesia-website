import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

const { Client } = pg;

type QueryResult<Row> = {
  rows: Row[];
  rowCount: number | null;
};

type Notification = {
  channel: string;
  payload?: string;
};

type SqlClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  on(
    event: "notification",
    listener: (notification: Notification) => void,
  ): unknown;
  off(
    event: "notification",
    listener: (notification: Notification) => void,
  ): unknown;
};

type MutationFailure = {
  ok: false;
  code: string;
};

type CategorySuccess = {
  ok: true;
  code: "updated";
  category: {
    id: number;
    name: string;
    slug: string;
    parent_id: number | null;
    is_active: boolean;
    status: string;
    color_token: string;
    published_at: string | null;
    updated_at: string;
  };
  topics_updated: number;
};

type SeriesSuccess = {
  ok: true;
  code: "updated";
  series: {
    id: number;
    name: string;
    slug: string;
    category_id: number;
    status: string;
    deleted_at: string | null;
    updated_at: string;
  };
  topics_updated: number;
};

type CreateSeriesSuccess = {
  ok: true;
  code: "created";
  series: SeriesSuccess["series"] & { created_at: string };
};

type CategoryResult = CategorySuccess | MutationFailure;
type SeriesResult = SeriesSuccess | MutationFailure;
type CreateSeriesResult = CreateSeriesSuccess | MutationFailure;

type RestResult = {
  status: number;
  body: unknown;
  raw: string;
};

const required = process.env.TAXONOMY_CONSISTENCY_DATABASE_REQUIRED === "1";
const acknowledgedDisposable =
  process.env.TAXONOMY_CONSISTENCY_DATABASE_DISPOSABLE === "1";
const connectionString =
  process.env.TAXONOMY_CONSISTENCY_DATABASE_URL?.trim();
const postgrestOrigin =
  process.env.TAXONOMY_CONSISTENCY_POSTGREST_URL?.trim();
const jwtSecret =
  process.env.TAXONOMY_CONSISTENCY_POSTGREST_JWT_SECRET?.trim();

if (!connectionString) {
  if (required) {
    console.error(
      "FAIL verify-taxonomy-consistency-postgres17: TAXONOMY_CONSISTENCY_DATABASE_URL is required.",
    );
    process.exit(1);
  }

  console.log(
    "SKIP verify-taxonomy-consistency-postgres17: no isolated TAXONOMY_CONSISTENCY_DATABASE_URL was provided.",
  );
  process.exit(0);
}

if (!postgrestOrigin || !jwtSecret) {
  console.error(
    "FAIL verify-taxonomy-consistency-postgres17: a real isolated PostgREST URL and JWT secret are required whenever the database verifier runs.",
  );
  process.exit(1);
}

let databaseUrl: URL;
let restUrl: URL;
try {
  databaseUrl = new URL(connectionString);
  restUrl = new URL(postgrestOrigin);
} catch {
  console.error(
    "FAIL verify-taxonomy-consistency-postgres17: database or PostgREST URL is invalid.",
  );
  process.exit(1);
}

const allowedDatabaseProtocols = new Set(["postgres:", "postgresql:"]);
const allowedRestProtocols = new Set(["http:"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseName = decodeURIComponent(
  databaseUrl.pathname.replace(/^\//u, ""),
);
const isolatedDatabaseName =
  databaseName === "venesia_taxonomy_consistency_ci" ||
  /(?:^|_)taxonomy_consistency_(?:test|ci)(?:_|$)/u.test(databaseName);

if (
  !allowedDatabaseProtocols.has(databaseUrl.protocol) ||
  !loopbackHosts.has(databaseUrl.hostname) ||
  !isolatedDatabaseName ||
  !acknowledgedDisposable ||
  !allowedRestProtocols.has(restUrl.protocol) ||
  !loopbackHosts.has(restUrl.hostname) ||
  jwtSecret.length < 32
) {
  console.error(
    "FAIL verify-taxonomy-consistency-postgres17: refusing endpoints that are not loopback-only, explicitly disposable, and named for the Taxonomy Consistency test/CI.",
  );
  process.exit(1);
}

const migration = readFileSync(
  new URL(
    "../sql/migrations/20260907214608_p1_e_taxonomy_consistency.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\uFEFF/u, "");

const lifecycleMigration = readFileSync(
  new URL(
    "../sql/migrations/20260808120000_taxonomy_lifecycle_contract.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\uFEFF/u, "");

function extractLifecycleFunction(name: string, nextName: string) {
  const marker = `create or replace function public.${name}(`;
  const nextMarker = `create or replace function public.${nextName}(`;
  const start = lifecycleMigration.indexOf(marker);
  const end = lifecycleMigration.indexOf(nextMarker, start + marker.length);
  assert.ok(start >= 0, `missing lifecycle function ${name}`);
  assert.ok(end > start, `missing lifecycle boundary after ${name}`);
  return lifecycleMigration.slice(start, end).trim();
}

const categoryTrashFunctionSql = extractLifecycleFunction(
  "admin_move_topic_categories_to_trash",
  "admin_restore_topic_categories",
);
const categoryPermanentDeleteFunctionSql = extractLifecycleFunction(
  "admin_permanently_delete_topic_categories",
  "admin_move_topic_series_to_trash",
);

const connectedClients = new Set<SqlClient>();

async function createClient(label: string) {
  const client: SqlClient = new Client({
    connectionString,
    application_name: `taxonomy-consistency-${label}`,
  });
  await client.connect();
  connectedClients.add(client);
  return client;
}

async function closeClient(client: SqlClient) {
  connectedClients.delete(client);
  await client.end();
}

async function safeRollback(client: SqlClient) {
  try {
    await client.query("rollback");
  } catch {
    // Closing the disposable session below also rolls back an open transaction.
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForNotification(
  client: SqlClient,
  channel: string,
  timeoutMilliseconds = 5_000,
) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off("notification", onNotification);
      reject(new Error(`Timed out waiting for PostgreSQL NOTIFY ${channel}.`));
    }, timeoutMilliseconds);

    function onNotification(notification: Notification) {
      if (notification.channel !== channel) return;
      clearTimeout(timeout);
      client.off("notification", onNotification);
      resolve(notification.payload ?? "");
    }

    client.on("notification", onNotification);
  });
}

async function backendPid(client: SqlClient) {
  const result = await client.query<{ pid: number }>(
    "select pg_catalog.pg_backend_pid() as pid",
  );
  return Number(result.rows[0]?.pid);
}

async function waitForBlockedBackend(input: {
  observer: SqlClient;
  blockedPid: number;
  expectedBlockerPid: number;
  label: string;
  isSettled: () => boolean;
}) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (input.isSettled()) {
      throw new Error(`${input.label} completed before entering a lock wait.`);
    }

    const result = await input.observer.query<{
      state: string;
      wait_event_type: string | null;
      wait_event: string | null;
      blockers: number[];
    }>(
      `select
         activity.state,
         activity.wait_event_type,
         activity.wait_event,
         pg_catalog.pg_blocking_pids(activity.pid) as blockers
       from pg_catalog.pg_stat_activity as activity
       where activity.pid = $1`,
      [input.blockedPid],
    );
    const state = result.rows[0];
    const blockers = Array.isArray(state?.blockers)
      ? state.blockers.map(Number)
      : [];

    if (
      state?.state === "active" &&
      state.wait_event_type === "Lock" &&
      blockers.includes(input.expectedBlockerPid)
    ) {
      return state.wait_event;
    }

    await delay(25);
  }

  throw new Error(
    `${input.label} did not expose the expected PostgreSQL lock wait within 5 seconds.`,
  );
}

async function beginServiceRoleTransaction(client: SqlClient) {
  await client.query("begin");
  await client.query("set local statement_timeout = '12s'");
  await client.query("set local lock_timeout = '8s'");
  await client.query("set local role service_role");
}

async function asServiceRole<Row>(
  client: SqlClient,
  text: string,
  values: readonly unknown[] = [],
) {
  await client.query("set role service_role");
  try {
    return await client.query<Row>(text, values);
  } finally {
    await client.query("reset role");
  }
}

async function callCategory(
  client: SqlClient,
  input: {
    id: number;
    name: string;
    parentId: number | null;
    isActive: boolean;
    colorToken: string | null;
    actorId: number;
    expectedUpdatedAt: string | null;
  },
) {
  const result = await client.query<{ payload: CategoryResult }>(
    `select public.admin_update_topic_category(
       $1, $2, $3, $4, $5, $6, $7::timestamptz
     ) as payload`,
    [
      input.id,
      input.name,
      input.parentId,
      input.isActive,
      input.colorToken,
      input.actorId,
      input.expectedUpdatedAt,
    ],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

async function callSeries(
  client: SqlClient,
  input: {
    id: number;
    name: string;
    categoryId: number;
    status: string;
    actorId: number;
    expectedUpdatedAt: string | null;
  },
) {
  const result = await client.query<{ payload: SeriesResult }>(
    `select public.admin_update_topic_series(
       $1, $2, $3, $4, $5, $6::timestamptz
     ) as payload`,
    [
      input.id,
      input.name,
      input.categoryId,
      input.status,
      input.actorId,
      input.expectedUpdatedAt,
    ],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

async function callCreateSeries(
  client: SqlClient,
  input: {
    name: string;
    slug: string;
    categoryId: number;
    status: string;
    actorId: number;
  },
) {
  const result = await client.query<{ payload: CreateSeriesResult }>(
    `select public.admin_create_topic_series($1, $2, $3, $4, $5) as payload`,
    [
      input.name,
      input.slug,
      input.categoryId,
      input.status,
      input.actorId,
    ],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

type LifecycleResult = {
  affected_ids: number[];
  affected_count: number;
};

async function callCategoryTrash(
  client: SqlClient,
  categoryId: number,
  actorId = 1,
) {
  const result = await client.query<{ payload: LifecycleResult }>(
    `select public.admin_move_topic_categories_to_trash(
       array[$1]::bigint[], $2
     ) as payload`,
    [categoryId, actorId],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

async function callCategoryPermanentDelete(
  client: SqlClient,
  categoryId: number,
  actorId = 1,
) {
  const result = await client.query<{ payload: LifecycleResult }>(
    `select public.admin_permanently_delete_topic_categories(
       array[$1]::bigint[], $2
     ) as payload`,
    [categoryId, actorId],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

async function resetFixtures(admin: SqlClient) {
  await admin.query(`
    truncate table
      public.topics,
      public.topic_series,
      public.topic_categories,
      public.admin_users
    restart identity cascade;

    insert into public.admin_users(id, username, is_active) values
      (1, 'active-admin', true),
      (2, 'inactive-admin', false);

    insert into public.topic_categories(
      id, name, slug, parent_id, is_active, status, color_token,
      published_at, updated_at, deleted_at
    ) values
      (1, 'Primary', 'primary', null, true, 'published', 'blue',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000001Z', null),
      (2, 'Inactive', 'inactive', null, false, 'unpublished', 'gray',
       null, '2026-09-07T10:00:00.000002Z', null),
      (3, 'Unpublished', 'unpublished', null, true, 'unpublished', 'gray',
       null, '2026-09-07T10:00:00.000003Z', null),
      (4, 'Deleted', 'deleted', null, true, 'published', 'gray',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000004Z',
       '2026-09-07T11:00:00Z'),
      (5, 'Parent', 'parent', null, true, 'published', 'green',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000005Z', null),
      (6, 'Child', 'child', 5, true, 'published', 'green',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000006Z', null),
      (7, 'Race Target', 'race-target', null, true, 'published', 'blue',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000007Z', null);

    insert into public.topic_series(
      id, name, slug, category_id, status, created_at, updated_at
    ) values
      (10, 'Series Primary', 'series-primary', 1, 'published',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000010Z'),
      (11, 'Series Parent', 'series-parent', 5, 'unpublished',
       '2026-09-01T00:00:00Z', '2026-09-07T10:00:00.000011Z');

    insert into public.topics(
      id, category_id, category, category_slug,
      series_id, series, series_slug, updated_at, updated_by
    ) values (
      100, 1, 'Primary', 'primary',
      10, 'Series Primary', 'series-primary',
      '2026-09-07T10:00:00.000100Z', null
    );
  `);
}

async function categorySnapshot(admin: SqlClient, id = 1) {
  const result = await admin.query<{
    name: string;
    parent_id: string | null;
    is_active: boolean;
    status: string;
    color_token: string;
    updated_at: string;
  }>(
    `select
       name,
       parent_id,
       is_active,
       status,
       color_token,
       updated_at::text as updated_at
     from public.topic_categories
     where id = $1`,
    [id],
  );
  const row = result.rows[0];
  return {
    ...row,
    parent_id: row.parent_id === null ? null : Number(row.parent_id),
  };
}

async function seriesSnapshot(admin: SqlClient, id = 10) {
  const result = await admin.query<{
    name: string;
    category_id: string;
    status: string;
    deleted_at: string | null;
    updated_at: string;
  }>(
    `select
       name,
       category_id,
       status,
       deleted_at::text as deleted_at,
       updated_at::text as updated_at
     from public.topic_series
     where id = $1`,
    [id],
  );
  const row = result.rows[0];
  return {
    ...row,
    category_id: Number(row.category_id),
  };
}

async function topicsSnapshot(admin: SqlClient) {
  const result = await admin.query<{
    id: string;
    category_id: string | null;
    category: string;
    category_slug: string;
    series_id: string | null;
    series: string | null;
    series_slug: string | null;
    updated_at: string;
    updated_by: string | null;
  }>(
    `select
       id,
       category_id,
       category,
       category_slug,
       series_id,
       series,
       series_slug,
       updated_at::text as updated_at,
       updated_by
     from public.topics
     order by id`,
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    category_id: row.category_id === null ? null : Number(row.category_id),
    series_id: row.series_id === null ? null : Number(row.series_id),
    updated_by: row.updated_by === null ? null : Number(row.updated_by),
  }));
}

async function deadlockCount(observer: SqlClient) {
  const result = await observer.query<{ deadlocks: string }>(
    `select deadlocks::text
     from pg_catalog.pg_stat_database
     where datname = pg_catalog.current_database()`,
  );
  return Number(result.rows[0]?.deadlocks ?? 0);
}

function assertLifecycleLockOrder(
  source: string,
  terminalMutationMarker: string,
  label: string,
) {
  const tableLock = source.indexOf(
    "lock table public.topic_categories in share row exclusive mode;",
  );
  const orderedRows = source.indexOf("order by categories.id", tableLock);
  const rowLock = source.indexOf("for update;", tableLock);
  const seriesDependencyCheck = source.indexOf(
    "from public.topic_series series",
    rowLock,
  );
  const terminalMutation = source.indexOf(
    terminalMutationMarker,
    seriesDependencyCheck,
  );
  assert.ok(tableLock >= 0, `${label} is missing the Category table lock`);
  assert.ok(
    orderedRows > tableLock && orderedRows < rowLock,
    `${label} must lock Category rows in ascending id order`,
  );
  assert.ok(rowLock > tableLock, `${label} must row-lock after its table lock`);
  assert.ok(
    seriesDependencyCheck > rowLock,
    `${label} must inspect Series dependencies after locking the Category row`,
  );
  assert.ok(
    terminalMutation > seriesDependencyCheck,
    `${label} must mutate only after its Series dependency check`,
  );
}

function verifyLifecycleSourceLockOrder() {
  assertLifecycleLockOrder(
    categoryTrashFunctionSql,
    "with updated as (",
    "Category trash",
  );
  assertLifecycleLockOrder(
    categoryPermanentDeleteFunctionSql,
    "with deleted as (",
    "Category permanent delete",
  );
  console.log(
    "PASS lifecycle source lock order: the executed Category trash/delete owners take the Category table lock, then ordered row locks, then inspect Series, then mutate.",
  );
}

async function verifyOldSignatureDropPreflight(admin: SqlClient) {
  const signatures = await admin.query<{
    old_category: string | null;
    old_series: string | null;
  }>(`
    select
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'
      )::text as old_category,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_series(bigint,text,bigint,text,bigint)'
      )::text as old_series
  `);
  assert.match(
    signatures.rows[0].old_category ?? "",
    /admin_update_topic_category\(bigint,text,bigint,boolean,text,bigint\)$/u,
  );
  assert.match(
    signatures.rows[0].old_series ?? "",
    /admin_update_topic_series\(bigint,text,bigint,text,bigint\)$/u,
  );

  // Put a real catalog dependent on the second retired signature. The first
  // DROP executes before PostgreSQL reaches this dependency, so a RESTRICT
  // failure also proves that the migration transaction restores that first
  // signature and leaves no partially-created P1-E objects behind.
  await admin.query(`
    create view public.p1_e_old_series_dependency_probe as
    select public.admin_update_topic_series(
      10::bigint,
      'dependency probe'::text,
      1::bigint,
      'published'::text,
      1::bigint
    ) as payload
  `);

  let restrictError: (Error & { code?: string }) | undefined;
  try {
    await admin.query(migration);
  } catch (error) {
    restrictError = error as Error & { code?: string };
  }
  await admin.query("rollback");
  assert.ok(restrictError, "the dependent old signature must stop the migration");
  assert.equal(restrictError.code, "2BP01");

  const rollbackState = await admin.query<{
    old_category: string | null;
    old_series: string | null;
    new_category: string | null;
    new_series: string | null;
    create_series: string | null;
    dependency_probe: string | null;
    trigger_count: number;
  }>(`
    select
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'
      )::text as old_category,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_series(bigint,text,bigint,text,bigint)'
      )::text as old_series,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint,timestamp with time zone)'
      )::text as new_category,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_series(bigint,text,bigint,text,bigint,timestamp with time zone)'
      )::text as new_series,
      pg_catalog.to_regprocedure(
        'public.admin_create_topic_series(text,text,bigint,text,bigint)'
      )::text as create_series,
      pg_catalog.to_regclass('public.p1_e_old_series_dependency_probe')::text
        as dependency_probe,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_trigger as trigger
        where trigger.tgrelid = 'public.topic_series'::pg_catalog.regclass
          and not trigger.tgisinternal
      ) as trigger_count
  `);
  assert.match(
    rollbackState.rows[0].old_category ?? "",
    /admin_update_topic_category\(bigint,text,bigint,boolean,text,bigint\)$/u,
  );
  assert.match(
    rollbackState.rows[0].old_series ?? "",
    /admin_update_topic_series\(bigint,text,bigint,text,bigint\)$/u,
  );
  assert.deepEqual(
    {
      new_category: rollbackState.rows[0].new_category,
      new_series: rollbackState.rows[0].new_series,
      create_series: rollbackState.rows[0].create_series,
      dependency_probe: rollbackState.rows[0].dependency_probe,
      trigger_count: rollbackState.rows[0].trigger_count,
    },
    {
      new_category: null,
      new_series: null,
      create_series: null,
      dependency_probe: "p1_e_old_series_dependency_probe",
      trigger_count: 0,
    },
  );

  await admin.query(
    "drop view public.p1_e_old_series_dependency_probe restrict",
  );

  const dependents = await admin.query<{
    referenced_function: string;
    dependent_object: string;
    dependency_type: string;
  }>(`
    with old_functions(oid) as (
      values
        (
          'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'
            ::pg_catalog.regprocedure::oid
        ),
        (
          'public.admin_update_topic_series(bigint,text,bigint,text,bigint)'
            ::pg_catalog.regprocedure::oid
        )
    )
    select
      dependency.refobjid::pg_catalog.regprocedure::text as referenced_function,
      pg_catalog.pg_describe_object(
        dependency.classid,
        dependency.objid,
        dependency.objsubid
      ) as dependent_object,
      dependency.deptype::text as dependency_type
    from pg_catalog.pg_depend as dependency
    join old_functions on old_functions.oid = dependency.refobjid
    where dependency.refclassid = 'pg_catalog.pg_proc'::pg_catalog.regclass
      and dependency.deptype not in ('e', 'i')
    order by referenced_function, dependent_object
  `);
  assert.deepEqual(
    dependents.rows,
    [],
    "DROP FUNCTION ... RESTRICT preflight requires no non-extension/internal dependents",
  );

  console.log(
    "PASS DROP RESTRICT preflight: an intentional dependent blocked the second DROP, the transaction restored the first signature with zero partial P1-E objects, and both retired signatures then had zero non-extension/internal dependents.",
  );
}

async function verifyCatalogAndAcl(admin: SqlClient) {
  const functions = await admin.query<{
    name: string;
    signature: string;
    identity_args: string;
    provolatile: string;
    prosecdef: boolean;
    proconfig: string[] | null;
  }>(`
    select
      procedure.proname as name,
      procedure.oid::pg_catalog.regprocedure::text as signature,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_args,
      procedure.provolatile::text,
      procedure.prosecdef,
      procedure.proconfig
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'admin_update_topic_category',
        'admin_update_topic_series',
        'admin_create_topic_series',
        'enforce_topic_series_category_eligibility'
      )
    order by procedure.proname
  `);

  assert.equal(functions.rows.length, 4, "each RPC/trigger function must have one overload");
  assert.deepEqual(
    functions.rows.map((row) => row.name),
    [
      "admin_create_topic_series",
      "admin_update_topic_category",
      "admin_update_topic_series",
      "enforce_topic_series_category_eligibility",
    ],
  );
  for (const row of functions.rows) {
    assert.equal(row.provolatile, "v");
    assert.equal(row.prosecdef, false);
    assert.deepEqual(row.proconfig, ['search_path=""']);
  }
  assert.match(
    functions.rows.find((row) => row.name === "admin_update_topic_category")!
      .identity_args,
    /p_expected_updated_at timestamp with time zone$/u,
  );
  assert.match(
    functions.rows.find((row) => row.name === "admin_update_topic_series")!
      .identity_args,
    /p_expected_updated_at timestamp with time zone$/u,
  );

  const oldSignatures = await admin.query<{
    old_category: string | null;
    old_series: string | null;
  }>(`
    select
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'
      )::text as old_category,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_series(bigint,text,bigint,text,bigint)'
      )::text as old_series
  `);
  assert.deepEqual(oldSignatures.rows[0], {
    old_category: null,
    old_series: null,
  });

  for (const [signature, serviceExecute] of [
    [
      "public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint,timestamp with time zone)",
      true,
    ],
    [
      "public.admin_update_topic_series(bigint,text,bigint,text,bigint,timestamp with time zone)",
      true,
    ],
    [
      "public.admin_create_topic_series(text,text,bigint,text,bigint)",
      true,
    ],
    ["public.enforce_topic_series_category_eligibility()", false],
  ] as const) {
    const acl = await admin.query<{
      postgres_execute: boolean;
      service_execute: boolean;
      anon_execute: boolean;
      authenticated_execute: boolean;
    }>(
      `select
         pg_catalog.has_function_privilege('postgres', $1, 'execute') as postgres_execute,
         pg_catalog.has_function_privilege('service_role', $1, 'execute') as service_execute,
         pg_catalog.has_function_privilege('anon', $1, 'execute') as anon_execute,
         pg_catalog.has_function_privilege('authenticated', $1, 'execute') as authenticated_execute`,
      [signature],
    );
    assert.deepEqual(acl.rows[0], {
      postgres_execute: true,
      service_execute: serviceExecute,
      anon_execute: false,
      authenticated_execute: false,
    });
  }

  const triggers = await admin.query<{ definition: string }>(`
    select pg_catalog.pg_get_triggerdef(trigger.oid, true) as definition
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'public.topic_series'::pg_catalog.regclass
      and not trigger.tgisinternal
    order by trigger.tgname
  `);
  assert.equal(triggers.rows.length, 2);
  assert.match(triggers.rows[0].definition, /BEFORE INSERT ON topic_series/u);
  assert.match(
    triggers.rows[1].definition,
    /BEFORE UPDATE OF category_id ON topic_series/u,
  );
  assert.match(
    triggers.rows[1].definition,
    /WHEN \(old\.category_id IS DISTINCT FROM new\.category_id\)/u,
  );

  for (const role of ["anon", "authenticated"] as const) {
    const denied = await createClient(`denied-${role}`);
    try {
      await denied.query(`set role ${role}`);
      let caught: (Error & { code?: string }) | undefined;
      try {
        await denied.query(
          `select public.admin_create_topic_series(
             'Denied', 'denied', 1, 'published', 1
           )`,
        );
      } catch (error) {
        caught = error as Error & { code?: string };
      } finally {
        await denied.query("reset role");
      }
      assert.ok(caught, `${role} must be denied RPC execution`);
      assert.equal(caught.code, "42501");
    } finally {
      await closeClient(denied);
    }
  }

  console.log(
    "PASS PostgreSQL catalog/ACL: exact non-overloaded SECURITY INVOKER signatures, empty search_path, service_role-only RPC execution, and insert/reassignment-only triggers.",
  );
}

async function verifyExpectedRevisionContracts(admin: SqlClient) {
  await resetFixtures(admin);
  const categoryFresh = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       1, 'Primary Renamed', 5, true, 'red', 1,
       '2026-09-07T10:00:00.000001Z'::timestamptz
     ) as payload`,
  );
  assert.equal(categoryFresh.rows[0].payload.ok, true);
  assert.deepEqual(
    {
      code: categoryFresh.rows[0].payload.code,
      name: (categoryFresh.rows[0].payload as CategorySuccess).category.name,
      parentId: (categoryFresh.rows[0].payload as CategorySuccess).category.parent_id,
      topicsUpdated: (categoryFresh.rows[0].payload as CategorySuccess).topics_updated,
    },
    {
      code: "updated",
      name: "Primary Renamed",
      parentId: 5,
      topicsUpdated: 1,
    },
  );
  const categoryTopic = await admin.query<{
    category: string;
    category_slug: string;
    updated_by: string;
  }>(`select category, category_slug, updated_by from public.topics where id = 100`);
  assert.deepEqual(
    {
      ...categoryTopic.rows[0],
      updated_by: Number(categoryTopic.rows[0].updated_by),
    },
    {
      category: "Primary Renamed",
      category_slug: "primary",
      updated_by: 1,
    },
  );
  const firstCategoryRevision = (
    categoryFresh.rows[0].payload as CategorySuccess
  ).category.updated_at;
  const categorySecondSave = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       1, 'Primary Saved Again', 5, true, 'red', 1, $1::timestamptz
     ) as payload`,
    [firstCategoryRevision],
  );
  assert.equal(categorySecondSave.rows[0].payload.ok, true);
  const secondCategoryRevision = (
    categorySecondSave.rows[0].payload as CategorySuccess
  ).category.updated_at;
  const categoryRevisionOrder = await admin.query<{ advanced: boolean }>(
    "select $1::timestamptz < $2::timestamptz as advanced",
    [firstCategoryRevision, secondCategoryRevision],
  );
  assert.equal(categoryRevisionOrder.rows[0].advanced, true);

  await resetFixtures(admin);
  const categoryBefore = await categorySnapshot(admin);
  const categoryTopicsBefore = await topicsSnapshot(admin);
  const categoryStale = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       1, 'Must Not Persist', null, false, 'red', 1,
       '2026-09-07T09:59:59Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(categoryStale.rows[0].payload, {
    ok: false,
    code: "revision_conflict",
  });
  assert.deepEqual(await categorySnapshot(admin), categoryBefore);
  assert.deepEqual(await topicsSnapshot(admin), categoryTopicsBefore);

  const categoryMissing = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       1, 'Must Not Persist', null, true, 'red', 1, null
     ) as payload`,
  );
  assert.deepEqual(categoryMissing.rows[0].payload, {
    ok: false,
    code: "invalid_input",
  });
  assert.deepEqual(await categorySnapshot(admin), categoryBefore);
  assert.deepEqual(await topicsSnapshot(admin), categoryTopicsBefore);

  const parentUnavailable = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       1, 'Must Not Persist', 4, true, 'red', 1,
       '2026-09-07T10:00:00.000001Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(parentUnavailable.rows[0].payload, {
    ok: false,
    code: "parent_unavailable",
  });
  assert.deepEqual(await categorySnapshot(admin), categoryBefore);
  assert.deepEqual(await topicsSnapshot(admin), categoryTopicsBefore);

  const hierarchyCycle = await asServiceRole<{ payload: CategoryResult }>(
    admin,
    `select public.admin_update_topic_category(
       5, 'Parent', 6, true, 'green', 1,
       '2026-09-07T10:00:00.000005Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(hierarchyCycle.rows[0].payload, {
    ok: false,
    code: "hierarchy_cycle",
  });
  assert.deepEqual(await topicsSnapshot(admin), categoryTopicsBefore);

  await resetFixtures(admin);
  const seriesFresh = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Series Renamed', 5, 'unpublished', 1,
       '2026-09-07T10:00:00.000010Z'::timestamptz
     ) as payload`,
  );
  assert.equal(seriesFresh.rows[0].payload.ok, true);
  assert.deepEqual(
    {
      code: seriesFresh.rows[0].payload.code,
      name: (seriesFresh.rows[0].payload as SeriesSuccess).series.name,
      categoryId: (seriesFresh.rows[0].payload as SeriesSuccess).series.category_id,
      topicsUpdated: (seriesFresh.rows[0].payload as SeriesSuccess).topics_updated,
    },
    {
      code: "updated",
      name: "Series Renamed",
      categoryId: 5,
      topicsUpdated: 1,
    },
  );
  const seriesTopic = await admin.query<{
    series: string;
    series_slug: string;
    updated_by: string;
  }>(`select series, series_slug, updated_by from public.topics where id = 100`);
  assert.deepEqual(
    {
      ...seriesTopic.rows[0],
      updated_by: Number(seriesTopic.rows[0].updated_by),
    },
    {
      series: "Series Renamed",
      series_slug: "series-primary",
      updated_by: 1,
    },
  );
  const firstSeriesRevision = (
    seriesFresh.rows[0].payload as SeriesSuccess
  ).series.updated_at;
  const seriesSecondSave = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Series Saved Again', 5, 'unpublished', 1, $1::timestamptz
     ) as payload`,
    [firstSeriesRevision],
  );
  assert.equal(seriesSecondSave.rows[0].payload.ok, true);
  const secondSeriesRevision = (
    seriesSecondSave.rows[0].payload as SeriesSuccess
  ).series.updated_at;
  const seriesRevisionOrder = await admin.query<{ advanced: boolean }>(
    "select $1::timestamptz < $2::timestamptz as advanced",
    [firstSeriesRevision, secondSeriesRevision],
  );
  assert.equal(seriesRevisionOrder.rows[0].advanced, true);

  await resetFixtures(admin);
  const seriesBefore = await seriesSnapshot(admin);
  const seriesTopicsBefore = await topicsSnapshot(admin);
  const seriesStale = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Must Not Persist', 1, 'unpublished', 1,
       '2026-09-07T09:59:59Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(seriesStale.rows[0].payload, {
    ok: false,
    code: "revision_conflict",
  });
  assert.deepEqual(await seriesSnapshot(admin), seriesBefore);
  assert.deepEqual(await topicsSnapshot(admin), seriesTopicsBefore);

  const seriesMissing = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Must Not Persist', 1, 'unpublished', 1, null
     ) as payload`,
  );
  assert.deepEqual(seriesMissing.rows[0].payload, {
    ok: false,
    code: "invalid_input",
  });
  assert.deepEqual(await seriesSnapshot(admin), seriesBefore);
  assert.deepEqual(await topicsSnapshot(admin), seriesTopicsBefore);

  const seriesUnsupportedStatus = await asServiceRole<{
    payload: SeriesResult;
  }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Must Not Persist', 1, 'archived', 1,
       '2026-09-07T10:00:00.000010Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(seriesUnsupportedStatus.rows[0].payload, {
    ok: false,
    code: "invalid_input",
  });
  assert.deepEqual(await seriesSnapshot(admin), seriesBefore);
  assert.deepEqual(await topicsSnapshot(admin), seriesTopicsBefore);

  const categoryUnavailable = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Must Not Persist', 2, 'unpublished', 1,
       '2026-09-07T10:00:00.000010Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(categoryUnavailable.rows[0].payload, {
    ok: false,
    code: "category_unavailable",
  });
  assert.deepEqual(await seriesSnapshot(admin), seriesBefore);
  assert.deepEqual(await topicsSnapshot(admin), seriesTopicsBefore);

  console.log(
    "PASS Expected Revision: Category and Series fresh writes are atomic and monotonic; stale/missing revisions and invalid relationships return stable non-mutating results.",
  );
}

async function expectSqlState(
  operation: () => Promise<unknown>,
  code: string,
  messagePattern: RegExp,
) {
  let caught: (Error & { code?: string }) | undefined;
  try {
    await operation();
  } catch (error) {
    caught = error as Error & { code?: string };
  }
  assert.ok(caught, `expected SQLSTATE ${code}`);
  assert.equal(caught.code, code);
  assert.match(caught.message, messagePattern);
}

async function verifyCreateAndTriggerInvariant(admin: SqlClient) {
  await resetFixtures(admin);
  const created = await asServiceRole<{ payload: CreateSeriesResult }>(
    admin,
    `select public.admin_create_topic_series(
       'Created Series', 'created-series', 1, 'published', 1
     ) as payload`,
  );
  assert.equal(created.rows[0].payload.ok, true);
  assert.deepEqual(
    {
      code: created.rows[0].payload.code,
      name: (created.rows[0].payload as CreateSeriesSuccess).series.name,
      categoryId: (created.rows[0].payload as CreateSeriesSuccess).series.category_id,
      status: (created.rows[0].payload as CreateSeriesSuccess).series.status,
    },
    {
      code: "created",
      name: "Created Series",
      categoryId: 1,
      status: "published",
    },
  );

  for (const [categoryId, slug] of [
    [999, "missing-category"],
    [2, "inactive-category"],
    [3, "unpublished-category"],
    [4, "deleted-category"],
  ] as const) {
    const result = await asServiceRole<{ payload: CreateSeriesResult }>(
      admin,
      `select public.admin_create_topic_series(
         'Rejected Series', $1, $2, 'published', 1
       ) as payload`,
      [slug, categoryId],
    );
    assert.deepEqual(result.rows[0].payload, {
      ok: false,
      code: "category_unavailable",
    });
  }
  const rejectedCount = await admin.query<{ count: string }>(
    `select count(*)::text as count
     from public.topic_series
     where slug in (
       'missing-category', 'inactive-category',
       'unpublished-category', 'deleted-category'
     )`,
  );
  assert.equal(Number(rejectedCount.rows[0].count), 0);

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `insert into public.topic_series(name, slug, category_id, status)
         values ('Bypass', 'direct-bypass', 2, 'published')`,
      ),
    "23503",
    /topic_series_category_unavailable/u,
  );

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `update public.topic_series set category_id = 3 where id = 10`,
      ),
    "23503",
    /topic_series_category_unavailable/u,
  );
  assert.equal((await seriesSnapshot(admin)).category_id, 1);

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `select public.admin_create_topic_series(
           'Duplicate', 'created-series', 1, 'published', 1
         )`,
      ),
    "23505",
    /topic_series_slug_key/u,
  );

  await admin.query(`
    update public.topic_categories
    set is_active = false,
        status = 'unpublished'
    where id = 1
  `);
  await asServiceRole(
    admin,
    `update public.topic_series as series
     set name = 'Existing Series Still Editable',
         category_id = series.category_id,
         updated_at = pg_catalog.clock_timestamp()
     where series.id = 10`,
  );
  const sameCategoryEdit = await seriesSnapshot(admin);
  assert.equal(sameCategoryEdit.name, "Existing Series Still Editable");
  assert.equal(sameCategoryEdit.category_id, 1);

  console.log(
    "PASS Series Create Invariant: eligible create succeeds; missing/deleted/inactive/unpublished Categories fail without rows; direct insert/reassignment bypasses fail; a same-Category field edit remains allowed without firing the reassignment guard; slug uniqueness remains authoritative.",
  );
}

async function verifyCategoryRevisionRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const writerA = await createClient("category-writer-a");
  const writerB = await createClient("category-writer-b");
  try {
    await beginServiceRoleTransaction(writerA);
    await beginServiceRoleTransaction(writerB);
    const pidA = await backendPid(writerA);
    const pidB = await backendPid(writerB);

    const first = await callCategory(writerA, {
      id: 1,
      name: "Category Writer A",
      parentId: null,
      isActive: true,
      colorToken: "blue",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000001Z",
    });
    assert.equal(first.ok, true);

    let settled = false;
    const secondPromise = callCategory(writerB, {
      id: 1,
      name: "Category Writer B",
      parentId: null,
      isActive: true,
      colorToken: "blue",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000001Z",
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: pidB,
      expectedBlockerPid: pidA,
      label: "Category stale writer",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await writerA.query("commit");
    const second = await secondPromise;
    assert.deepEqual(second, { ok: false, code: "revision_conflict" });
    await writerB.query("commit");

    assert.equal((await categorySnapshot(admin)).name, "Category Writer A");
  } finally {
    await safeRollback(writerA);
    await safeRollback(writerB);
    await closeClient(writerA);
    await closeClient(writerB);
  }
}

async function verifySeriesRevisionRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const writerA = await createClient("series-writer-a");
  const writerB = await createClient("series-writer-b");
  try {
    await beginServiceRoleTransaction(writerA);
    await beginServiceRoleTransaction(writerB);
    const pidA = await backendPid(writerA);
    const pidB = await backendPid(writerB);

    const first = await callSeries(writerA, {
      id: 10,
      name: "Series Writer A",
      categoryId: 1,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000010Z",
    });
    assert.equal(first.ok, true);

    let settled = false;
    const secondPromise = callSeries(writerB, {
      id: 10,
      name: "Series Writer B",
      categoryId: 1,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000010Z",
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: pidB,
      expectedBlockerPid: pidA,
      label: "Series stale writer",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await writerA.query("commit");
    const second = await secondPromise;
    assert.deepEqual(second, { ok: false, code: "revision_conflict" });
    await writerB.query("commit");

    assert.equal((await seriesSnapshot(admin)).name, "Series Writer A");
  } finally {
    await safeRollback(writerA);
    await safeRollback(writerB);
    await closeClient(writerA);
    await closeClient(writerB);
  }
}

async function verifyCategoryTransitionCreateRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const categoryWriter = await createClient("category-transition");
  const seriesCreator = await createClient("series-create");
  try {
    await beginServiceRoleTransaction(categoryWriter);
    await beginServiceRoleTransaction(seriesCreator);
    const categoryPid = await backendPid(categoryWriter);
    const creatorPid = await backendPid(seriesCreator);

    await categoryWriter.query(
      `update public.topic_categories
       set is_active = false,
           status = 'unpublished',
           updated_at = pg_catalog.statement_timestamp()
       where id = 1`,
    );

    let settled = false;
    const createPromise = callCreateSeries(seriesCreator, {
      name: "Racing Series",
      slug: "racing-series",
      categoryId: 1,
      status: "published",
      actorId: 1,
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: creatorPid,
      expectedBlockerPid: categoryPid,
      label: "Series create behind Category transition",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await categoryWriter.query("commit");
    const result = await createPromise;
    assert.deepEqual(result, { ok: false, code: "category_unavailable" });
    await seriesCreator.query("commit");

    const rows = await admin.query<{ count: string }>(
      `select count(*)::text as count
       from public.topic_series
       where slug = 'racing-series'`,
    );
    assert.equal(Number(rows.rows[0].count), 0);
  } finally {
    await safeRollback(categoryWriter);
    await safeRollback(seriesCreator);
    await closeClient(categoryWriter);
    await closeClient(seriesCreator);
  }
}

async function verifyCategoryTrashCreateRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const lifecycleWriter = await createClient("category-trash");
  const seriesCreator = await createClient("create-behind-trash");
  try {
    await beginServiceRoleTransaction(lifecycleWriter);
    await beginServiceRoleTransaction(seriesCreator);
    const lifecyclePid = await backendPid(lifecycleWriter);
    const creatorPid = await backendPid(seriesCreator);

    assert.deepEqual(await callCategoryTrash(lifecycleWriter, 7), {
      affected_ids: [7],
      affected_count: 1,
    });

    let settled = false;
    const createPromise = callCreateSeries(seriesCreator, {
      name: "Create Behind Trash",
      slug: "create-behind-trash",
      categoryId: 7,
      status: "published",
      actorId: 1,
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: creatorPid,
      expectedBlockerPid: lifecyclePid,
      label: "Series create behind Category trash",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await lifecycleWriter.query("commit");
    const createResult = await createPromise;
    assert.deepEqual(createResult, {
      ok: false,
      code: "category_unavailable",
    });
    await seriesCreator.query("commit");

    const persisted = await admin.query<{
      category_deleted: boolean;
      series_count: string;
    }>(`
      select
        (
          select deleted_at is not null
          from public.topic_categories
          where id = 7
        ) as category_deleted,
        (
          select count(*)
          from public.topic_series
          where slug = 'create-behind-trash'
        )::text as series_count
    `);
    assert.deepEqual(persisted.rows[0], {
      category_deleted: true,
      series_count: "0",
    });
  } finally {
    await safeRollback(lifecycleWriter);
    await safeRollback(seriesCreator);
    await closeClient(lifecycleWriter);
    await closeClient(seriesCreator);
  }
}

async function verifyCategoryPermanentDeleteCreateRace(
  admin: SqlClient,
) {
  await resetFixtures(admin);
  const lifecycleWriter = await createClient("category-permanent-delete");
  const seriesCreator = await createClient("create-behind-permanent-delete");
  try {
    await beginServiceRoleTransaction(lifecycleWriter);
    await beginServiceRoleTransaction(seriesCreator);

    assert.deepEqual(await callCategoryPermanentDelete(lifecycleWriter, 4), {
      affected_ids: [4],
      affected_count: 1,
    });

    const createPromise = callCreateSeries(seriesCreator, {
      name: "Create Behind Permanent Delete",
      slug: "create-behind-permanent-delete",
      categoryId: 4,
      status: "published",
      actorId: 1,
    });
    const createResult = await createPromise;
    assert.deepEqual(createResult, {
      ok: false,
      code: "category_unavailable",
    });
    await seriesCreator.query("commit");
    await lifecycleWriter.query("commit");

    const persisted = await admin.query<{
      category_count: string;
      series_count: string;
    }>(`
      select
        (select count(*) from public.topic_categories where id = 4)::text
          as category_count,
        (
          select count(*)
          from public.topic_series
          where slug = 'create-behind-permanent-delete'
        )::text as series_count
    `);
    assert.deepEqual(persisted.rows[0], {
      category_count: "0",
      series_count: "0",
    });
  } finally {
    await safeRollback(lifecycleWriter);
    await safeRollback(seriesCreator);
    await closeClient(lifecycleWriter);
    await closeClient(seriesCreator);
  }
}

async function verifyCategoryUpdateSeriesReassignmentRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const seriesBefore = await seriesSnapshot(admin, 10);
  const categoryWriter = await createClient("category-update");
  const seriesWriter = await createClient("reassign-behind-category-update");
  try {
    await beginServiceRoleTransaction(categoryWriter);
    await beginServiceRoleTransaction(seriesWriter);
    const categoryPid = await backendPid(categoryWriter);
    const seriesPid = await backendPid(seriesWriter);

    const categoryUpdate = await callCategory(categoryWriter, {
      id: 7,
      name: "Race Target Closing",
      parentId: null,
      isActive: false,
      colorToken: "blue",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000007Z",
    });
    assert.equal(categoryUpdate.ok, true);

    let settled = false;
    const reassignmentPromise = callSeries(seriesWriter, {
      id: 10,
      name: "Must Not Reassign",
      categoryId: 7,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000010Z",
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: seriesPid,
      expectedBlockerPid: categoryPid,
      label: "Series reassignment behind Category update",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await categoryWriter.query("commit");
    const reassignmentResult = await reassignmentPromise;
    assert.deepEqual(reassignmentResult, {
      ok: false,
      code: "category_unavailable",
    });
    await seriesWriter.query("commit");

    assert.deepEqual(await seriesSnapshot(admin, 10), seriesBefore);
    const category = await admin.query<{
      is_active: boolean;
      status: string;
      deleted: boolean;
    }>(`
      select
        is_active,
        status,
        deleted_at is not null as deleted
      from public.topic_categories
      where id = 7
    `);
    assert.deepEqual(category.rows[0], {
      is_active: false,
      status: "unpublished",
      deleted: false,
    });
  } finally {
    await safeRollback(categoryWriter);
    await safeRollback(seriesWriter);
    await closeClient(categoryWriter);
    await closeClient(seriesWriter);
  }
}

async function verifyDirectInsertTriggerRecheckRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const categoryWriter = await createClient("trigger-insert-category-update");
  const seriesWriter = await createClient("trigger-direct-insert");
  try {
    await beginServiceRoleTransaction(categoryWriter);
    await beginServiceRoleTransaction(seriesWriter);
    const categoryPid = await backendPid(categoryWriter);
    const seriesPid = await backendPid(seriesWriter);

    // A direct non-key Category update does not conflict with the FK's implicit
    // KEY SHARE lock. Waiting here therefore isolates the trigger's FOR SHARE.
    await categoryWriter.query(`
      update public.topic_categories
      set is_active = false,
          status = 'unpublished',
          updated_at = pg_catalog.clock_timestamp()
      where id = 7
    `);

    let settled = false;
    const insertPromise = seriesWriter
      .query(
        `insert into public.topic_series(name, slug, category_id, status)
         values ('Direct Trigger Insert', 'direct-trigger-insert', 7, 'published')`,
      )
      .then(() => undefined)
      .catch((error: Error & { code?: string }) => error)
      .finally(() => {
        settled = true;
      });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: seriesPid,
      expectedBlockerPid: categoryPid,
      label: "direct Series insert trigger behind Category transition",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await categoryWriter.query("commit");
    const insertError = await insertPromise;
    assert.ok(insertError, "the direct insert must be rejected after recheck");
    assert.equal(insertError.code, "23503");
    assert.match(insertError.message, /topic_series_category_unavailable/u);
    await safeRollback(seriesWriter);

    const rows = await admin.query<{ count: string }>(
      `select count(*)::text as count
       from public.topic_series
       where slug = 'direct-trigger-insert'`,
    );
    assert.equal(Number(rows.rows[0].count), 0);
  } finally {
    await safeRollback(categoryWriter);
    await safeRollback(seriesWriter);
    await closeClient(categoryWriter);
    await closeClient(seriesWriter);
  }
}

async function verifyDirectReassignmentTriggerRecheckRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const seriesBefore = await seriesSnapshot(admin, 10);
  const topicsBefore = await topicsSnapshot(admin);
  const categoryWriter = await createClient("trigger-reassign-category-update");
  const seriesWriter = await createClient("trigger-direct-reassignment");
  try {
    await beginServiceRoleTransaction(categoryWriter);
    await beginServiceRoleTransaction(seriesWriter);
    const categoryPid = await backendPid(categoryWriter);
    const seriesPid = await backendPid(seriesWriter);

    await categoryWriter.query(`
      update public.topic_categories
      set is_active = false,
          status = 'unpublished',
          updated_at = pg_catalog.clock_timestamp()
      where id = 7
    `);

    let settled = false;
    const reassignmentPromise = seriesWriter
      .query(
        `update public.topic_series
         set category_id = 7,
             updated_at = pg_catalog.clock_timestamp()
         where id = 10`,
      )
      .then(() => undefined)
      .catch((error: Error & { code?: string }) => error)
      .finally(() => {
        settled = true;
      });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: seriesPid,
      expectedBlockerPid: categoryPid,
      label: "direct Series reassignment trigger behind Category transition",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await categoryWriter.query("commit");
    const reassignmentError = await reassignmentPromise;
    assert.ok(
      reassignmentError,
      "the direct reassignment must be rejected after recheck",
    );
    assert.equal(reassignmentError.code, "23503");
    assert.match(
      reassignmentError.message,
      /topic_series_category_unavailable/u,
    );
    await safeRollback(seriesWriter);

    assert.deepEqual(await seriesSnapshot(admin, 10), seriesBefore);
    assert.deepEqual(await topicsSnapshot(admin), topicsBefore);
  } finally {
    await safeRollback(categoryWriter);
    await safeRollback(seriesWriter);
    await closeClient(categoryWriter);
    await closeClient(seriesWriter);
  }
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function roleToken(role: "authenticated" | "service_role") {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      role,
      iat: Math.floor(Date.now() / 1_000) - 5,
      exp: Math.floor(Date.now() / 1_000) + 600,
    }),
  );
  const signature = createHmac("sha256", jwtSecret!)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function restRpc(
  name: string,
  body: Record<string, unknown>,
  role: "anon" | "authenticated" | "service_role" = "service_role",
) {
  const endpoint = new URL(`/rpc/${name}`, restUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (role !== "anon") {
    headers.Authorization = `Bearer ${roleToken(role)}`;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: unknown = raw;
  try {
    parsed = raw === "" ? null : JSON.parse(raw);
  } catch {
    // Preserve the raw response for a useful assertion failure.
  }
  return { status: response.status, body: parsed, raw } satisfies RestResult;
}

async function waitForPostgrestResolution(admin: SqlClient) {
  const deadline = Date.now() + 20_000;
  let last: RestResult | undefined;
  while (Date.now() < deadline) {
    try {
      last = await restRpc("admin_update_topic_category", {
        p_category_id: 0,
        p_name: "",
        p_parent_id: null,
        p_is_active: true,
        p_color_token: null,
        p_actor_id: 0,
        p_expected_updated_at: "2026-09-07T00:00:00Z",
      });
      if (
        last.status === 200 &&
        (last.body as MutationFailure | null)?.code === "invalid_input"
      ) {
        return;
      }
    } catch {
      // The isolated service can still be retrying its initial DB connection.
    }

    await admin.query("select pg_catalog.pg_notify('pgrst', 'reload schema')");
    await delay(250);
  }

  throw new Error(
    `PostgREST never resolved the new exact RPC signature: ${JSON.stringify(last)}`,
  );
}

async function verifyPostgrestResolution(admin: SqlClient) {
  await waitForPostgrestResolution(admin);
  await resetFixtures(admin);

  for (const role of ["anon", "authenticated"] as const) {
    const denied = await restRpc(
      "admin_create_topic_series",
      {
        p_name: "REST Denied",
        p_slug: `rest-denied-${role}`,
        p_category_id: 1,
        p_status: "published",
        p_actor_id: 1,
      },
      role,
    );
    assert.ok(
      denied.status === 401 || denied.status === 403,
      `${role} HTTP status was ${denied.status}: ${denied.raw}`,
    );
    assert.equal(
      (denied.body as { code?: string }).code,
      "42501",
      denied.raw,
    );
  }
  const deniedRows = await admin.query<{ count: string }>(
    `select count(*)::text as count
     from public.topic_series
     where slug like 'rest-denied-%'`,
  );
  assert.equal(Number(deniedRows.rows[0].count), 0);

  const category = await restRpc("admin_update_topic_category", {
    p_category_id: 1,
    p_name: "REST Category",
    p_parent_id: null,
    p_is_active: true,
    p_color_token: "blue",
    p_actor_id: 1,
    p_expected_updated_at: "2026-09-07T10:00:00.000001Z",
  });
  assert.equal(category.status, 200, category.raw);
  assert.equal((category.body as CategoryResult).ok, true);
  assert.equal(
    ((category.body as CategorySuccess).category).name,
    "REST Category",
  );

  const series = await restRpc("admin_update_topic_series", {
    p_series_id: 10,
    p_name: "REST Series",
    p_category_id: 1,
    p_status: "unpublished",
    p_actor_id: 1,
    p_expected_updated_at: "2026-09-07T10:00:00.000010Z",
  });
  assert.equal(series.status, 200, series.raw);
  assert.equal((series.body as SeriesResult).ok, true);
  assert.equal((series.body as SeriesSuccess).series.name, "REST Series");

  const created = await restRpc("admin_create_topic_series", {
    p_name: "REST Created",
    p_slug: "rest-created",
    p_category_id: 1,
    p_status: "published",
    p_actor_id: 1,
  });
  assert.equal(created.status, 200, created.raw);
  assert.equal((created.body as CreateSeriesResult).ok, true);
  assert.equal(
    (created.body as CreateSeriesSuccess).series.slug,
    "rest-created",
  );

  const beforeMissingRevision = await categorySnapshot(admin, 5);
  const missingRevision = await restRpc("admin_update_topic_category", {
    p_category_id: 5,
    p_name: "Old Overload Must Not Resolve",
    p_parent_id: null,
    p_is_active: true,
    p_color_token: "green",
    p_actor_id: 1,
  });
  assert.equal(missingRevision.status, 404, missingRevision.raw);
  assert.equal(
    (missingRevision.body as { code?: string }).code,
    "PGRST202",
    missingRevision.raw,
  );
  assert.deepEqual(await categorySnapshot(admin, 5), beforeMissingRevision);

  console.log(
    "PASS PostgREST: PUBLIC/anon and authenticated HTTP execution were denied, service_role resolution succeeded for both guarded updates and atomic Series create, and the retired missing-revision shape returned PGRST202 without mutation.",
  );
}

const admin = await createClient("fixture-admin");
const listener = await createClient("schema-cache-listener");
const observer = await createClient("lock-observer");

try {
  const identity = (
    await admin.query<{
      database_name: string;
      user_name: string;
      version_num: string;
    }>(`
      select
        pg_catalog.current_database() as database_name,
        current_user as user_name,
        pg_catalog.current_setting('server_version_num') as version_num
    `)
  ).rows[0];
  assert.equal(identity.database_name, databaseName);
  assert.equal(identity.user_name, "postgres");
  assert.equal(
    Math.floor(Number(identity.version_num) / 10_000),
    17,
    `PostgreSQL 17 is required; received ${identity.version_num}`,
  );

  const existingObjects = (
    await admin.query<{ tables: number; taxonomy_functions: number }>(`
      select
        (
          select pg_catalog.count(*)::integer
          from pg_catalog.pg_tables
          where schemaname = 'public'
        ) as tables,
        (
          select pg_catalog.count(*)::integer
          from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          where namespace.nspname = 'public'
            and procedure.proname in (
              'admin_update_topic_category',
              'admin_update_topic_series',
              'admin_create_topic_series',
              'enforce_topic_series_category_eligibility'
            )
        ) as taxonomy_functions
    `)
  ).rows[0];
  assert.deepEqual(
    existingObjects,
    { tables: 0, taxonomy_functions: 0 },
    "the proof refuses a non-empty or previously migrated public fixture",
  );

  await admin.query(`
    do $roles$
    begin
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
        execute 'create role anon nologin noinherit nobypassrls';
      end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
        execute 'create role authenticated nologin noinherit nobypassrls';
      end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
        execute 'create role service_role nologin noinherit bypassrls';
      end if;
    end;
    $roles$;

    create table public.admin_users (
      id bigint primary key,
      username text not null unique,
      is_active boolean not null,
      updated_at timestamptz not null default pg_catalog.now()
    );

    create table public.topic_categories (
      id bigint generated by default as identity primary key,
      name text not null,
      slug text not null unique,
      parent_id bigint references public.topic_categories(id),
      is_active boolean not null default true,
      status text not null check (status in ('published', 'unpublished')),
      color_token text not null default 'gray',
      published_at timestamptz,
      created_at timestamptz not null default pg_catalog.now(),
      updated_at timestamptz not null default pg_catalog.now(),
      deleted_at timestamptz
    );

    create table public.topic_series (
      id bigint generated by default as identity primary key,
      name text not null,
      slug text not null unique,
      category_id bigint not null
        references public.topic_categories(id) on delete restrict,
      status text not null check (status in ('published', 'unpublished')),
      deleted_at timestamptz,
      created_at timestamptz not null default pg_catalog.now(),
      updated_at timestamptz not null default pg_catalog.now()
    );

    create table public.topics (
      id bigint generated by default as identity primary key,
      category_id bigint references public.topic_categories(id),
      category text not null,
      category_slug text not null,
      series_id bigint references public.topic_series(id),
      series text,
      series_slug text,
      updated_at timestamptz not null default pg_catalog.now(),
      updated_by bigint
    );

    create function public.admin_update_topic_category(
      p_category_id bigint,
      p_name text,
      p_parent_id bigint,
      p_is_active boolean,
      p_color_token text,
      p_actor_id bigint
    ) returns jsonb
    language sql
    security invoker
    set search_path = public
    as $old_category$
      select '{}'::jsonb
    $old_category$;

    create function public.admin_update_topic_series(
      p_series_id bigint,
      p_name text,
      p_category_id bigint,
      p_status text,
      p_actor_id bigint
    ) returns jsonb
    language sql
    security invoker
    set search_path = public
    as $old_series$
      select '{}'::jsonb
    $old_series$;

    grant usage on schema public to anon, authenticated, service_role;
    grant select(id) on public.admin_users to service_role;
    -- SHARE ROW EXCLUSIVE requires table-level UPDATE, matching the existing
    -- Category mutation owner's lock contract.
    grant select, update, delete on public.topic_categories to service_role;
    grant select on public.topic_series to service_role;
    grant insert(name, slug, category_id, status, created_at, updated_at),
      update(name, category_id, status, deleted_at, updated_at)
      on public.topic_series to service_role;
    grant select on public.topics to service_role;
    grant update(
      category_id, category, category_slug,
      series, series_slug, updated_at, updated_by
    ) on public.topics to service_role;
    grant usage on sequence public.topic_categories_id_seq to service_role;
    grant usage on sequence public.topic_series_id_seq to service_role;
  `);

  verifyLifecycleSourceLockOrder();
  await admin.query(categoryTrashFunctionSql);
  await admin.query(categoryPermanentDeleteFunctionSql);
  await admin.query(`
    revoke all on function public.admin_move_topic_categories_to_trash(
      bigint[], bigint
    ) from public, anon, authenticated;
    grant execute on function public.admin_move_topic_categories_to_trash(
      bigint[], bigint
    ) to service_role;

    revoke all on function public.admin_permanently_delete_topic_categories(
      bigint[], bigint
    ) from public, anon, authenticated;
    grant execute on function public.admin_permanently_delete_topic_categories(
      bigint[], bigint
    ) to service_role;
  `);

  await listener.query("listen pgrst");
  await verifyOldSignatureDropPreflight(admin);
  const notification = waitForNotification(listener, "pgrst");
  try {
    await admin.query(migration);
    assert.equal(await notification, "reload schema");
  } catch (error) {
    void notification.catch(() => undefined);
    throw error;
  }

  await verifyCatalogAndAcl(admin);
  await verifyExpectedRevisionContracts(admin);
  await verifyCreateAndTriggerInvariant(admin);

  const deadlocksBefore = await deadlockCount(observer);
  await verifyCategoryRevisionRace(admin, observer);
  await verifySeriesRevisionRace(admin, observer);
  await verifyCategoryTransitionCreateRace(admin, observer);
  await verifyCategoryTrashCreateRace(admin, observer);
  await verifyCategoryPermanentDeleteCreateRace(admin);
  await verifyCategoryUpdateSeriesReassignmentRace(admin, observer);
  await verifyDirectInsertTriggerRecheckRace(admin, observer);
  await verifyDirectReassignmentTriggerRecheckRace(admin, observer);
  const deadlocksAfter = await deadlockCount(observer);
  assert.equal(
    deadlocksAfter,
    deadlocksBefore,
    "PostgreSQL recorded a deadlock during the multi-session proofs",
  );
  console.log(
    "PASS Concurrency: eight independent races covered stale writers, Category transition/create, Trash/create, Permanent Delete/create, Category update/reassignment, and direct trigger insert/reassignment; blocking paths waited/rechecked, the already-trashed delete path rejected concurrently, and all paths preserved state with deadlocks delta=0.",
  );

  await verifyPostgrestResolution(admin);

  console.log(
    `PASS verify-taxonomy-consistency-postgres17 (PostgreSQL ${identity.version_num}; real PostgREST HTTP; exact RPC/ACL/trigger catalog; guarded Category/Series writes; atomic Series create; eight independent multi-session proofs including lifecycle and direct-trigger races).`,
  );
} finally {
  for (const client of [...connectedClients]) {
    await closeClient(client).catch(() => undefined);
  }
}
