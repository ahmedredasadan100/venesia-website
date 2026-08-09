import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(
  "sql/migrations/20260808120000_taxonomy_lifecycle_contract.sql",
  "utf8",
).replace(/^\uFEFF/u, "");

type JsonPayload = {
  affected_count: number;
  affected_ids: number[];
};

type CategoryState = {
  id: number;
  slug: string;
  status: string;
  is_active: boolean;
  deleted_at: string | null;
};

type SeriesState = {
  id: number;
  slug: string;
  status: string;
  deleted_at: string | null;
};

function idArray(ids: number[]) {
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => Number.isInteger(id) && id > 0));
  return `array[${ids.join(",")}]::bigint[]`;
}

async function expectError(
  action: () => Promise<unknown>,
  expected: RegExp,
) {
  let error: unknown = null;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `Expected database error matching ${expected}`);
  assert.match(error instanceof Error ? error.message : String(error), expected);
}

const db = await PGlite.create();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create table public.admin_users (
      id bigint primary key
    );

    create table public.topic_categories (
      id bigint primary key,
      name text not null,
      slug text not null unique,
      description text,
      sort_order integer not null default 0,
      is_active boolean not null default false,
      parent_id bigint references public.topic_categories(id),
      status text not null default 'unpublished',
      color_token text,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.topic_series (
      id bigint primary key,
      name text not null,
      slug text not null unique,
      status text not null default 'unpublished',
      sort_order integer not null default 0,
      category_id bigint not null references public.topic_categories(id),
      deleted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table public.topics (
      id bigint primary key,
      category_id bigint references public.topic_categories(id),
      category_slug text,
      series_id bigint references public.topic_series(id),
      series_slug text,
      deleted_at timestamptz
    );

    insert into public.admin_users(id) values (1);

    insert into public.topic_categories(
      id, name, slug, is_active, status, parent_id
    ) values
      (1, 'Empty Category', 'cat-empty', true, 'published', null),
      (2, 'Topic Category', 'cat-topic', true, 'published', null),
      (3, 'Series Category', 'cat-series', true, 'published', null),
      (4, 'Parent Category', 'cat-parent', true, 'published', null),
      (5, 'Child Category', 'cat-child', true, 'published', 4),
      (6, 'Category Conflict', 'cat-conflict', true, 'published', null),
      (7, 'Category Permanent', 'cat-permanent', true, 'published', null),
      (8, 'Category Bulk A', 'cat-bulk-a', true, 'published', null),
      (9, 'Category Bulk B', 'cat-bulk-b', true, 'published', null),
      (10, 'Category Control', 'cat-control', true, 'published', null),
      (11, 'Series Owner Category', 'cat-series-owner', true, 'published', null),
      (12, 'Series Restore Category', 'cat-series-restore', true, 'published', null),
      (13, 'Restore Parent', 'cat-restore-parent', true, 'published', null),
      (14, 'Restore Child', 'cat-restore-child', true, 'published', 13);

    insert into public.topic_series(
      id, name, slug, status, category_id
    ) values
      (101, 'Empty Series', 'series-empty', 'published', 11),
      (102, 'Linked Series', 'series-linked', 'published', 11),
      (103, 'Series Control', 'series-control', 'published', 11),
      (104, 'Series Permanent', 'series-permanent', 'published', 11),
      (105, 'Series Bulk A', 'series-bulk-a', 'published', 11),
      (106, 'Series Bulk B', 'series-bulk-b', 'published', 11),
      (107, 'Series Conflict', 'series-conflict', 'published', 11),
      (108, 'Series Restore Relation', 'series-restore-relation', 'published', 12),
      (109, 'Category Dependency', 'series-category-dependency', 'published', 3);

    insert into public.topics(
      id, category_id, category_slug, series_id, series_slug
    ) values
      (201, 2, 'cat-topic', null, null),
      (202, 11, 'cat-series-owner', 102, 'series-linked');
  `);

  await db.exec(migration);

  async function categoryState(id: number) {
    const result = await db.query<CategoryState>(
      `select id, slug, status, is_active, deleted_at
         from public.topic_categories where id = $1`,
      [id],
    );
    assert.equal(result.rows.length, 1);
    return result.rows[0];
  }

  async function seriesState(id: number) {
    const result = await db.query<SeriesState>(
      `select id, slug, status, deleted_at
         from public.topic_series where id = $1`,
      [id],
    );
    assert.equal(result.rows.length, 1);
    return result.rows[0];
  }

  async function lifecycleRpc(name: string, ids: number[]) {
    assert.match(
      name,
      /^admin_(?:move_topic_(?:categories|series)_to_trash|restore_topic_(?:categories|series)|permanently_delete_topic_(?:categories|series))$/,
    );
    const result = await db.query<{ payload: JsonPayload }>(
      `select public.${name}(${idArray(ids)}, 1) as payload`,
    );
    assert.equal(result.rows.length, 1);
    return result.rows[0].payload;
  }

  async function categoryIds(view: "active" | "trash") {
    const result = await db.query<{ payload: { rows: Array<{ id: number }> } }>(
      `select public.admin_list_categories(
        1, 50, 'name', 'asc', '', 'all', $1
      ) as payload`,
      [view],
    );
    return result.rows[0].payload.rows.map((row) => Number(row.id));
  }

  async function seriesIds(view: "active" | "trash") {
    const result = await db.query<{ payload: { rows: Array<{ id: number }> } }>(
      `select public.admin_list_series(
        1, 50, 'name', 'asc', '', 'all', null, $1
      ) as payload`,
      [view],
    );
    return result.rows[0].payload.rows.map((row) => Number(row.id));
  }

  assert.ok((await categoryIds("active")).includes(1));
  assert.deepEqual(await categoryIds("trash"), []);
  assert.ok((await seriesIds("active")).includes(101));
  assert.deepEqual(await seriesIds("trash"), []);

  assert.deepEqual(
    await lifecycleRpc("admin_move_topic_categories_to_trash", [1]),
    { affected_count: 1, affected_ids: [1] },
  );
  assert.ok(!(await categoryIds("active")).includes(1));
  assert.ok((await categoryIds("trash")).includes(1));
  await expectError(
    () =>
      db.query(
        "insert into public.topic_categories(id,name,slug) values(51,'Duplicate','cat-empty')",
      ),
    /duplicate key|unique/i,
  );
  await lifecycleRpc("admin_restore_topic_categories", [1]);
  assert.deepEqual(
    await categoryState(1),
    {
      id: 1,
      slug: "cat-empty",
      status: "unpublished",
      is_active: false,
      deleted_at: null,
    },
  );

  for (const [id, message] of [
    [2, /categories still have linked topics/],
    [3, /categories still have linked series/],
    [4, /categories still have child categories/],
  ] as const) {
    await expectError(
      () => lifecycleRpc("admin_move_topic_categories_to_trash", [id]),
      message,
    );
    assert.equal((await categoryState(id)).deleted_at, null);
  }

  await lifecycleRpc("admin_move_topic_categories_to_trash", [14]);
  await db.query(
    "update public.topic_categories set deleted_at = now() where id = 13",
  );
  await expectError(
    () => lifecycleRpc("admin_restore_topic_categories", [14]),
    /category restore parent is unavailable/,
  );
  await db.query(
    "update public.topic_categories set deleted_at = null where id = 13",
  );
  await lifecycleRpc("admin_restore_topic_categories", [14]);

  await lifecycleRpc("admin_move_topic_categories_to_trash", [8, 9]);
  await lifecycleRpc("admin_restore_topic_categories", [8, 9]);
  assert.equal((await categoryState(8)).status, "unpublished");
  assert.equal((await categoryState(9)).status, "unpublished");
  await lifecycleRpc("admin_move_topic_categories_to_trash", [8]);
  await expectError(
    () => lifecycleRpc("admin_permanently_delete_topic_categories", [8, 10]),
    /one or more categories are not in trash/,
  );
  assert.notEqual((await categoryState(8)).deleted_at, null);
  assert.equal((await categoryState(10)).status, "published");
  await lifecycleRpc("admin_permanently_delete_topic_categories", [8]);
  await db.query(
    "insert into public.topic_categories(id,name,slug) values(58,'Reused Category','cat-bulk-a')",
  );

  await lifecycleRpc("admin_move_topic_categories_to_trash", [6]);
  await db.exec(
    "alter table public.topic_categories drop constraint topic_categories_slug_key",
  );
  await db.query(
    "insert into public.topic_categories(id,name,slug) values(60,'Conflict Category','cat-conflict')",
  );
  await expectError(
    () => lifecycleRpc("admin_restore_topic_categories", [6]),
    /category restore slug conflict/,
  );
  await db.query("delete from public.topic_categories where id = 60");
  await lifecycleRpc("admin_permanently_delete_topic_categories", [6]);
  await db.exec(
    "alter table public.topic_categories add constraint topic_categories_slug_key unique(slug)",
  );
  await db.query(
    "insert into public.topic_categories(id,name,slug) values(61,'Released Category','cat-conflict')",
  );

  await lifecycleRpc("admin_move_topic_series_to_trash", [101]);
  assert.ok(!(await seriesIds("active")).includes(101));
  assert.ok((await seriesIds("trash")).includes(101));
  await expectError(
    () =>
      db.query(
        "insert into public.topic_series(id,name,slug,category_id) values(151,'Duplicate','series-empty',11)",
      ),
    /duplicate key|unique/i,
  );
  await lifecycleRpc("admin_restore_topic_series", [101]);
  assert.equal((await seriesState(101)).status, "unpublished");
  assert.equal((await seriesState(101)).deleted_at, null);

  await expectError(
    () => lifecycleRpc("admin_move_topic_series_to_trash", [102]),
    /series still have linked topics/,
  );
  assert.equal((await seriesState(102)).deleted_at, null);

  await lifecycleRpc("admin_move_topic_series_to_trash", [108]);
  await db.query(
    "update public.topic_categories set deleted_at = now() where id = 12",
  );
  await expectError(
    () => lifecycleRpc("admin_restore_topic_series", [108]),
    /series restore category is unavailable/,
  );
  await db.query(
    "update public.topic_categories set deleted_at = null where id = 12",
  );
  await lifecycleRpc("admin_restore_topic_series", [108]);

  await lifecycleRpc("admin_move_topic_series_to_trash", [105, 106]);
  await lifecycleRpc("admin_restore_topic_series", [105, 106]);
  assert.equal((await seriesState(105)).status, "unpublished");
  assert.equal((await seriesState(106)).status, "unpublished");
  await lifecycleRpc("admin_move_topic_series_to_trash", [105]);
  await expectError(
    () => lifecycleRpc("admin_permanently_delete_topic_series", [105, 103]),
    /one or more series are not in trash/,
  );
  assert.notEqual((await seriesState(105)).deleted_at, null);
  assert.equal((await seriesState(103)).status, "published");
  await lifecycleRpc("admin_permanently_delete_topic_series", [105]);
  await db.query(
    "insert into public.topic_series(id,name,slug,category_id) values(155,'Reused Series','series-bulk-a',11)",
  );

  await lifecycleRpc("admin_move_topic_series_to_trash", [107]);
  await db.exec(
    "alter table public.topic_series drop constraint topic_series_slug_key",
  );
  await db.query(
    "insert into public.topic_series(id,name,slug,category_id) values(160,'Conflict Series','series-conflict',11)",
  );
  await expectError(
    () => lifecycleRpc("admin_restore_topic_series", [107]),
    /series restore slug conflict/,
  );
  await db.query("delete from public.topic_series where id = 160");
  await lifecycleRpc("admin_permanently_delete_topic_series", [107]);
  await db.exec(
    "alter table public.topic_series add constraint topic_series_slug_key unique(slug)",
  );
  await db.query(
    "insert into public.topic_series(id,name,slug,category_id) values(161,'Released Series','series-conflict',11)",
  );

  await expectError(
    () => lifecycleRpc("admin_permanently_delete_topic_series", [103]),
    /one or more series are not in trash/,
  );
  await lifecycleRpc("admin_move_topic_series_to_trash", [104]);
  await lifecycleRpc("admin_permanently_delete_topic_series", [104]);
  await db.query(
    "insert into public.topic_series(id,name,slug,category_id) values(164,'Released Permanent Series','series-permanent',11)",
  );

  console.log(
    "Taxonomy lifecycle PostgreSQL fixtures passed (active/trash scopes, slug reservation/conflict/release, restore validity, relation blocking, atomic bulk restore/delete).",
  );
} finally {
  await db.close();
}
