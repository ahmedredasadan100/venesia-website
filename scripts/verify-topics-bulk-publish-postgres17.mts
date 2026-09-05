import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// @ts-expect-error The pg runtime package has no declarations in this workspace.
import pg from "pg";

import type {
  TopicsBulkPublishExpectedRevision,
  TopicsBulkPublishRpcResult,
} from "../src/lib/admin/content/topics-bulk-publish.ts";

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

type TopicState = {
  id: number;
  status: string;
  published_at: string | null;
  published_by: number | null;
  updated_by: number | null;
  updated_at: string;
  deleted_at: string | null;
  title: string;
};

const required = process.env.TOPICS_BULK_PUBLISH_DATABASE_REQUIRED === "1";
const acknowledgedDisposable =
  process.env.TOPICS_BULK_PUBLISH_DATABASE_DISPOSABLE === "1";
const connectionString =
  process.env.TOPICS_BULK_PUBLISH_DATABASE_URL?.trim();

if (!connectionString) {
  if (required) {
    console.error(
      "FAIL verify-topics-bulk-publish-postgres17: TOPICS_BULK_PUBLISH_DATABASE_URL is required.",
    );
    process.exit(1);
  }

  console.log(
    "SKIP verify-topics-bulk-publish-postgres17: no isolated TOPICS_BULK_PUBLISH_DATABASE_URL was provided.",
  );
  process.exit(0);
}

let databaseUrl: URL;
try {
  databaseUrl = new URL(connectionString);
} catch {
  console.error(
    "FAIL verify-topics-bulk-publish-postgres17: TOPICS_BULK_PUBLISH_DATABASE_URL is not a valid URL.",
  );
  process.exit(1);
}

