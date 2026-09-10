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

function migrationSlice(startMarker: string, endMarker: string) {
  const start = migration.indexOf(startMarker);
  const end = migration.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing migration marker ${startMarker}`);
  assert.ok(end > start, `missing migration boundary ${endMarker}`);
  return migration.slice(start, end);
}

const categoryUpdateMigrationSql = migrationSlice(
  "create function public.admin_update_topic_category(",
  "drop function public.admin_update_topic_series(",
);
const seriesUpdateMigrationSql = migrationSlice(
  "create function public.admin_update_topic_series(",
  "create function public.admin_create_topic_series(",
);
const seriesCreateMigrationSql = migrationSlice(
  "create function public.admin_create_topic_series(",
  "create function public.enforce_topic_series_category_eligibility()",
);
const seriesEligibilityTriggerFunctionSql = migrationSlice(
  "create function public.enforce_topic_series_category_eligibility()",
  "create trigger topic_series_category_eligibility_on_insert",
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
      public.admin_audit_logs,
      public.topics,
      public.topic_series,
      public.topic_categories,
      public.admin_users
    restart identity cascade;

    insert into public.admin_users(id, username, is_active) values
      (1, 'active-admin', true),
      (2, 'inactive-admin', false);

    insert into public.admin_audit_logs(
      id, actor_admin_user_id, actor_username, action,
      entity_type, entity_id, entity_label, metadata, created_at
    ) values (
      1, 1, 'active-admin', 'fixture.baseline',
      'taxonomy_fixture', 1, 'Taxonomy fixture', '{"baseline":true}'::jsonb,
      '2026-09-07T09:00:00Z'
    );

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

async function categoriesSnapshot(admin: SqlClient) {
  const result = await admin.query<{
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    is_active: boolean;
    status: string;
    color_token: string;
    published_at: string | null;
    updated_at: string;
    deleted_at: string | null;
  }>(`
    select
      id,
      name,
      slug,
      parent_id,
      is_active,
      status,
      color_token,
      published_at::text as published_at,
      updated_at::text as updated_at,
      deleted_at::text as deleted_at
    from public.topic_categories
    order by id
  `);
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    parent_id: row.parent_id === null ? null : Number(row.parent_id),
  }));
}

async function seriesRowsSnapshot(admin: SqlClient) {
  const result = await admin.query<{
    id: string;
    name: string;
    slug: string;
    category_id: string;
    status: string;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>(`
    select
      id,
      name,
      slug,
      category_id,
      status,
      deleted_at::text as deleted_at,
      created_at::text as created_at,
      updated_at::text as updated_at
    from public.topic_series
    order by id
  `);
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    category_id: Number(row.category_id),
  }));
}

async function auditSnapshot(admin: SqlClient) {
  const result = await admin.query<{
    id: string;
    actor_admin_user_id: string | null;
    actor_username: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    entity_label: string | null;
    metadata: unknown;
    created_at: string;
  }>(`
    select
      id,
      actor_admin_user_id,
      actor_username,
      action,
      entity_type,
      entity_id,
      entity_label,
      metadata,
      created_at::text as created_at
    from public.admin_audit_logs
    order by id
  `);
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    actor_admin_user_id:
      row.actor_admin_user_id === null
        ? null
        : Number(row.actor_admin_user_id),
    entity_id: row.entity_id === null ? null : Number(row.entity_id),
  }));
}

async function taxonomyStateSnapshot(admin: SqlClient) {
  return {
    categories: await categoriesSnapshot(admin),
    series: await seriesRowsSnapshot(admin),
    topics: await topicsSnapshot(admin),
    audit: await auditSnapshot(admin),
  };
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
  assert.match(
    source.slice(tableLock, rowLock + "for update;".length),
    /perform 1\s+from public\.topic_categories categories[\s\S]*?order by categories\.id\s+for update;/u,
    `${label} must apply its ordered FOR UPDATE to the categories alias`,
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

function verifyMigrationSourceContracts() {
  assert.match(
    migration,
    /drop function public\.admin_update_topic_category\(\s*bigint, text, bigint, boolean, text, bigint\s*\) restrict;/u,
  );
  assert.match(
    migration,
    /drop function public\.admin_update_topic_series\(\s*bigint, text, bigint, text, bigint\s*\) restrict;/u,
  );
  assert.doesNotMatch(migration, /drop function[\s\S]*?\)\s+cascade;/iu);

  assert.match(
    categoryUpdateMigrationSql,
    /from public\.topics as topics[\s\S]*?order by topics\.id\s+for update;[\s\S]*?from public\.topic_categories as categories[\s\S]*?for no key update;/u,
  );
  const orderedTopicLocks =
    seriesUpdateMigrationSql.match(/order by topics\.id\s+for update;/gu) ?? [];
  assert.equal(
    orderedTopicLocks.length,
    2,
    "Series update must take and recheck its Topic row locks in id order",
  );
  assert.match(
    seriesUpdateMigrationSql,
    /from public\.topic_series as series[\s\S]*?for update;[\s\S]*?from public\.topic_categories as categories[\s\S]*?for share;/u,
  );
  assert.match(
    seriesCreateMigrationSql,
    /from public\.topic_categories as categories[\s\S]*?categories\.deleted_at is null[\s\S]*?categories\.is_active is true[\s\S]*?categories\.status = 'published'[\s\S]*?for share;[\s\S]*?insert into public\.topic_series/u,
  );
  assert.match(
    seriesEligibilityTriggerFunctionSql,
    /from public\.topic_categories as categories[\s\S]*?categories\.deleted_at is null[\s\S]*?categories\.is_active is true[\s\S]*?categories\.status = 'published'[\s\S]*?for share;/u,
  );
  assert.equal(
    (migration.match(/p_status not in \('published', 'unpublished'\)/gu) ?? [])
      .length,
    2,
    "Series update/create must accept only published or unpublished",
  );

  console.log(
    "PASS migration source contracts: both retired signatures use DROP FUNCTION ... RESTRICT with no CASCADE; Category/Series relationship locks name their aliases and order Topic rows by id; Create/trigger use eligible-Category FOR SHARE; Series statuses are published/unpublished only.",
  );
}

async function verifyExistingMismatchStopsMigration(admin: SqlClient) {
  await resetFixtures(admin);
  await admin.query(`
    insert into public.topics(
      id, category_id, category, category_slug,
      series_id, series, series_slug, updated_at, updated_by
    ) values (
      101, 5, 'Parent', 'parent',
      10, 'Series Primary', 'series-primary',
      '2026-09-07T10:00:00.000101Z', 1
    )
  `);
  const stateBefore = await taxonomyStateSnapshot(admin);

  let mismatchError: (Error & { code?: string; detail?: string }) | undefined;
  try {
    await admin.query(migration);
  } catch (error) {
    mismatchError = error as Error & { code?: string; detail?: string };
  }
  await admin.query("rollback");

  assert.ok(mismatchError, "historical Topic/Series mismatch must stop migration");
  assert.equal(mismatchError.code, "23514");
  assert.match(
    mismatchError.message,
    /topic_series_category_invariant_violation/u,
  );
  assert.match(mismatchError.detail ?? "", /topic_id=101/u);
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    stateBefore,
    "the migration mismatch stop condition must not repair or partially mutate data",
  );

  const rollbackCatalog = await admin.query<{
    old_category: string | null;
    old_series: string | null;
    new_constraint_count: number;
    new_function_count: number;
    trigger_count: number;
  }>(`
    select
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_category(bigint,text,bigint,boolean,text,bigint)'
      )::text as old_category,
      pg_catalog.to_regprocedure(
        'public.admin_update_topic_series(bigint,text,bigint,text,bigint)'
      )::text as old_series,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_constraint as catalog_constraint
        where catalog_constraint.conname in (
          'topic_series_id_category_id_key',
          'topics_series_requires_category_check',
          'topics_series_category_id_fkey'
        )
      ) as new_constraint_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.proname in (
            'admin_create_topic_series',
            'enforce_topic_series_category_eligibility'
          )
      ) as new_function_count,
      (
        select pg_catalog.count(*)::integer
        from pg_catalog.pg_trigger as trigger
        where trigger.tgrelid = 'public.topic_series'::pg_catalog.regclass
          and not trigger.tgisinternal
      ) as trigger_count
  `);
  assert.match(
    rollbackCatalog.rows[0].old_category ?? "",
    /admin_update_topic_category\(bigint,text,bigint,boolean,text,bigint\)$/u,
  );
  assert.match(
    rollbackCatalog.rows[0].old_series ?? "",
    /admin_update_topic_series\(bigint,text,bigint,text,bigint\)$/u,
  );
  assert.deepEqual(
    {
      new_constraint_count: rollbackCatalog.rows[0].new_constraint_count,
      new_function_count: rollbackCatalog.rows[0].new_function_count,
      trigger_count: rollbackCatalog.rows[0].trigger_count,
    },
    {
      new_constraint_count: 0,
      new_function_count: 0,
      trigger_count: 0,
    },
  );

  await resetFixtures(admin);
  console.log(
    "PASS migration mismatch preflight: an existing Topic/Series Category mismatch raised SQLSTATE 23514, preserved exact Category/Series/Topics/Audit snapshots, retained both old RPCs, and left zero P1-E constraints/functions/triggers.",
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
  const stateBeforeRestrictFailure = await taxonomyStateSnapshot(admin);

  let restrictError: (Error & { code?: string }) | undefined;
  try {
    await admin.query(migration);
  } catch (error) {
    restrictError = error as Error & { code?: string };
  }
  await admin.query("rollback");
  assert.ok(restrictError, "the dependent old signature must stop the migration");
  assert.equal(restrictError.code, "2BP01");
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    stateBeforeRestrictFailure,
    "DROP RESTRICT failure must roll back the whole migration without Category/Series/Topics/Audit changes",
  );

  const rollbackState = await admin.query<{
    old_category: string | null;
    old_series: string | null;
    new_category: string | null;
    new_series: string | null;
    create_series: string | null;
    dependency_probe: string | null;
    constraint_count: number;
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
        from pg_catalog.pg_constraint as catalog_constraint
        where catalog_constraint.conname in (
          'topic_series_id_category_id_key',
          'topics_series_requires_category_check',
          'topics_series_category_id_fkey'
        )
      ) as constraint_count,
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
      constraint_count: rollbackState.rows[0].constraint_count,
      trigger_count: rollbackState.rows[0].trigger_count,
    },
    {
      new_category: null,
      new_series: null,
      create_series: null,
      dependency_probe: "p1_e_old_series_dependency_probe",
      constraint_count: 0,
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
  const relationshipConstraints = await admin.query<{
    name: string;
    table_name: string;
    constraint_type: string;
    definition: string;
    columns: string[];
    referenced_table: string | null;
    referenced_columns: string[] | null;
    match_type: string;
    is_deferrable: boolean;
    is_deferred: boolean;
    is_validated: boolean;
  }>(`
    select
      catalog_constraint.conname as name,
      catalog_constraint.conrelid::pg_catalog.regclass::text as table_name,
      catalog_constraint.contype::text as constraint_type,
      pg_catalog.pg_get_constraintdef(catalog_constraint.oid, true) as definition,
      array(
        select attribute.attname::text
        from pg_catalog.unnest(catalog_constraint.conkey)
          with ordinality as constraint_key(attnum, position)
        join pg_catalog.pg_attribute as attribute
          on attribute.attrelid = catalog_constraint.conrelid
         and attribute.attnum = constraint_key.attnum
        order by constraint_key.position
      ) as columns,
      case
        when catalog_constraint.confrelid = 0 then null
        else catalog_constraint.confrelid::pg_catalog.regclass::text
      end as referenced_table,
      case
        when catalog_constraint.confrelid = 0 then null
        else array(
          select attribute.attname::text
          from pg_catalog.unnest(catalog_constraint.confkey)
            with ordinality as constraint_key(attnum, position)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = catalog_constraint.confrelid
           and attribute.attnum = constraint_key.attnum
          order by constraint_key.position
        )
      end as referenced_columns,
      catalog_constraint.confmatchtype::text as match_type,
      catalog_constraint.condeferrable as is_deferrable,
      catalog_constraint.condeferred as is_deferred,
      catalog_constraint.convalidated as is_validated
    from pg_catalog.pg_constraint as catalog_constraint
    where catalog_constraint.conname in (
      'topic_series_id_category_id_key',
      'topics_series_requires_category_check',
      'topics_series_category_id_fkey'
    )
    order by catalog_constraint.conname
  `);
  assert.equal(
    relationshipConstraints.rows.length,
    3,
    "the relationship invariant must have exactly its named unique/check/composite-FK constraints",
  );
  assert.deepEqual(
    relationshipConstraints.rows.map((row) => ({
      name: row.name,
      table_name: row.table_name,
      constraint_type: row.constraint_type,
      // CHECK conkey order is catalog-internal; its definition proves the
      // expression semantics. Sort a copy so deep equality still proves the
      // exact two-column set without weakening UNIQUE/FK column order checks.
      columns:
        row.name === "topics_series_requires_category_check"
          ? [...row.columns].sort()
          : row.columns,
      referenced_table: row.referenced_table,
      referenced_columns: row.referenced_columns,
      match_type: row.match_type,
      is_deferrable: row.is_deferrable,
      is_deferred: row.is_deferred,
      is_validated: row.is_validated,
    })),
    [
      {
        name: "topic_series_id_category_id_key",
        table_name: "topic_series",
        constraint_type: "u",
        columns: ["id", "category_id"],
        referenced_table: null,
        referenced_columns: null,
        match_type: " ",
        is_deferrable: false,
        is_deferred: false,
        is_validated: true,
      },
      {
        name: "topics_series_category_id_fkey",
        table_name: "topics",
        constraint_type: "f",
        columns: ["series_id", "category_id"],
        referenced_table: "topic_series",
        referenced_columns: ["id", "category_id"],
        match_type: "s",
        is_deferrable: false,
        is_deferred: false,
        is_validated: true,
      },
      {
        name: "topics_series_requires_category_check",
        table_name: "topics",
        constraint_type: "c",
        columns: ["category_id", "series_id"],
        referenced_table: null,
        referenced_columns: null,
        match_type: " ",
        is_deferrable: false,
        is_deferred: false,
        is_validated: true,
      },
    ],
  );
  assert.match(
    relationshipConstraints.rows[0].definition,
    /^UNIQUE \(id, category_id\)$/u,
  );
  assert.match(
    relationshipConstraints.rows[1].definition,
    /^FOREIGN KEY \(series_id, category_id\) REFERENCES topic_series\(id, category_id\) ON UPDATE RESTRICT ON DELETE RESTRICT$/u,
  );
  assert.match(
    relationshipConstraints.rows[2].definition,
    /^CHECK \(series_id IS NULL OR category_id IS NOT NULL\)$/u,
  );

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
  assert.deepEqual(
    functions.rows.map((row) => ({
      name: row.name,
      identity_args: row.identity_args,
    })),
    [
      {
        name: "admin_create_topic_series",
        identity_args:
          "p_name text, p_slug text, p_category_id bigint, p_status text, p_actor_id bigint",
      },
      {
        name: "admin_update_topic_category",
        identity_args:
          "p_category_id bigint, p_name text, p_parent_id bigint, p_is_active boolean, p_color_token text, p_actor_id bigint, p_expected_updated_at timestamp with time zone",
      },
      {
        name: "admin_update_topic_series",
        identity_args:
          "p_series_id bigint, p_name text, p_category_id bigint, p_status text, p_actor_id bigint, p_expected_updated_at timestamp with time zone",
      },
      {
        name: "enforce_topic_series_category_eligibility",
        identity_args: "",
      },
    ],
  );
  for (const row of functions.rows) {
    assert.equal(row.provolatile, "v");
    assert.equal(row.prosecdef, false);
    assert.deepEqual(row.proconfig, ['search_path=""']);
  }
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

  const executeAcl = await admin.query<{
    signature: string;
    grantee: string;
    is_grantable: boolean;
  }>(`
    select
      procedure.oid::pg_catalog.regprocedure::text as signature,
      case
        when expanded_acl.grantee = 0 then 'PUBLIC'
        else grantee.rolname
      end as grantee,
      expanded_acl.is_grantable
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) as expanded_acl
    left join pg_catalog.pg_roles as grantee
      on grantee.oid = expanded_acl.grantee
    where namespace.nspname = 'public'
      and procedure.proname in (
        'admin_update_topic_category',
        'admin_update_topic_series',
        'admin_create_topic_series',
        'enforce_topic_series_category_eligibility'
      )
      and expanded_acl.privilege_type = 'EXECUTE'
    order by signature, grantee
  `);
  assert.deepEqual(
    executeAcl.rows,
    [
      {
        signature:
          "admin_create_topic_series(text,text,bigint,text,bigint)",
        grantee: "postgres",
        is_grantable: false,
      },
      {
        signature:
          "admin_create_topic_series(text,text,bigint,text,bigint)",
        grantee: "service_role",
        is_grantable: false,
      },
      {
        signature:
          "admin_update_topic_category(bigint,text,bigint,boolean,text,bigint,timestamp with time zone)",
        grantee: "postgres",
        is_grantable: false,
      },
      {
        signature:
          "admin_update_topic_category(bigint,text,bigint,boolean,text,bigint,timestamp with time zone)",
        grantee: "service_role",
        is_grantable: false,
      },
      {
        signature:
          "admin_update_topic_series(bigint,text,bigint,text,bigint,timestamp with time zone)",
        grantee: "postgres",
        is_grantable: false,
      },
      {
        signature:
          "admin_update_topic_series(bigint,text,bigint,text,bigint,timestamp with time zone)",
        grantee: "service_role",
        is_grantable: false,
      },
      {
        signature: "enforce_topic_series_category_eligibility()",
        grantee: "postgres",
        is_grantable: false,
      },
    ],
  );

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
    "PASS PostgreSQL catalog/ACL: exact validated unique/check/composite-FK relationship constraints, exact non-overloaded SECURITY INVOKER signatures, empty search_path, service_role-only RPC execution, and insert/reassignment-only triggers.",
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
  const categoryStateBefore = await taxonomyStateSnapshot(admin);
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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    categoryStateBefore,
    "stale Category revision must preserve Category/Series/Topics/Audit",
  );

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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    categoryStateBefore,
    "missing Category revision must preserve Category/Series/Topics/Audit",
  );

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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    categoryStateBefore,
    "unavailable Category parent must preserve Category/Series/Topics/Audit",
  );

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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    categoryStateBefore,
    "Category hierarchy cycle must preserve Category/Series/Topics/Audit",
  );

  await resetFixtures(admin);
  const seriesFresh = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Series Renamed', 1, 'unpublished', 1,
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
      categoryId: 1,
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
       10, 'Series Saved Again', 1, 'unpublished', 1, $1::timestamptz
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
  const seriesStateBefore = await taxonomyStateSnapshot(admin);
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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    seriesStateBefore,
    "stale Series revision must preserve Category/Series/Topics/Audit",
  );

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
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    seriesStateBefore,
    "missing Series revision must preserve Category/Series/Topics/Audit",
  );

  const stateBeforeRelationshipConflict = seriesStateBefore;
  const seriesCategoryConflict = await asServiceRole<{
    payload: SeriesResult;
  }>(
    admin,
    `select public.admin_update_topic_series(
       10, 'Must Not Reassign Linked Series', 5, 'published', 1,
       '2026-09-07T10:00:00.000010Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(seriesCategoryConflict.rows[0].payload, {
    ok: false,
    code: "series_category_conflict",
  });
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    stateBeforeRelationshipConflict,
    "typed Series reassignment conflict must preserve Category/Series/Topics/Audit",
  );

  for (const unsupportedStatus of ["draft", "archived"] as const) {
    const seriesUnsupportedStatus = await asServiceRole<{
      payload: SeriesResult;
    }>(
      admin,
      `select public.admin_update_topic_series(
         10, 'Must Not Persist', 1, $1, 1,
         '2026-09-07T10:00:00.000010Z'::timestamptz
       ) as payload`,
      [unsupportedStatus],
    );
    assert.deepEqual(seriesUnsupportedStatus.rows[0].payload, {
      ok: false,
      code: "invalid_input",
    });
    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      stateBeforeRelationshipConflict,
      `${unsupportedStatus} Series status must preserve Category/Series/Topics/Audit`,
    );
  }

  const categoryUnavailable = await asServiceRole<{ payload: SeriesResult }>(
    admin,
    `select public.admin_update_topic_series(
       11, 'Must Not Persist', 2, 'unpublished', 1,
       '2026-09-07T10:00:00.000011Z'::timestamptz
     ) as payload`,
  );
  assert.deepEqual(categoryUnavailable.rows[0].payload, {
    ok: false,
    code: "category_unavailable",
  });
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    seriesStateBefore,
    "unavailable Series Category must preserve Category/Series/Topics/Audit",
  );

  console.log(
    "PASS Expected Revision: Category and Series fresh writes are atomic and monotonic; stale/missing revisions, invalid relationships, and linked-Series reassignment conflicts return stable non-mutating results across Category/Series/Topics/Audit.",
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

async function verifyCreateAndRelationshipInvariant(admin: SqlClient) {
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

  const relationshipStateBefore = await taxonomyStateSnapshot(admin);
  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `insert into public.topics(
           id, category_id, category, category_slug,
           series_id, series, series_slug, updated_at, updated_by
         ) values (
           102, 5, 'Parent', 'parent',
           10, 'Series Primary', 'series-primary',
           '2026-09-07T10:00:00.000102Z', 1
         )`,
      ),
    "23503",
    /topics_series_category_id_fkey/u,
  );
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    relationshipStateBefore,
    "direct mismatched Topic INSERT must preserve Category/Series/Topics/Audit",
  );

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `update public.topics
         set category_id = 5,
             category = 'Parent',
             category_slug = 'parent',
             updated_at = '2026-09-07T10:00:00.000103Z'
         where id = 100`,
      ),
    "23503",
    /topics_series_category_id_fkey/u,
  );
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    relationshipStateBefore,
    "direct mismatched Topic UPDATE must preserve Category/Series/Topics/Audit",
  );

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `insert into public.topics(
           id, category_id, category, category_slug,
           series_id, series, series_slug, updated_at, updated_by
         ) values (
           103, null, 'No Category', 'no-category',
           10, 'Series Primary', 'series-primary',
           '2026-09-07T10:00:00.000103Z', 1
         )`,
      ),
    "23514",
    /topics_series_requires_category_check/u,
  );
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    relationshipStateBefore,
    "Topic series_id with null category_id must preserve Category/Series/Topics/Audit",
  );

  await expectSqlState(
    () =>
      asServiceRole(
        admin,
        `update public.topic_series
         set category_id = 5,
             updated_at = '2026-09-07T10:00:00.000104Z'
         where id = 10`,
      ),
    "23503",
    /topics_series_category_id_fkey/u,
  );
  assert.deepEqual(
    await taxonomyStateSnapshot(admin),
    relationshipStateBefore,
    "direct reassignment of a linked Series must preserve Category/Series/Topics/Audit",
  );

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
    "PASS Taxonomy Relationship Invariant: eligible Series create succeeds; unavailable Categories and direct Series eligibility bypasses fail; the composite FK rejects direct mismatched Topic INSERT/UPDATE and linked-Series reassignment; the check rejects series_id with null category_id; every rejection preserves Category/Series/Topics/Audit; same-Category Series edits and slug uniqueness retain their contracts.",
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
    const winnerState = await taxonomyStateSnapshot(admin);
    const second = await secondPromise;
    assert.deepEqual(second, { ok: false, code: "revision_conflict" });
    await writerB.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "stale Category writer must preserve the first writer plus Series/Topics/Audit",
    );
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
    const winnerState = await taxonomyStateSnapshot(admin);
    const second = await secondPromise;
    assert.deepEqual(second, { ok: false, code: "revision_conflict" });
    await writerB.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "stale Series writer must preserve the first writer plus Category/Topics/Audit",
    );
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
    const winnerState = await taxonomyStateSnapshot(admin);
    const result = await createPromise;
    assert.deepEqual(result, { ok: false, code: "category_unavailable" });
    await seriesCreator.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "Series Create rejection must preserve the committed Category transition plus Series/Topics/Audit",
    );

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
    const winnerState = await taxonomyStateSnapshot(admin);
    const createResult = await createPromise;
    assert.deepEqual(createResult, {
      ok: false,
      code: "category_unavailable",
    });
    await seriesCreator.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "Series Create rejection must preserve the committed Category trash plus Series/Topics/Audit",
    );

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
  const stateBefore = await taxonomyStateSnapshot(admin);
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

    const finalState = await taxonomyStateSnapshot(admin);
    assert.deepEqual(
      finalState.categories,
      stateBefore.categories.filter((category) => category.id !== 4),
    );
    assert.deepEqual(finalState.series, stateBefore.series);
    assert.deepEqual(finalState.topics, stateBefore.topics);
    assert.deepEqual(finalState.audit, stateBefore.audit);

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
  const seriesBefore = await seriesSnapshot(admin, 11);
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
      id: 11,
      name: "Must Not Reassign",
      categoryId: 7,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000011Z",
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
    const winnerState = await taxonomyStateSnapshot(admin);
    const reassignmentResult = await reassignmentPromise;
    assert.deepEqual(reassignmentResult, {
      ok: false,
      code: "category_unavailable",
    });
    await seriesWriter.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "Series reassignment rejection must preserve the committed Category update plus Series/Topics/Audit",
    );

    assert.deepEqual(await seriesSnapshot(admin, 11), seriesBefore);
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
    const winnerState = await taxonomyStateSnapshot(admin);
    const insertError = await insertPromise;
    assert.ok(insertError, "the direct insert must be rejected after recheck");
    assert.equal(insertError.code, "23503");
    assert.match(insertError.message, /topic_series_category_unavailable/u);
    await safeRollback(seriesWriter);

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "direct trigger INSERT rejection must preserve the committed Category winner plus Series/Topics/Audit",
    );

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
    const winnerState = await taxonomyStateSnapshot(admin);
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

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "direct trigger reassignment rejection must preserve the committed Category winner plus Series/Topics/Audit",
    );
    assert.deepEqual(await seriesSnapshot(admin, 10), seriesBefore);
    assert.deepEqual(await topicsSnapshot(admin), topicsBefore);
  } finally {
    await safeRollback(categoryWriter);
    await safeRollback(seriesWriter);
    await closeClient(categoryWriter);
    await closeClient(seriesWriter);
  }
}

