import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import type {
  TopicsBulkPublishExpectedRevision,
  TopicsBulkPublishRpcResult,
} from "../src/lib/admin/content/topics-bulk-publish.ts";

const migration = readFileSync(
  new URL(
    "../sql/migrations/20260905090000_topics_bulk_publish_atomicity.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/^\uFEFF/u, "");

type TopicState = {
  id: bigint;
  status: string;
  published_at: string | null;
  published_by: bigint | null;
  updated_by: bigint | null;
  updated_at: string;
  deleted_at: string | null;
};

type AuditState = {
  id: number;
  actor_admin_user_id: number | null;
  actor_username: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_label: string | null;
  metadata: unknown;
  created_at: string;
};

const db = await PGlite.create();

async function resetFixtures() {
  await db.exec(`
    truncate table
      public.admin_audit_logs,
      public.topics,
      public.admin_users
    restart identity;

    insert into public.admin_users(id, username, is_active) values
      (1, 'active-admin', true),
      (2, 'inactive-admin', false);

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
      (3, 'unpublished', null, null, null, '2026-09-05T06:00:03Z', '2026-09-05T06:30:00Z',
        'Deleted Topic', 'deleted-topic', 'Deleted Excerpt', 'Deleted Content', '/deleted.jpg',
        'Deleted Category', 'deleted-category', 'article', 'Deleted SEO', 'Deleted Description',
        'deleted-keyword', 'Deleted Alt', '[]', '{}'),
      (4, 'published', '2025-01-02T03:04:05Z', 2, 2, '2026-09-05T06:00:04Z', null,
        'Published Topic', 'published-topic', 'Published Excerpt', 'Published Content', '/published.jpg',
        'Published Category', 'published-category', 'article', 'Published SEO', 'Published Description',
        'published-keyword', 'Published Alt', '[]', '{}'),
      (5, 'unpublished', null, null, null, '2026-09-05T06:00:05Z', null,
        '', '', '', '', '', '', '', 'article', '', '', '', '', '[]', null);
  `);
}

async function auditStates(): Promise<AuditState[]> {
  const result = await db.query<{
    id: bigint;
    actor_admin_user_id: bigint | null;
    actor_username: string;
    action: string;
    entity_type: string | null;
    entity_id: bigint | null;
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

async function topicStates(ids: number[]) {
  const result = await db.query<TopicState>(
    `select
        id,
        status,
        published_at::text as published_at,
        published_by,
        updated_by,
        updated_at::text as updated_at,
        deleted_at::text as deleted_at
       from public.topics
      where id = any($1::bigint[])
      order by id`,
    [ids],
  );
  return result.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    published_by: row.published_by === null ? null : Number(row.published_by),
    updated_by: row.updated_by === null ? null : Number(row.updated_by),
  }));
}

async function publishInputs(
  ids: number[],
): Promise<TopicsBulkPublishExpectedRevision[]> {
  const states = await topicStates(ids);
  assert.equal(states.length, ids.length);
  const revisionById = new Map(
    states.map((state) => [state.id, state.updated_at]),
  );
  return ids.map((id) => ({
    id,
    expected_updated_at: String(revisionById.get(id)),
  }));
}

async function callPublish(
  actorId: number,
  topics: unknown,
) {
  await db.exec("set role service_role");
  try {
    const result = await db.query<{ payload: TopicsBulkPublishRpcResult }>(
      `select public.admin_publish_topics_atomically($1, $2::jsonb) as payload`,
      [actorId, JSON.stringify(topics)],
    );
    assert.equal(result.rows.length, 1);
    return result.rows[0].payload;
  } finally {
    await db.exec("reset role");
  }
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.admin_users (
      id bigint primary key,
      username text not null unique,
      is_active boolean not null,
      updated_at timestamptz not null default pg_catalog.now()
    );

    create table public.admin_audit_logs (
      id bigserial primary key,
      actor_admin_user_id bigint references public.admin_users(id) on delete set null,
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

  await db.exec(migration);
  await db.exec(`
    grant usage on schema public to service_role;
    grant select(id, username, is_active) on public.admin_users to service_role;
    grant update(updated_at) on public.admin_users to service_role;
    grant select(id, title, status, published_at, updated_at, deleted_at)
      on public.topics to service_role;
    grant update(status, published_at, published_by, updated_by, updated_at)
      on public.topics to service_role;
    grant insert(
      actor_admin_user_id, actor_username, action, entity_type, entity_id,
      entity_label, metadata, created_at
    ) on public.admin_audit_logs to service_role;
    grant select(id) on public.admin_audit_logs to service_role;
    grant usage on sequence public.admin_audit_logs_id_seq to service_role;
  `);

  // 1. Every row in a valid batch publishes in one call.
  await resetFixtures();
  await db.exec(`
    update public.topics
    set published_at = '2025-01-02T03:04:05Z'
    where id = 1;
  `);
  const firstPublicationTime = (await topicStates([1]))[0].published_at;
  const successInput = await publishInputs([2, 1]);
  const success = await callPublish(1, successInput);
  assert.equal(
    success.ok,
    true,
    JSON.stringify({ success, successInput }),
  );
  if (!success.ok) assert.fail("Expected the complete batch to publish.");
  assert.equal(success.code, "published");
  assert.deepEqual(success.requestedIds, [1, 2]);
  assert.deepEqual(success.publishedIds, [1, 2]);
  assert.deepEqual(success.alreadyPublishedIds, []);
  assert.equal(success.auditIds.length, 2);
  const publishedBatch = await topicStates([1, 2]);
  assert.ok(publishedBatch.every((topic) => topic.status === "published"));
  assert.ok(publishedBatch.every((topic) => topic.published_at !== null));
  assert.equal(publishedBatch[0].published_at, firstPublicationTime);
  assert.ok(publishedBatch.every((topic) => topic.published_by === 1));
  assert.ok(publishedBatch.every((topic) => topic.updated_by === 1));
  assert.ok(
    publishedBatch.every(
      (topic) =>
        new Date(topic.updated_at).getTime() ===
        new Date(success.committedAt).getTime(),
    ),
  );
  const successAudits = await auditStates();
  assert.deepEqual(
    successAudits.map((audit) => ({
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
        id: success.auditIds[0],
        actor_admin_user_id: 1,
        actor_username: "active-admin",
        action: "topic.publish",
        entity_type: "topic",
        entity_id: 1,
        entity_label: "Topic One",
        metadata: { atomic: true, operation: "bulk_publish" },
      },
      {
        id: success.auditIds[1],
        actor_admin_user_id: 1,
        actor_username: "active-admin",
        action: "topic.publish",
        entity_type: "topic",
        entity_id: 2,
        entity_label: "Topic Two",
        metadata: { atomic: true, operation: "bulk_publish" },
      },
    ],
  );
  assert.ok(
    successAudits.every(
      (audit) =>
        new Date(audit.created_at).getTime() ===
        new Date(success.committedAt).getTime(),
    ),
  );

  // 2. A database failure on one target rolls the complete update back.
  await resetFixtures();
  const beforeRejectedBatch = await topicStates([1, 2]);
  await db.exec(`
    create or replace function public.reject_second_topic_publish_fixture()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
      if new.id = 2 and new.status = 'published' then
        raise exception using message = 'reject_second_topic_publish_fixture';
      end if;
      return new;
    end;
    $function$;

    create trigger reject_second_topic_publish_fixture
    before update of status on public.topics
    for each row execute function public.reject_second_topic_publish_fixture();
  `);
  await assert.rejects(
    async () => callPublish(1, await publishInputs([1, 2])),
    /reject_second_topic_publish_fixture/u,
  );
  assert.deepEqual(await topicStates([1, 2]), beforeRejectedBatch);
  assert.deepEqual(await auditStates(), []);
  await db.exec(`
    drop trigger reject_second_topic_publish_fixture on public.topics;
    drop function public.reject_second_topic_publish_fixture();
  `);

  // 3. Failure of any canonical Audit row rolls back Topics and all Audit rows.
  await resetFixtures();
  const beforeRejectedAuditBatch = await topicStates([1, 2]);
  await db.exec(`
    create or replace function public.reject_second_topic_audit_fixture()
    returns trigger
    language plpgsql
    set search_path = ''
    as $function$
    begin
      if new.action = 'topic.publish' and new.entity_id = 2 then
        raise exception using message = 'reject_second_topic_audit_fixture';
      end if;
      return new;
    end;
    $function$;

    create trigger reject_second_topic_audit_fixture
    before insert on public.admin_audit_logs
    for each row execute function public.reject_second_topic_audit_fixture();
  `);
  await assert.rejects(
    async () => callPublish(1, await publishInputs([1, 2])),
    /reject_second_topic_audit_fixture/u,
  );
  assert.deepEqual(await topicStates([1, 2]), beforeRejectedAuditBatch);
  assert.deepEqual(await auditStates(), []);
  await db.exec(`
    drop trigger reject_second_topic_audit_fixture on public.admin_audit_logs;
    drop function public.reject_second_topic_audit_fixture();
  `);

  // 4. Missing and deleted Topics have distinct domain results.
  await resetFixtures();
  const beforeUnavailableBatch = await topicStates([1, 2, 3]);
  const missing = await callPublish(1, [
    { id: 1, expected_updated_at: "2020-01-01T00:00:00Z" },
    { id: 999, expected_updated_at: "2026-09-05T06:00:00Z" },
  ]);
  assert.deepEqual(missing, {
    ok: false,
    code: "missing_topics",
    topicIds: [999],
  });
  const deleted = await callPublish(1, await publishInputs([3]));
  assert.deepEqual(deleted, {
    ok: false,
    code: "deleted_topics",
    topicIds: [3],
  });
  assert.deepEqual(await topicStates([1, 2, 3]), beforeUnavailableBatch);
  assert.deepEqual(await auditStates(), []);

  // 5. Any stale revision rejects the complete batch without a write.
  await resetFixtures();
  const beforeConflictBatch = await topicStates([1, 2]);
  const conflictingInput = await publishInputs([1, 2]);
  conflictingInput[1] = {
    ...conflictingInput[1],
    expected_updated_at: "2020-01-01T00:00:00Z",
  };
  assert.deepEqual(await callPublish(1, conflictingInput), {
    ok: false,
    code: "revision_conflict",
    topicIds: [2],
  });
  assert.deepEqual(await topicStates([1, 2]), beforeConflictBatch);
  assert.deepEqual(await auditStates(), []);

  // 6. Duplicate IDs are rejected at the RPC boundary without silent dedupe.
  await resetFixtures();
  const duplicateInput = await publishInputs([1]);
  assert.deepEqual(
    await callPublish(1, [duplicateInput[0], duplicateInput[0]]),
    { ok: false, code: "duplicate_ids", duplicateIds: [1] },
  );
  assert.equal((await topicStates([1]))[0].status, "unpublished");
  assert.deepEqual(await auditStates(), []);

  // Strict input integrity also rejects empty, extra-key, and invalid revisions.
  for (const invalidInput of [
    [],
    null,
    [{ id: 1, expected_updated_at: "2026-09-05T06:00:01Z", extra: true }],
    [{ id: 1, expected_updated_at: "not-a-timestamp" }],
    [{ id: 0, expected_updated_at: "2026-09-05T06:00:01Z" }],
  ]) {
    assert.deepEqual(await callPublish(1, invalidInput), {
      ok: false,
      code: "invalid_input",
    });
  }

  // 7. The SQL boundary rejects more than the Topics contract maximum.
  const oversized = Array.from({ length: 51 }, (_, index) => ({
    id: 1_000 + index,
    expected_updated_at: "2026-09-05T06:00:01Z",
  }));
  assert.deepEqual(await callPublish(1, oversized), {
    ok: false,
    code: "batch_limit",
    limit: 50,
  });
  const oversizedWithMalformedTail = [
    ...oversized.slice(0, 50),
    { id: "invalid", expected_updated_at: "not-a-timestamp" },
  ];
  assert.deepEqual(await callPublish(1, oversizedWithMalformedTail), {
    ok: false,
    code: "batch_limit",
    limit: 50,
  });

  // 8. Re-publishing is an exact no-op that keeps the first publication state.
  await resetFixtures();
  const beforeRepublish = (await topicStates([4]))[0];
  const republished = await callPublish(1, [
    { id: 4, expected_updated_at: "2020-01-01T00:00:00Z" },
  ]);
  assert.equal(republished.ok, true);
  if (!republished.ok) assert.fail("Expected idempotent publish success.");
  assert.deepEqual(republished.requestedIds, [4]);
  assert.deepEqual(republished.publishedIds, []);
  assert.deepEqual(republished.alreadyPublishedIds, [4]);
  assert.deepEqual(republished.auditIds, []);
  const afterRepublish = (await topicStates([4]))[0];
  assert.deepEqual(afterRepublish, beforeRepublish);
  assert.deepEqual(await auditStates(), []);

  // 9. The function is volatile/invoker/empty-search-path and service-only.
  const catalog = (
    await db.query<{
      provolatile: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      service_role: boolean;
      anon: boolean;
      authenticated: boolean;
    }>(`
      select
        procedure.provolatile::text,
        procedure.prosecdef,
        procedure.proconfig,
        pg_catalog.has_function_privilege(
          'service_role',
          'public.admin_publish_topics_atomically(bigint,jsonb)',
          'execute'
        ) as service_role,
        pg_catalog.has_function_privilege(
          'anon',
          'public.admin_publish_topics_atomically(bigint,jsonb)',
          'execute'
        ) as anon,
        pg_catalog.has_function_privilege(
          'authenticated',
          'public.admin_publish_topics_atomically(bigint,jsonb)',
          'execute'
        ) as authenticated
      from pg_catalog.pg_proc as procedure
      where procedure.oid =
        'public.admin_publish_topics_atomically(bigint,jsonb)'::pg_catalog.regprocedure
    `)
  ).rows[0];
  assert.equal(catalog.provolatile, "v");
  assert.equal(catalog.prosecdef, false);
  const searchPathSetting = catalog.proconfig?.find((setting) =>
    setting.startsWith("search_path="),
  );
  assert.ok(
    searchPathSetting === "search_path=" || searchPathSetting === 'search_path=""',
    `Expected an empty search_path, received ${String(searchPathSetting)}`,
  );
  assert.deepEqual(
    {
      service_role: catalog.service_role,
      anon: catalog.anon,
      authenticated: catalog.authenticated,
    },
    { service_role: true, anon: false, authenticated: false },
  );

  for (const role of ["anon", "authenticated"] as const) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(
        db.query(
          `select public.admin_publish_topics_atomically(
            1,
            '[{"id":1,"expected_updated_at":"2026-09-05T06:00:01Z"}]'::jsonb
          )`,
        ),
        /permission denied/u,
      );
    } finally {
      await db.exec("reset role");
    }
  }

  await resetFixtures();
  const beforeInactiveActor = await topicStates([1]);
  assert.deepEqual(
    await callPublish(2, await publishInputs([1])),
    { ok: false, code: "unauthorized_actor" },
  );
  assert.deepEqual(await topicStates([1]), beforeInactiveActor);

  // 10. Semantic Title/SEO/Media/FAQ/Content policy remains outside the RPC.
  const noSemanticValidation = await callPublish(
    1,
    await publishInputs([5]),
  );
  assert.equal(noSemanticValidation.ok, true);
  assert.equal((await topicStates([5]))[0].status, "published");

  const definition = String(
    (
      await db.query<{ definition: string }>(`
        select pg_catalog.pg_get_functiondef(
          'public.admin_publish_topics_atomically(bigint,jsonb)'::pg_catalog.regprocedure
        ) as definition
      `)
    ).rows[0]?.definition ?? "",
  ).toLowerCase();
  assert.match(definition, /order by topic\.id\s+for update of topic/u);
  assert.equal(
    definition.match(/update public\.topics/gu)?.length,
    1,
    "The RPC must contain one set-based Topics UPDATE.",
  );
  assert.equal(
    definition.match(/topic\.title/gu)?.length,
    1,
    "Topic title may be read only as the canonical Audit entity label.",
  );
  for (const semanticField of [
    "seo_title",
    "seo_description",
    "media_payload",
    "faq",
    "content",
    "image",
  ]) {
    assert.doesNotMatch(
      definition,
      new RegExp(`\\b${semanticField}\\b`, "u"),
      `The RPC must not own ${semanticField} validation.`,
    );
  }

  console.log(
    "Topics bulk publish PostgreSQL proof passed (transactional per-Topic Audit and rollback, duplicate/missing/deleted contracts, exact already-published no-op, revisions, strict bounds, ACL/actor, semantic-owner separation).",
  );
} finally {
  await db.close();
}