const allowedProtocols = new Set(["postgres:", "postgresql:"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseName = decodeURIComponent(
  databaseUrl.pathname.replace(/^\//u, ""),
);
const isolatedDatabaseName =
  databaseName === "venesia_topics_bulk_publish_ci" ||
  /(?:^|_)topics_bulk_publish_(?:test|ci)(?:_|$)/u.test(databaseName);

if (
  !allowedProtocols.has(databaseUrl.protocol) ||
  !loopbackHosts.has(databaseUrl.hostname) ||
  !isolatedDatabaseName ||
  !acknowledgedDisposable
) {
  console.error(
    "FAIL verify-topics-bulk-publish-postgres17: refusing a database that is not loopback-only, explicitly disposable, and named for the Topics bulk-publish test/CI.",
  );
  process.exit(1);
}

const migration = readFileSync(
  new URL(
    "../sql/migrations/20260905090000_topics_bulk_publish_atomicity.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\uFEFF/u, "");

const adminUsersActiveInvariantMigration = readFileSync(
  new URL(
    "../sql/migrations/20260814174238_admin_users_active_invariant.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\uFEFF/u, "");

const connectedClients = new Set<SqlClient>();

async function createClient(label: string) {
  const client: SqlClient = new Client({
    connectionString,
    application_name: `topics-bulk-publish-${label}`,
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
    // Closing the disposable session below also rolls back any open transaction.
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
         pg_catalog.array_to_json(
           pg_catalog.pg_blocking_pids(activity.pid)
         ) as blockers
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
      return {
        waitEvent: state.wait_event,
        blockers,
      };
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

async function callPublish(
  client: SqlClient,
  actorId: number,
  topics: readonly TopicsBulkPublishExpectedRevision[],
) {
  const result = await client.query<{ payload: TopicsBulkPublishRpcResult }>(
    "select public.admin_publish_topics_atomically($1, $2::jsonb) as payload",
    [actorId, JSON.stringify(topics)],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0].payload;
}

async function callPublishAsServiceRole(
  client: SqlClient,
  actorId: number,
  topics: readonly TopicsBulkPublishExpectedRevision[],
) {
  await client.query("set role service_role");
  try {
    return await callPublish(client, actorId, topics);
  } finally {
    await client.query("reset role");
  }
}

async function resetFixtures(client: SqlClient) {
  await client.query(`
    truncate table
      public.admin_audit_logs,
      public.topics,
      public.admin_users
    restart identity;

    insert into public.admin_users(id, username, is_active) values
      (1, 'active-admin', true),
      (2, 'inactive-admin', false),
      (3, 'remaining-active-admin', true);

    insert into public.topics(
      id, status, published_at, published_by, updated_by, updated_at, deleted_at,
      title, slug, excerpt, content, image, category, category_slug, content_type,
      seo_title, seo_description, focus_keyword, og_image_alt, faq, media_payload
    ) values
      (1, 'unpublished', null, null, null, '2026-09-05T06:00:01Z', null,
        'Topic One', 'topic-one', 'Excerpt One', 'Content One', '/one.jpg',
        'Category One', 'category-one', 'article', 'SEO One', 'Description One',
        'keyword-one', 'Alt One', '[]', '{}'),
      (2, 'unpublished', null, null, null, '2026-09-05T06:00:02Z', null,
        'Topic Two', 'topic-two', 'Excerpt Two', 'Content Two', '/two.jpg',
        'Category Two', 'category-two', 'article', 'SEO Two', 'Description Two',
        'keyword-two', 'Alt Two', '[]', '{}'),
      (3, 'unpublished', null, null, null, '2026-09-05T06:00:03Z', null,
        'Topic Three', 'topic-three', 'Excerpt Three', 'Content Three', '/three.jpg',
        'Category Three', 'category-three', 'article', 'SEO Three', 'Description Three',
        'keyword-three', 'Alt Three', '[]', '{}'),
      (4, 'published', '2025-01-02T03:04:05Z', 2, 2, '2026-09-05T06:00:04Z', null,
        'Published Topic', 'published-topic', 'Published Excerpt', 'Published Content', '/published.jpg',
        'Published Category', 'published-category', 'article', 'Published SEO', 'Published Description',
        'published-keyword', 'Published Alt', '[]', '{}'),
      (5, 'unpublished', null, null, null, '2026-09-05T06:00:05Z', '2026-09-05T06:30:00Z',
        'Deleted Topic', 'deleted-topic', 'Deleted Excerpt', 'Deleted Content', '/deleted.jpg',
        'Deleted Category', 'deleted-category', 'article', 'Deleted SEO', 'Deleted Description',
        'deleted-keyword', 'Deleted Alt', '[]', '{}');
  `);
}

async function auditSnapshot(client: SqlClient) {
  const result = await client.query<{ snapshot: unknown }>(
    `select coalesce(
       pg_catalog.jsonb_agg(pg_catalog.to_jsonb(audit) order by audit.id),
       '[]'::jsonb
     ) as snapshot
     from public.admin_audit_logs as audit`,
  );
  return result.rows[0]?.snapshot;
}

async function auditRows(client: SqlClient) {
  const result = await client.query<{
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
      audit.id::text as id,
      audit.actor_admin_user_id::text as actor_admin_user_id,
      audit.actor_username,
      audit.action,
      audit.entity_type,
      audit.entity_id::text as entity_id,
      audit.entity_label,
      audit.metadata,
      pg_catalog.to_char(
        audit.created_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
      ) as created_at
    from public.admin_audit_logs as audit
    order by audit.id
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

async function topicStates(client: SqlClient, ids: readonly number[]) {
  const result = await client.query<{
    id: string;
    status: string;
    published_at: string | null;
    published_by: string | null;
    updated_by: string | null;
    updated_at: string;
    deleted_at: string | null;
    title: string;
  }>(
    `select
       topic.id::text as id,
       topic.status,
       case when topic.published_at is null then null else
         pg_catalog.to_char(
           topic.published_at at time zone 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
         )
       end as published_at,
       topic.published_by::text as published_by,
       topic.updated_by::text as updated_by,
       pg_catalog.to_char(
         topic.updated_at at time zone 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) as updated_at,
       case when topic.deleted_at is null then null else
         pg_catalog.to_char(
           topic.deleted_at at time zone 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
         )
       end as deleted_at,
       topic.title
     from public.topics as topic
     where topic.id = any($1::bigint[])
     order by topic.id`,
    [ids],
  );

  return result.rows.map<TopicState>((row) => ({
    id: Number(row.id),
    status: row.status,
    published_at: row.published_at,
    published_by:
      row.published_by === null ? null : Number(row.published_by),
    updated_by: row.updated_by === null ? null : Number(row.updated_by),
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    title: row.title,
  }));
}

async function topicSnapshot(client: SqlClient, ids: readonly number[]) {
  const result = await client.query<{ snapshot: unknown }>(
    `select coalesce(
       pg_catalog.jsonb_agg(pg_catalog.to_jsonb(topic) order by topic.id),
       '[]'::jsonb
     ) as snapshot
     from public.topics as topic
     where topic.id = any($1::bigint[])`,
    [ids],
  );
  return result.rows[0]?.snapshot;
}

async function publishInputs(
  client: SqlClient,
  ids: readonly number[],
): Promise<TopicsBulkPublishExpectedRevision[]> {
  const states = await topicStates(client, ids);
  assert.equal(states.length, ids.length);
  const revisionById = new Map(
    states.map((state) => [state.id, state.updated_at]),
  );
  return ids.map((id) => ({
    id,
    expected_updated_at: String(revisionById.get(id)),
  }));
}

async function deadlockCount(client: SqlClient) {
  const result = await client.query<{ deadlocks: string }>(
    `select statistics.deadlocks::text as deadlocks
     from pg_catalog.pg_stat_database as statistics
     where statistics.datname = pg_catalog.current_database()`,
  );
  return Number(result.rows[0]?.deadlocks ?? 0);
}

async function verifyReverseOrderBatches(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const firstInput = await publishInputs(admin, [2, 1]);
  const secondInput = await publishInputs(admin, [1, 2]);
  const first = await createClient("reverse-order-first");
  const second = await createClient("reverse-order-second");
  let secondCall: Promise<TopicsBulkPublishRpcResult> | undefined;

  try {
    const firstPid = await backendPid(first);
    const secondPid = await backendPid(second);
    await beginServiceRoleTransaction(first);
    const firstResult = await callPublish(first, 1, firstInput);
    assert.equal(firstResult.ok, true);
    if (!firstResult.ok) assert.fail("Expected first batch to publish.");
    assert.deepEqual(firstResult.requestedIds, [1, 2]);
    assert.deepEqual(firstResult.publishedIds, [1, 2]);
    assert.deepEqual(firstResult.alreadyPublishedIds, []);
    assert.equal(firstResult.auditIds.length, 2);
    await first.query("reset role");
    const stateAfterFirstPublish = await topicStates(first, [1, 2]);

    await beginServiceRoleTransaction(second);
    let secondSettled = false;
    secondCall = callPublish(second, 1, secondInput);
    void secondCall.then(
      () => {
        secondSettled = true;
      },
      () => {
        secondSettled = true;
      },
    );
    const lockProof = await waitForBlockedBackend({
      observer,
      blockedPid: secondPid,
      expectedBlockerPid: firstPid,
      label: "reverse-order second batch",
      isSettled: () => secondSettled,
    });

    await first.query("commit");
    const secondResult = await secondCall;
    await second.query("commit");
    assert.equal(secondResult.ok, true);
    if (!secondResult.ok) {
      assert.fail("Expected the second batch to resolve as an already-published no-op.");
    }
    assert.deepEqual(secondResult.requestedIds, [1, 2]);
    assert.deepEqual(secondResult.publishedIds, []);
    assert.deepEqual(secondResult.alreadyPublishedIds, [1, 2]);
    assert.deepEqual(secondResult.auditIds, []);
    const after = await topicStates(admin, [1, 2]);
    assert.ok(after.every((topic) => topic.status === "published"));
    assert.ok(after.every((topic) => topic.published_by === 1));
    assert.ok(after.every((topic) => topic.updated_by === 1));
    assert.deepEqual(
      after,
      stateAfterFirstPublish,
      "The second batch must not change the first publish revision or published_at.",
    );
    const audits = await auditRows(admin);
    assert.deepEqual(
      audits.map((audit) => audit.id),
      firstResult.auditIds,
    );
    assert.deepEqual(
      audits.map((audit) => audit.entity_id),
      [1, 2],
    );
    console.log(
      `PASS reverse-order overlapping batches: first committed, second resolved as an exact already-published no-op after ${lockProof.waitEvent ?? "row"} lock wait; no duplicate Audit or timestamp write.`,
    );
  } finally {
    await safeRollback(first);
    if (secondCall) await secondCall.catch(() => undefined);
    await safeRollback(second);
    await Promise.all([closeClient(first), closeClient(second)]);
  }
}

async function verifyWriterRevisionConflict(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const before = await topicStates(admin, [1, 2]);
  const publishInput = await publishInputs(admin, [1, 2]);
  const writer = await createClient("writer-lock");
  const publisher = await createClient("writer-waiting-publisher");
  let publishCall: Promise<TopicsBulkPublishRpcResult> | undefined;

  try {
    const writerPid = await backendPid(writer);
    const publisherPid = await backendPid(publisher);
    await writer.query("begin");
    await writer.query("set local statement_timeout = '12s'");
    await writer.query(
      `update public.topics
       set title = 'Topic One concurrently updated',
           updated_at = '2026-09-05T07:00:01Z'
       where id = 1`,
    );

    await beginServiceRoleTransaction(publisher);
    let publisherSettled = false;
    publishCall = callPublish(publisher, 1, publishInput);
    void publishCall.then(
      () => {
        publisherSettled = true;
      },
      () => {
        publisherSettled = true;
      },
    );
    const lockProof = await waitForBlockedBackend({
      observer,
      blockedPid: publisherPid,
      expectedBlockerPid: writerPid,
      label: "publisher behind semantic writer",
      isSettled: () => publisherSettled,
    });

    await writer.query("commit");
    const publishResult = await publishCall;
    await publisher.query("commit");
    assert.deepEqual(publishResult, {
      ok: false,
      code: "revision_conflict",
      topicIds: [1],
    });

    const after = await topicStates(admin, [1, 2]);
    assert.deepEqual(after[1], before[1]);
    assert.deepEqual(after[0], {
      ...before[0],
      title: "Topic One concurrently updated",
      updated_at: "2026-09-05T07:00:01.000000Z",
    });
    assert.deepEqual(await auditSnapshot(admin), []);
    console.log(
      `PASS concurrent writer: publisher waited on ${lockProof.waitEvent ?? "row"}, returned revision_conflict, and changed no batch row.`,
    );
  } finally {
    await safeRollback(writer);
    if (publishCall) await publishCall.catch(() => undefined);
    await safeRollback(publisher);
    await Promise.all([closeClient(writer), closeClient(publisher)]);
  }
}

async function verifyConcurrentActorDisable(
  admin: SqlClient,
  observer: SqlClient,
) {
  await resetFixtures(admin);
  const before = await topicSnapshot(admin, [1, 2]);
  const publishInput = await publishInputs(admin, [1, 2]);
  const disabler = await createClient("actor-disabler");
  const publisher = await createClient("actor-waiting-publisher");
  let publishCall: Promise<TopicsBulkPublishRpcResult> | undefined;

  try {
    const disablerPid = await backendPid(disabler);
    const publisherPid = await backendPid(publisher);
    await disabler.query("begin");
    await disabler.query("set local statement_timeout = '12s'");
    await disabler.query(
      "update public.admin_users set is_active = false where id = 1",
    );

    await beginServiceRoleTransaction(publisher);
    let publisherSettled = false;
    publishCall = callPublish(publisher, 1, publishInput);
    void publishCall.then(
      () => {
        publisherSettled = true;
      },
      () => {
        publisherSettled = true;
      },
    );
    const lockProof = await waitForBlockedBackend({
      observer,
      blockedPid: publisherPid,
      expectedBlockerPid: disablerPid,
      label: "publisher behind actor disable",
      isSettled: () => publisherSettled,
    });

    await disabler.query("commit");
    const publishResult = await publishCall;
    await publisher.query("commit");
    assert.deepEqual(publishResult, {
      ok: false,
      code: "unauthorized_actor",
    });
    assert.deepEqual(await topicSnapshot(admin, [1, 2]), before);
    assert.deepEqual(await auditSnapshot(admin), []);
    const actor = await admin.query<{ is_active: boolean }>(
      `select is_active
       from public.admin_users
       where id = 1`,
    );
    assert.equal(actor.rows[0]?.is_active, false);
    const remainingActiveActor = await admin.query<{ is_active: boolean }>(
      `select is_active
       from public.admin_users
       where id = 3`,
    );
    assert.equal(
      remainingActiveActor.rows[0]?.is_active,
      true,
      "the production last-active-admin invariant must remain satisfiable",
    );
    console.log(
      `PASS concurrent actor disable: publisher waited on ${lockProof.waitEvent ?? "row"}, rejected the now-inactive actor, and wrote no Topic.`,
    );
  } finally {
    await safeRollback(disabler);
    if (publishCall) await publishCall.catch(() => undefined);
    await safeRollback(publisher);
    await Promise.all([closeClient(disabler), closeClient(publisher)]);
  }
}

async function verifyInjectedRowFailureRollback(admin: SqlClient) {
  await resetFixtures(admin);
  const before = await topicSnapshot(admin, [1, 2]);
  const publishInput = await publishInputs(admin, [2, 1]);
  await admin.query(`
    create or replace function public.reject_second_topic_publish_fixture()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
      if new.id = 2 and new.status = 'published' then
        raise exception using
          errcode = 'P0001',
          message = 'reject_second_topic_publish_fixture';
      end if;
      return new;
    end;
    $function$;

    create trigger reject_second_topic_publish_fixture
    before update of status on public.topics
    for each row execute function public.reject_second_topic_publish_fixture();
  `);

  const publisher = await createClient("injected-row-failure");
  let caught: Error | undefined;
  try {
    await publisher.query("set role service_role");
    try {
      await callPublish(publisher, 1, publishInput);
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
      assert.equal(
        (error as { code?: string }).code,
        "P0001",
        "fixture failure must surface as a PostgreSQL exception",
      );
    } finally {
      await publisher.query("reset role");
    }
    assert.ok(caught, "the injected second-row failure must reject the RPC");
    assert.match(caught.message, /reject_second_topic_publish_fixture/u);
    assert.deepEqual(await topicSnapshot(admin, [1, 2]), before);
    assert.deepEqual(await auditSnapshot(admin), []);
    console.log(
      "PASS injected second-row failure: PostgreSQL rolled the complete set-based statement back with exact before/after equality.",
    );
  } finally {
    await closeClient(publisher);
    await admin.query(`
      drop trigger if exists reject_second_topic_publish_fixture on public.topics;
      drop function if exists public.reject_second_topic_publish_fixture();
    `);
  }
}

async function verifyTransactionalAuditAndInputContracts(admin: SqlClient) {
  await resetFixtures(admin);
  const beforeAuditFailureTopics = await topicSnapshot(admin, [1, 2]);
  const beforeAuditFailureAudits = await auditSnapshot(admin);
  const auditFailureInput = await publishInputs(admin, [2, 1]);
  await admin.query(`
    create or replace function public.reject_second_topic_audit_fixture()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
      if new.action = 'topic.publish' and new.entity_id = 2 then
        raise exception using
          errcode = 'P0001',
          message = 'reject_second_topic_audit_fixture';
      end if;
      return new;
    end;
    $function$;

    create trigger reject_second_topic_audit_fixture
    before insert on public.admin_audit_logs
    for each row execute function public.reject_second_topic_audit_fixture();
  `);
  let caught: Error | undefined;
  try {
    try {
      await callPublishAsServiceRole(admin, 1, auditFailureInput);
    } catch (error) {
      caught = error instanceof Error ? error : new Error(String(error));
      assert.equal((error as { code?: string }).code, "P0001");
    }
    assert.ok(caught, "the injected Audit failure must reject the RPC");
    assert.match(caught.message, /reject_second_topic_audit_fixture/u);
    assert.deepEqual(
      await topicSnapshot(admin, [1, 2]),
      beforeAuditFailureTopics,
    );
    assert.deepEqual(await auditSnapshot(admin), beforeAuditFailureAudits);
  } finally {
    await admin.query(`
      drop trigger if exists reject_second_topic_audit_fixture
        on public.admin_audit_logs;
      drop function if exists public.reject_second_topic_audit_fixture();
    `);
  }

  await resetFixtures(admin);
  const duplicateInput = (await publishInputs(admin, [1]))[0];
  assert.deepEqual(
    await callPublishAsServiceRole(admin, 1, [duplicateInput, duplicateInput]),
    { ok: false, code: "duplicate_ids", duplicateIds: [1] },
  );
  assert.equal((await topicStates(admin, [1]))[0].status, "unpublished");
  assert.deepEqual(await auditSnapshot(admin), []);

  await resetFixtures(admin);
  const beforeAlreadyPublished = await topicSnapshot(admin, [4]);
  const alreadyPublished = await callPublishAsServiceRole(
    admin,
    1,
    [{ id: 4, expected_updated_at: "2020-01-01T00:00:00Z" }],
  );
  assert.equal(alreadyPublished.ok, true);
  if (!alreadyPublished.ok) {
    assert.fail("Expected already-published Topic to be an idempotent success.");
  }
  assert.deepEqual(alreadyPublished.requestedIds, [4]);
  assert.deepEqual(alreadyPublished.publishedIds, []);
  assert.deepEqual(alreadyPublished.alreadyPublishedIds, [4]);
  assert.deepEqual(alreadyPublished.auditIds, []);
  assert.deepEqual(await topicSnapshot(admin, [4]), beforeAlreadyPublished);
  assert.deepEqual(await auditSnapshot(admin), []);

  await resetFixtures(admin);
  assert.deepEqual(
    await callPublishAsServiceRole(admin, 1, [
      { id: 999, expected_updated_at: "2026-09-05T06:00:00Z" },
    ]),
    { ok: false, code: "missing_topics", topicIds: [999] },
  );
  assert.deepEqual(
    await callPublishAsServiceRole(
      admin,
      1,
      await publishInputs(admin, [5]),
    ),
    { ok: false, code: "deleted_topics", topicIds: [5] },
  );
  assert.deepEqual(await auditSnapshot(admin), []);

  await resetFixtures(admin);
  await admin.query(`
    update public.topics
    set published_at = '2025-01-02T03:04:05Z'
    where id = 1
  `);
  const firstPublicationTime = (await topicStates(admin, [1]))[0].published_at;
  const mixed = await callPublishAsServiceRole(
    admin,
    1,
    await publishInputs(admin, [4, 1]),
  );
  assert.equal(mixed.ok, true);
  if (!mixed.ok) assert.fail("Expected mixed publish/no-op batch success.");
  assert.deepEqual(mixed.requestedIds, [1, 4]);
  assert.deepEqual(mixed.publishedIds, [1]);
  assert.deepEqual(mixed.alreadyPublishedIds, [4]);
  assert.equal(mixed.auditIds.length, 1);
  assert.equal(
    (await topicStates(admin, [1]))[0].published_at,
    firstPublicationTime,
  );
  const audits = await auditRows(admin);
  assert.deepEqual(
    audits.map((audit) => ({
      id: audit.id,
      actor_admin_user_id: audit.actor_admin_user_id,
      actor_username: audit.actor_username,
      action: audit.action,
      entity_type: audit.entity_type,
      entity_id: audit.entity_id,
      entity_label: audit.entity_label,
      metadata: audit.metadata,
    })),
    [
      {
        id: mixed.auditIds[0],
        actor_admin_user_id: 1,
        actor_username: "active-admin",
        action: "topic.publish",
        entity_type: "topic",
        entity_id: 1,
        entity_label: "Topic One",
        metadata: { atomic: true, operation: "bulk_publish" },
      },
    ],
  );

  console.log(
    "PASS transactional Audit/input contracts: per-transition canonical Audit rows, Audit-failure rollback, duplicate rejection, exact already-published no-op, and distinct missing/deleted results.",
  );
}

async function verifyCatalogAndAcl(admin: SqlClient) {
  const functions = await admin.query<{
    signature: string;
    identity_args: string;
    provolatile: string;
    prosecdef: boolean;
    proconfig: string[] | null;
    owner_name: string;
  }>(`
    select
      procedure.oid::pg_catalog.regprocedure::text as signature,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as identity_args,
      procedure.provolatile::text,
      procedure.prosecdef,
      procedure.proconfig,
      pg_catalog.pg_get_userbyid(procedure.proowner) as owner_name
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'admin_publish_topics_atomically'
  `);
  assert.equal(functions.rows.length, 1, "the RPC must have exactly one overload");
  assert.match(
    functions.rows[0].signature,
    /admin_publish_topics_atomically\(bigint,jsonb\)$/u,
  );
  assert.equal(
    functions.rows[0].identity_args,
    "p_actor_id bigint, p_topics jsonb",
  );
  assert.equal(functions.rows[0].provolatile, "v");
  assert.equal(functions.rows[0].prosecdef, false);
  assert.deepEqual(functions.rows[0].proconfig, ['search_path=""']);
  assert.equal(functions.rows[0].owner_name, "postgres");

  const directAcl = await admin.query<{
    role_name: string;
    privilege_type: string;
  }>(`
    select
      case
        when acl.grantee = 0 then 'PUBLIC'
        else pg_catalog.pg_get_userbyid(acl.grantee)
      end as role_name,
      acl.privilege_type
    from pg_catalog.pg_proc as procedure
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) as acl
    where procedure.oid =
      'public.admin_publish_topics_atomically(bigint,jsonb)'::pg_catalog.regprocedure
    order by role_name, privilege_type
  `);
  assert.deepEqual(directAcl.rows, [
    { role_name: "postgres", privilege_type: "EXECUTE" },
    { role_name: "service_role", privilege_type: "EXECUTE" },
  ]);

  const effectiveFunctionAcl = await admin.query<{
    postgres_execute: boolean;
    service_execute: boolean;
    anon_execute: boolean;
    authenticated_execute: boolean;
  }>(`
    select
      pg_catalog.has_function_privilege(
        'postgres',
        'public.admin_publish_topics_atomically(bigint,jsonb)',
        'execute'
      ) as postgres_execute,
      pg_catalog.has_function_privilege(
        'service_role',
        'public.admin_publish_topics_atomically(bigint,jsonb)',
        'execute'
      ) as service_execute,
      pg_catalog.has_function_privilege(
        'anon',
        'public.admin_publish_topics_atomically(bigint,jsonb)',
        'execute'
      ) as anon_execute,
      pg_catalog.has_function_privilege(
        'authenticated',
        'public.admin_publish_topics_atomically(bigint,jsonb)',
        'execute'
      ) as authenticated_execute
  `);
  assert.deepEqual(effectiveFunctionAcl.rows[0], {
    postgres_execute: true,
    service_execute: true,
    anon_execute: false,
    authenticated_execute: false,
  });

  const servicePrivileges = await admin.query<{
    schema_usage: boolean;
    schema_create: boolean;
    admin_table_select: boolean;
    admin_id_select: boolean;
    admin_active_select: boolean;
    admin_username_select: boolean;
    admin_updated_at_update: boolean;
    admin_id_update: boolean;
    admin_active_update: boolean;
    admin_insert: boolean;
    admin_delete: boolean;
    admin_truncate: boolean;
    topics_table_select: boolean;
    topics_insert: boolean;
    topics_delete: boolean;
    topics_truncate: boolean;
    audit_table_select: boolean;
    audit_table_insert: boolean;
    audit_id_select: boolean;
    audit_action_insert: boolean;
    audit_ip_address_insert: boolean;
    audit_update: boolean;
    audit_delete: boolean;
    audit_truncate: boolean;
    audit_sequence_usage: boolean;
    audit_sequence_select: boolean;
  }>(`
    select
      pg_catalog.has_schema_privilege('service_role', 'public', 'usage') as schema_usage,
      pg_catalog.has_schema_privilege('service_role', 'public', 'create') as schema_create,
      pg_catalog.has_table_privilege('service_role', 'public.admin_users', 'select') as admin_table_select,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'id', 'select') as admin_id_select,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'is_active', 'select') as admin_active_select,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'username', 'select') as admin_username_select,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'updated_at', 'update') as admin_updated_at_update,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'id', 'update') as admin_id_update,
      pg_catalog.has_column_privilege('service_role', 'public.admin_users', 'is_active', 'update') as admin_active_update,
      pg_catalog.has_table_privilege('service_role', 'public.admin_users', 'insert') as admin_insert,
      pg_catalog.has_table_privilege('service_role', 'public.admin_users', 'delete') as admin_delete,
      pg_catalog.has_table_privilege('service_role', 'public.admin_users', 'truncate') as admin_truncate,
      pg_catalog.has_table_privilege('service_role', 'public.topics', 'select') as topics_table_select,
      pg_catalog.has_table_privilege('service_role', 'public.topics', 'insert') as topics_insert,
      pg_catalog.has_table_privilege('service_role', 'public.topics', 'delete') as topics_delete,
      pg_catalog.has_table_privilege('service_role', 'public.topics', 'truncate') as topics_truncate,
      pg_catalog.has_table_privilege('service_role', 'public.admin_audit_logs', 'select') as audit_table_select,
      pg_catalog.has_table_privilege('service_role', 'public.admin_audit_logs', 'insert') as audit_table_insert,
      pg_catalog.has_column_privilege('service_role', 'public.admin_audit_logs', 'id', 'select') as audit_id_select,
      pg_catalog.has_column_privilege('service_role', 'public.admin_audit_logs', 'action', 'insert') as audit_action_insert,
      pg_catalog.has_column_privilege('service_role', 'public.admin_audit_logs', 'ip_address', 'insert') as audit_ip_address_insert,
      pg_catalog.has_table_privilege('service_role', 'public.admin_audit_logs', 'update') as audit_update,
      pg_catalog.has_table_privilege('service_role', 'public.admin_audit_logs', 'delete') as audit_delete,
      pg_catalog.has_table_privilege('service_role', 'public.admin_audit_logs', 'truncate') as audit_truncate,
      pg_catalog.has_sequence_privilege('service_role', 'public.admin_audit_logs_id_seq', 'usage') as audit_sequence_usage,
      pg_catalog.has_sequence_privilege('service_role', 'public.admin_audit_logs_id_seq', 'select') as audit_sequence_select
  `);
  assert.deepEqual(servicePrivileges.rows[0], {
    schema_usage: true,
    schema_create: false,
    admin_table_select: false,
    admin_id_select: true,
    admin_active_select: true,
    admin_username_select: true,
    admin_updated_at_update: true,
    admin_id_update: false,
    admin_active_update: false,
    admin_insert: false,
    admin_delete: false,
    admin_truncate: false,
    topics_table_select: false,
    topics_insert: false,
    topics_delete: false,
    topics_truncate: false,
    audit_table_select: false,
    audit_table_insert: false,
    audit_id_select: true,
    audit_action_insert: true,
    audit_ip_address_insert: false,
    audit_update: false,
    audit_delete: false,
    audit_truncate: false,
    audit_sequence_usage: true,
    audit_sequence_select: false,
  });
  const columnPrivileges = await admin.query<{
    table_name: string;
    column_name: string;
    privilege_type: string;
  }>(`
    select
      privileges.table_name,
      privileges.column_name,
      privileges.privilege_type
    from information_schema.column_privileges as privileges
    where privileges.grantee = 'service_role'
      and privileges.table_schema = 'public'
      and privileges.privilege_type in ('INSERT', 'SELECT', 'UPDATE')
    order by privileges.table_name, privileges.privilege_type, privileges.column_name
  `);
  assert.deepEqual(columnPrivileges.rows, [
    { table_name: "admin_audit_logs", column_name: "action", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "actor_admin_user_id", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "actor_username", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "created_at", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "entity_id", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "entity_label", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "entity_type", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "metadata", privilege_type: "INSERT" },
    { table_name: "admin_audit_logs", column_name: "id", privilege_type: "SELECT" },
    { table_name: "admin_users", column_name: "id", privilege_type: "SELECT" },
    { table_name: "admin_users", column_name: "is_active", privilege_type: "SELECT" },
    { table_name: "admin_users", column_name: "username", privilege_type: "SELECT" },
    { table_name: "admin_users", column_name: "updated_at", privilege_type: "UPDATE" },
    { table_name: "topics", column_name: "deleted_at", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "id", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "published_at", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "status", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "title", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "updated_at", privilege_type: "SELECT" },
    { table_name: "topics", column_name: "published_at", privilege_type: "UPDATE" },
    { table_name: "topics", column_name: "published_by", privilege_type: "UPDATE" },
    { table_name: "topics", column_name: "status", privilege_type: "UPDATE" },
    { table_name: "topics", column_name: "updated_at", privilege_type: "UPDATE" },
    { table_name: "topics", column_name: "updated_by", privilege_type: "UPDATE" },
  ]);

  for (const role of ["anon", "authenticated"] as const) {
    const denied = await createClient(`denied-${role}`);
    try {
      await denied.query(`set role ${role}`);
      let caught: Error | undefined;
      try {
        await denied.query(
          `select public.admin_publish_topics_atomically(
            1,
            '[{"id":1,"expected_updated_at":"2026-09-05T06:00:01Z"}]'::jsonb
          )`,
        );
      } catch (error) {
        caught = error instanceof Error ? error : new Error(String(error));
        assert.equal((error as { code?: string }).code, "42501");
      } finally {
        await denied.query("reset role");
      }
      assert.ok(caught, `${role} must be denied RPC execution`);
      assert.match(caught.message, /admin_publish_topics_atomically/u);
    } finally {
      await closeClient(denied);
    }
  }

  console.log(
    "PASS PostgreSQL 17 catalog/ACL: one postgres-owned VOLATILE SECURITY INVOKER overload, empty search_path, owner/service_role-only EXECUTE, actual anon/authenticated SQLSTATE 42501, and minimal fixture privileges.",
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
    await admin.query<{ tables: number; rpc_overloads: number }>(`
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
            and procedure.proname = 'admin_publish_topics_atomically'
        ) as rpc_overloads
    `)
  ).rows[0];
  assert.deepEqual(
    existingObjects,
    { tables: 0, rpc_overloads: 0 },
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
      id bigserial primary key,
      actor_admin_user_id bigint
        references public.admin_users(id) on delete set null,
      actor_username text not null,
      action text not null,
      entity_type text,
      entity_id bigint,
      entity_label text,
      metadata jsonb not null default '{}'::jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz not null default pg_catalog.now()
    );

    create table public.topics (
      id bigint primary key,
      status text not null,
      published_at timestamptz,
      published_by bigint,
      updated_by bigint,
      updated_at timestamptz not null,
      deleted_at timestamptz,
      title text not null,
      slug text not null,
      excerpt text not null,
      content text not null,
      image text not null,
      category text not null,
      category_slug text not null,
      content_type text not null,
      seo_title text not null,
      seo_description text not null,
      focus_keyword text not null,
      og_image_alt text not null,
      faq jsonb not null,
      media_payload jsonb
    );
  `);

  await admin.query(adminUsersActiveInvariantMigration);
  await listener.query("listen pgrst");
  const notification = waitForNotification(listener, "pgrst");
  try {
    await admin.query(migration);
    assert.equal(await notification, "reload schema");
  } catch (error) {
    void notification.catch(() => undefined);
    throw error;
  }

  await admin.query(`
    grant usage on schema public to anon, authenticated, service_role;
    grant select(id, username, is_active)
      on table public.admin_users to service_role;
    grant update(updated_at) on table public.admin_users to service_role;
    grant select(id, title, status, published_at, updated_at, deleted_at)
      on table public.topics to service_role;
    grant update(status, published_at, published_by, updated_by, updated_at)
      on table public.topics to service_role;
    grant insert(
      actor_admin_user_id, actor_username, action, entity_type, entity_id,
      entity_label, metadata, created_at
    ) on table public.admin_audit_logs to service_role;
    grant select(id) on table public.admin_audit_logs to service_role;
    grant usage on sequence public.admin_audit_logs_id_seq to service_role;
  `);

  await verifyCatalogAndAcl(admin);
  const deadlocksBefore = await deadlockCount(observer);
  await verifyReverseOrderBatches(admin, observer);
  await verifyWriterRevisionConflict(admin, observer);
  await verifyConcurrentActorDisable(admin, observer);
  await verifyInjectedRowFailureRollback(admin);
  await verifyTransactionalAuditAndInputContracts(admin);
  const deadlocksAfter = await deadlockCount(observer);
  assert.equal(
    deadlocksAfter,
    deadlocksBefore,
    "PostgreSQL recorded a deadlock during the multi-session proof",
  );

  console.log(
    `PASS verify-topics-bulk-publish-postgres17 (PostgreSQL ${identity.version_num}; transactional pgrst notification; catalog/ACL; four real multi-session/rollback proofs plus transactional Audit/input contracts; deadlocks delta=0).`,
  );
} finally {
  for (const client of [...connectedClients]) {
    await closeClient(client).catch(() => undefined);
  }
}