async function verifyTopicWriteFirstSeriesReassignmentRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  await admin.query(`
    update public.topics
    set series_id = null,
        series = null,
        series_slug = null
    where id = 100
  `);
  const stateBefore = await taxonomyStateSnapshot(admin);
  const topicWriter = await createClient("topic-first-relationship-write");
  const seriesWriter = await createClient("series-behind-topic-write");
  try {
    await beginServiceRoleTransaction(topicWriter);
    await beginServiceRoleTransaction(seriesWriter);
    const topicPid = await backendPid(topicWriter);
    const seriesPid = await backendPid(seriesWriter);

    await topicWriter.query(`
      update public.topics
      set category_id = 1,
          category = 'Primary',
          category_slug = 'primary',
          series_id = 10,
          series = 'Series Primary',
          series_slug = 'series-primary',
          updated_at = '2026-09-07T10:00:00.000200Z',
          updated_by = 1
      where id = 100
    `);

    let settled = false;
    const reassignmentPromise = callSeries(seriesWriter, {
      id: 10,
      name: "Must Not Reassign Behind Topic",
      categoryId: 5,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000010Z",
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: seriesPid,
      expectedBlockerPid: topicPid,
      label: "Series reassignment behind a Topic relationship write",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await topicWriter.query("commit");
    const reassignmentResult = await reassignmentPromise;
    assert.deepEqual(reassignmentResult, {
      ok: false,
      code: "series_category_conflict",
    });
    const winnerState = await taxonomyStateSnapshot(admin);
    await seriesWriter.query("commit");

    assert.deepEqual(
      await taxonomyStateSnapshot(admin),
      winnerState,
      "Series conflict after Topic-first recheck must not partially mutate Category/Series/Topics/Audit",
    );
    assert.deepEqual(winnerState.categories, stateBefore.categories);
    assert.deepEqual(winnerState.series, stateBefore.series);
    assert.deepEqual(winnerState.audit, stateBefore.audit);
    assert.equal(winnerState.topics[0]?.series_id, 10);
    assert.equal(winnerState.topics[0]?.category_id, 1);
  } finally {
    await safeRollback(topicWriter);
    await safeRollback(seriesWriter);
    await closeClient(topicWriter);
    await closeClient(seriesWriter);
  }
}

async function verifySeriesReassignmentFirstOldTopicWriteRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  await admin.query(`
    update public.topics
    set series_id = null,
        series = null,
        series_slug = null
    where id = 100
  `);
  const stateBefore = await taxonomyStateSnapshot(admin);
  const seriesWriter = await createClient("series-first-reassignment");
  const topicWriter = await createClient("old-topic-behind-series");
  try {
    await beginServiceRoleTransaction(seriesWriter);
    await beginServiceRoleTransaction(topicWriter);
    const seriesPid = await backendPid(seriesWriter);
    const topicPid = await backendPid(topicWriter);

    const seriesResult = await callSeries(seriesWriter, {
      id: 10,
      name: "Series Reassigned First",
      categoryId: 5,
      status: "published",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000010Z",
    });
    assert.equal(seriesResult.ok, true);
    assert.equal((seriesResult as SeriesSuccess).topics_updated, 0);

    let settled = false;
    const topicWritePromise = topicWriter
      .query(`
        update public.topics
        set category_id = 1,
            category = 'Primary',
            category_slug = 'primary',
            series_id = 10,
            series = 'Series Primary',
            series_slug = 'series-primary',
            updated_at = '2026-09-07T10:00:00.000201Z',
            updated_by = 1
        where id = 100
      `)
      .then(() => undefined)
      .catch((error: Error & { code?: string }) => error)
      .finally(() => {
        settled = true;
      });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: topicPid,
      expectedBlockerPid: seriesPid,
      label: "old Topic relationship write behind Series reassignment",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await seriesWriter.query("commit");
    const winnerState = await taxonomyStateSnapshot(admin);
    const topicWriteError = await topicWritePromise;
    assert.ok(topicWriteError, "the stale old-Category Topic write must fail");
    assert.equal(topicWriteError.code, "23503");
    assert.match(topicWriteError.message, /topics_series_category_id_fkey/u);
    await safeRollback(topicWriter);

    const finalState = await taxonomyStateSnapshot(admin);
    assert.deepEqual(
      finalState,
      winnerState,
      "composite-FK rejection after Series-first commit must not partially mutate Category/Series/Topics/Audit",
    );
    assert.deepEqual(finalState.categories, stateBefore.categories);
    assert.deepEqual(
      finalState.topics,
      stateBefore.topics,
      "failed old-Category Topic write must leave the detached Topic untouched",
    );
    assert.deepEqual(finalState.audit, stateBefore.audit);
    const reassignedSeries = finalState.series.find((row) => row.id === 10);
    assert.equal(reassignedSeries?.name, "Series Reassigned First");
    assert.equal(reassignedSeries?.category_id, 5);
  } finally {
    await safeRollback(seriesWriter);
    await safeRollback(topicWriter);
    await closeClient(seriesWriter);
    await closeClient(topicWriter);
  }
}

async function verifyCreateFirstCategoryTransitionWaitRace(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const stateBefore = await taxonomyStateSnapshot(admin);
  const seriesCreator = await createClient("create-first-share-lock");
  const categoryWriter = await createClient("category-behind-create");
  try {
    await beginServiceRoleTransaction(seriesCreator);
    await beginServiceRoleTransaction(categoryWriter);
    const creatorPid = await backendPid(seriesCreator);
    const categoryPid = await backendPid(categoryWriter);

    const createResult = await callCreateSeries(seriesCreator, {
      name: "Create Holds Eligibility",
      slug: "create-holds-eligibility",
      categoryId: 7,
      status: "published",
      actorId: 1,
    });
    assert.equal(createResult.ok, true);

    let settled = false;
    const categoryPromise = callCategory(categoryWriter, {
      id: 7,
      name: "Race Target Transitioned",
      parentId: null,
      isActive: false,
      colorToken: "blue",
      actorId: 1,
      expectedUpdatedAt: "2026-09-07T10:00:00.000007Z",
    }).finally(() => {
      settled = true;
    });
    const waitEvent = await waitForBlockedBackend({
      observer,
      blockedPid: categoryPid,
      expectedBlockerPid: creatorPid,
      label: "Category transition behind Series Create FOR SHARE",
      isSettled: () => settled,
    });
    assert.ok(waitEvent);

    await seriesCreator.query("commit");
    const categoryResult = await categoryPromise;
    assert.equal(categoryResult.ok, true);
    await categoryWriter.query("commit");

    const finalState = await taxonomyStateSnapshot(admin);
    assert.deepEqual(finalState.audit, stateBefore.audit);
    const category = finalState.categories.find((row) => row.id === 7);
    assert.equal(category?.is_active, false);
    assert.equal(category?.status, "unpublished");
    const createdSeries = finalState.series.find(
      (row) => row.slug === "create-holds-eligibility",
    );
    assert.equal(createdSeries?.category_id, 7);
  } finally {
    await safeRollback(seriesCreator);
    await safeRollback(categoryWriter);
    await closeClient(seriesCreator);
    await closeClient(categoryWriter);
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

    create table public.admin_audit_logs (
      id bigint generated by default as identity primary key,
      actor_admin_user_id bigint references public.admin_users(id)
        on delete set null,
      actor_username text not null,
      action text not null,
      entity_type text,
      entity_id bigint,
      entity_label text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default pg_catalog.now()
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
    grant insert(
      id, category_id, category, category_slug,
      series_id, series, series_slug, updated_at, updated_by
    ) on public.topics to service_role;
    grant update(
      category_id, category, category_slug,
      series_id, series, series_slug, updated_at, updated_by
    ) on public.topics to service_role;
    grant usage on sequence public.topic_categories_id_seq to service_role;
    grant usage on sequence public.topic_series_id_seq to service_role;
  `);

  verifyMigrationSourceContracts();
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
  await verifyExistingMismatchStopsMigration(admin);
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
  await verifyCreateAndRelationshipInvariant(admin);

  const deadlocksBefore = await deadlockCount(observer);
  await verifyCategoryRevisionRace(admin, observer);
  await verifySeriesRevisionRace(admin, observer);
  await verifyCategoryTransitionCreateRace(admin, observer);
  await verifyCategoryTrashCreateRace(admin, observer);
  await verifyCategoryPermanentDeleteCreateRace(admin);
  await verifyCategoryUpdateSeriesReassignmentRace(admin, observer);
  await verifyDirectInsertTriggerRecheckRace(admin, observer);
  await verifyDirectReassignmentTriggerRecheckRace(admin, observer);
  await verifyTopicWriteFirstSeriesReassignmentRace(admin, observer);
  await verifySeriesReassignmentFirstOldTopicWriteRace(admin, observer);
  await verifyCreateFirstCategoryTransitionWaitRace(admin, observer);
  const deadlocksAfter = await deadlockCount(observer);
  assert.equal(
    deadlocksAfter,
    deadlocksBefore,
    "PostgreSQL recorded a deadlock during the multi-session proofs",
  );
  console.log(
    "PASS Concurrency: 11 independent multi-session proofs included 10 observed lock waits plus the already-trashed delete/create rejection; they covered stale revisions, both Category eligibility lock directions, lifecycle/create, Category update/reassignment, direct eligibility triggers, Topic-first/Series-second typed recheck, and Series-first/old-Topic-second composite-FK rejection; rejection paths preserved state and deadlocks delta=0.",
  );

  await verifyPostgrestResolution(admin);

  console.log(
    `PASS verify-taxonomy-consistency-postgres17 (PostgreSQL ${identity.version_num}; real PostgREST HTTP; mismatch-stop rollback; exact constraint/RPC/ACL/trigger catalog; guarded Category/Series/Topic relationships; atomic Series create; 11 independent multi-session proofs with 10 observed lock waits and deadlocks delta=0).`,
  );
} finally {
  for (const client of [...connectedClients]) {
    await closeClient(client).catch(() => undefined);
  }
}
