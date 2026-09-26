import assert from 'node:assert/strict';
import { assertOwnedLocalHandle, type OwnedDatabaseConnection, type OwnedLocalHandle } from './lib/isolated-supabase.mts';

type Row = Record<string, unknown>;
type Contract = { key: 'id' | 'project_id' | 'key'; fields: readonly string[]; json?: readonly string[]; audit: readonly string[]; aggregate?: string; blockType?: string };
const templates: Record<string, string> = {
  content_block_templates: 'content', hero_templates: 'hero', cta_block_templates: 'cta', cards_block_templates: 'cards',
  breadcrumb_block_templates: 'breadcrumb', feed_module_templates: 'feed', featured_module_templates: 'featured',
  media_sidebar_module_templates: 'media-sidebar', media_hub_module_templates: 'media-hub',
};
const contracts: Record<string, Contract> = {
  topics: { key: 'id', fields: ['title', 'slug', 'excerpt', 'category_id', 'series_id', 'content_type', 'status', 'content', 'is_featured', 'deleted_at'], json: ['media_payload'], audit: ['topic'], aggregate: 'topic_ids' },
  topic_categories: { key: 'id', fields: ['name', 'slug', 'status', 'description', 'parent_id', 'is_active', 'deleted_at'], audit: ['topic_category'], aggregate: 'category_ids' },
  topic_series: { key: 'id', fields: ['name', 'slug', 'status', 'description', 'category_id', 'deleted_at'], audit: ['topic_series'], aggregate: 'series_ids' },
  pages: { key: 'id', fields: ['title', 'slug', 'path', 'status', 'page_type', 'is_system'], audit: ['page', 'page_composition'] },
  projects: { key: 'id', fields: ['arabic_name', 'english_name', 'code', 'slug', 'type', 'publication_status', 'featured', 'general_description', 'short_description',
    'image', 'image_alt', 'hero_image', 'hero_image_alt', 'small_box_image', 'small_box_image_alt', 'overview_main_image', 'overview_main_image_alt',
    'governorate_id', 'city_id', 'main_area_id', 'sub_area_id', 'location_label', 'location_description', 'google_maps_url', 'latitude', 'longitude', 'map_zoom',
    'overview_title', 'overview_body', 'delivery_title', 'delivery_body'], audit: ['project'] },
  project_locations: { key: 'id', fields: ['name_ar', 'name_en', 'level', 'parent_id', 'sort_order', 'is_active'], audit: ['project_location'] },
  project_tracking_profiles: { key: 'project_id', fields: ['contractor_name', 'project_receipt_date', 'license_receipt_date'], audit: ['project_tracking_profile'] },
  project_tracking_stages: { key: 'id', fields: ['project_id', 'name', 'description', 'sort_order', 'start_date', 'planned_duration_value', 'planned_duration_unit', 'is_visible'], audit: ['project_tracking_stage'] },
  project_tracking_items: { key: 'id', fields: ['stage_id', 'name', 'description', 'sort_order', 'status', 'start_date', 'completion_date', 'is_visible'], audit: ['project_tracking_item'] },
  project_tracking_updates: { key: 'id', fields: ['item_id', 'title', 'body', 'publication_status', 'occurred_at'], audit: ['project_tracking_update'] },
  url_redirects: { key: 'id', fields: ['source_path', 'destination_path', 'redirect_type', 'status', 'note'], audit: ['redirect'] },
  admin_users: { key: 'id', fields: ['username', 'email', 'full_name', 'role', 'is_active', 'session_version'], audit: ['admin_user'] },
  menus: { key: 'id', fields: ['name', 'slug', 'is_active'], audit: ['menu'] },
  site_settings: { key: 'key', fields: [], json: ['value'], audit: ['site_settings'] },
  ...Object.fromEntries(Object.entries(templates).map(([table, kind]) => [table, {
    key: 'id' as const, fields: ['name', 'slug', 'status', 'description'], json: ['config'], audit: ['content_block_template'], aggregate: 'ids', blockType: kind,
  }])),
};
const entities: Record<string, { table: string; fields: readonly string[] }> = {
  topics: { table: 'topics', fields: ['id', 'status', 'deleted_at', 'is_featured', 'updated_at'] },
  categories: { table: 'topic_categories', fields: ['id', 'status', 'deleted_at', 'is_active', 'updated_at'] },
  series: { table: 'topic_series', fields: ['id', 'status', 'deleted_at', 'updated_at'] },
  pages: { table: 'pages', fields: ['id', 'status', 'updated_at'] },
  projects: { table: 'projects', fields: ['id', 'publication_status', 'featured', 'updated_at'] },
  ...Object.fromEntries(['governorate', 'city', 'main_area', 'sub_area'].map(level => ['project_locations_' + level, { table: 'project_locations', fields: ['id', 'level', 'is_active', 'updated_at'] }])),
  project_tracking_stages: { table: 'project_tracking_stages', fields: ['id', 'project_id', 'is_visible', 'updated_at'] },
  project_tracking_items: { table: 'project_tracking_items', fields: ['id', 'stage_id', 'is_visible', 'updated_at'] },
  project_tracking_updates: { table: 'project_tracking_updates', fields: ['id', 'item_id', 'publication_status', 'updated_at'] },
  redirects: { table: 'url_redirects', fields: ['id', 'status', 'updated_at'] },
  admin_users: { table: 'admin_users', fields: ['id', 'is_active', 'session_version', 'updated_at'] },
};
const settingKeys = new Set(['admin.company', 'seo.global', 'media.settings']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function object(value: unknown): Row { assert.ok(value && typeof value === 'object' && !Array.isArray(value)); return value as Row; }
function positive(value: unknown): number { assert.ok(Number.isSafeInteger(value) && Number(value) > 0); return Number(value); }
function date(value: unknown): string { assert.equal(typeof value, 'string'); assert.ok(Number.isFinite(Date.parse(value as string))); return value as string; }
function identifiers(value: unknown, maximum: number): number[] {
  assert.ok(Array.isArray(value) && value.length > 0 && value.length <= maximum); const ids = value.map(positive);
  assert.equal(new Set(ids).size, ids.length); return ids;
}
function jsonObjectExpression(fields: readonly string[]) { return 'jsonb_build_object(' + fields.map(field => "'" + field + "',\"" + field + '\"').join(',') + ')'; }
async function readOnly<T>(handle: OwnedLocalHandle, work: (connection: OwnedDatabaseConnection) => Promise<T>) {
  return handle.withDatabaseConnection(async connection => {
    await connection.query('begin isolation level repeatable read read only');
    try { const value = await work(connection); await connection.query('commit'); return value; }
    catch (error) { await connection.query('rollback'); throw error; }
  });
}
function aggregateMatch(contract: Contract, idsParameter: string, keyParameter: string) {
  return contract.aggregate ? '(a.entity_id is null and exists(select 1 from unnest(' + idsParameter + '::bigint[]) wanted(id) where a.metadata->' + keyParameter + '::text @> jsonb_build_array(wanted.id)))' : 'false';
}
async function readAudit(connection: OwnedDatabaseConnection, contract: Contract, types: string[], ids: number[], since: string) {
  return (await connection.query('select a.id,a.action,a.entity_type,a.entity_id,a.entity_label,a.actor_admin_user_id,a.metadata from public.admin_audit_logs a where a.entity_type=any($1::text[]) and a.created_at >= $2::timestamptz and (a.entity_id=any($3::bigint[]) or ' + aggregateMatch(contract, '$3', '$4') + ') order by a.id',
    contract.aggregate ? [types, since, ids, contract.aggregate] : [types, since, ids])).rows;
}
function validateCommandReceipt(row: Row) {
  positive(Number(row.actor_admin_user_id));
  const metadata = object(row.metadata ?? {});
  if (!Object.hasOwn(metadata, 'command')) return false;
  const command = object(metadata.command), result = object(command.result);
  assert.match(String(command.id), uuid, 'Atomic receipt requires its durable command UUID.');
  assert.equal(positive(command.actorId), Number(row.actor_admin_user_id), 'Atomic receipt actor must match the audit actor.');
  assert.equal(result.ok, true); assert.equal(result.commandId, command.id);
  return true;
}
/** Resolve only the fixed account created by the existing owned Admin fixture. */
export async function readCoreFixedQaActor(connection: Pick<OwnedDatabaseConnection, 'query'>) {
  const rows = (await connection.query("select id from public.admin_users where username='qa_admin_interaction' and email='qa-admin-interaction@example.invalid' and role='admin' and is_active=true limit 2")).rows;
  assert.equal(rows.length, 1, 'The owned QA actor identity must resolve uniquely.');
  return positive(Number(rows[0].id));
}
export function assertCoreAuditActor(row: Row, expectedActorId: number) {
  assert.equal(positive(Number(row.actor_admin_user_id)), positive(expectedActorId), 'Audit actor differs from the fixed owned QA identity.');
}
function auditEvidence(row: Row, metadata?: Row) {
  return { id: row.id, action: row.action, entity_type: row.entity_type, entity_id: row.entity_id, entity_label: row.entity_label,
    actor_admin_user_id: row.actor_admin_user_id, ...(metadata ? { metadata } : {}) };
}

/** Fixed read-only checkpoints over the opaque current owned database only. */
export async function readCoreDomainCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle);
  const request = object(input); assert.match(String(request.id), uuid);
  assert.ok(request.kind === 'terminal-domain-state' || request.kind === 'terminal-trash-set');
  assert.equal(typeof request.entity, 'string'); assert.ok(Object.hasOwn(entities, request.entity as string));
  const entity = request.entity as string, selected = entities[entity], contract = contracts[selected.table];
  if (request.kind === 'terminal-trash-set') {
    assert.deepEqual(Object.keys(request).sort(), ['entity', 'id', 'kind']);
    assert.ok(['topics', 'categories', 'series'].includes(entity));
    const ids = await readOnly(handle, async connection => (await connection.query('select id from public.' + selected.table + ' where deleted_at is not null order by id')).rows.map(row => positive(Number(row.id))));
    return { id: request.id, kind: request.kind, entity, status: 'pass', observedAt: new Date().toISOString(), ids };
  }
  assert.deepEqual(Object.keys(request).sort(), ['entity', 'id', 'ids', 'kind', 'startedAt']);
  const ids = identifiers(request.ids, 3), since = date(request.startedAt);
  const result = await readOnly(handle, async connection => {
    const rows = (await connection.query('select ' + jsonObjectExpression(selected.fields) + ' as projection from public.' + selected.table + ' where id=any($1::bigint[]) order by id', [ids])).rows.map(row => object(row.projection));
    if (entity.startsWith('project_locations_')) assert.ok(rows.every(row => row.level === entity.slice('project_locations_'.length)), 'Native location checkpoint must match the requested concrete level.');
    const expectedActorId = await readCoreFixedQaActor(connection);
    const audit = await readAudit(connection, contract, [...contract.audit], ids, since);
    return { rows, expectedActorId, audit: audit.map(row => {
      assertCoreAuditActor(row, expectedActorId);
      validateCommandReceipt(row);
      const metadata = object(row.metadata ?? {}), retained: Row = {};
      for (const key of ['command', 'topic_ids', 'category_ids', 'series_ids']) if (Object.hasOwn(metadata, key)) retained[key] = metadata[key];
      return auditEvidence(row, retained);
    }) };
  });
  return { id: request.id, kind: request.kind, entity, status: 'pass', observedAt: new Date().toISOString(), ...result };
}

type ExpectedWrite = {
  table: string; id: number | string; expected: Row; deleted?: boolean;
  expectedJson?: Array<{ column: string; path: string[]; value: unknown }>;
  auditEntityType?: string; auditEntityTypes?: string[]; auditEntityLabel?: string | null;
  auditActions?: string[]; auditMetadata?: Row; auditSince?: string;
  exactAuditCount?: number; exactCommandReceiptCount?: number; aggregateAuditIds?: number[];
};
function validateWrite(raw: unknown, browserSince: string) {
  const value = object(raw) as ExpectedWrite;
  assert.equal(typeof value.table, 'string'); assert.ok(Object.hasOwn(contracts, value.table), 'Unknown native readback table.');
  const contract = contracts[value.table];
  if (contract.key === 'key') assert.ok(typeof value.id === 'string' && settingKeys.has(value.id), 'Only the three current non-secret settings namespaces are allowed.');
  else positive(value.id);
  object(value.expected);
  const fields = Object.keys(value.expected); assert.ok(fields.every(field => contract.fields.includes(field)), 'A requested saved field is outside its fixed table contract.');
  assert.ok(value.deleted === undefined || typeof value.deleted === 'boolean');
  if (value.deleted) assert.ok(fields.length === 0 && !(value.expectedJson?.length) && contract.key !== 'key', 'Deleted rows cannot also claim saved fields.');
  const projections = value.expectedJson ?? []; assert.ok(Array.isArray(projections) && projections.length <= 32);
  for (const projection of projections) {
    assert.ok(contract.json?.includes(projection.column), 'JSON projections must use the actual table JSON column.');
    assert.ok(Array.isArray(projection.path) && projection.path.length > 0 && projection.path.length <= 12);
    assert.ok(projection.path.every(key => typeof key === 'string' && /^(?:[a-zA-Z_][a-zA-Z0-9_]*|0|[1-9][0-9]*)$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)));
  }
  assert.ok(!(value.auditEntityType !== undefined && value.auditEntityTypes !== undefined), 'One audit type selector is permitted.');
  const types = value.auditEntityTypes ?? [value.auditEntityType ?? contract.audit[0]];
  assert.ok(Array.isArray(types) && types.length > 0 && new Set(types).size === types.length && types.every(type => contract.audit.includes(type)), 'Audit types must belong to this persisted domain.');
  const since = date(value.auditSince ?? browserSince); assert.ok(Date.parse(since) >= Date.parse(browserSince), 'Readback cannot attribute pre-session audit history.');
  let label = value.auditEntityLabel;
  assert.ok(label === undefined || label === null || typeof label === 'string');
  const metadata = value.auditMetadata ?? {}; object(metadata);
  if (contract.blockType) {
    const actions = value.auditActions ?? [];
    assert.ok(Array.isArray(actions) && actions.every(action => typeof action === 'string'));
    if (label === undefined) label = typeof value.expected.name === 'string' ? value.expected.name : undefined;
    if (label === null) {
      const nullLabelCommands = new Set(['content_block_template.publish', 'content_block_template.unpublish', 'content_block_template.delete']);
      assert.ok(actions.length > 0 && actions.every(action => nullLabelCommands.has(action)), 'Only declared template status/delete commands have a null audit label.');
      assert.equal(metadata.blockType, contract.blockType, 'A null-label audit must identify its actual template kind.');
    } else {
      assert.ok(typeof label === 'string' && label.length > 0, 'Shared template audit IDs require the actual authored label.');
      // Existing Content Form create/edit audits predate blockType and carry an
      // authored label. This exception never applies to library commands.
      const legacyContentForm = contract.blockType === 'content' && actions.length > 0
        && actions.every(action => ['content_block_template.create', 'content_block_template.update'].includes(action));
      if (!legacyContentForm || Object.hasOwn(metadata, 'blockType'))
        assert.equal(metadata.blockType, contract.blockType, 'Shared template audit must identify its actual module kind.');
    }
  }
  if (contract.key === 'key') assert.equal(label, value.id, 'Settings audits require their exact namespace label.');
  for (const field of ['exactAuditCount', 'exactCommandReceiptCount'] as const) if (value[field] !== undefined) assert.ok(Number.isSafeInteger(value[field]) && value[field]! >= 0);
  if (value.aggregateAuditIds !== undefined) { assert.ok(contract.aggregate); identifiers(value.aggregateAuditIds, 10); }
  assert.ok(value.auditActions === undefined || Array.isArray(value.auditActions) && value.auditActions.every(action => typeof action === 'string' && /^[a-z_]+\.[a-z_]+$/.test(action)));
  return { value, contract, fields, projections, types, since, label, metadata };
}

/** Persisted field/configuration truth and exact current-domain actor audit. */
type BrowserWrites = { status: string; startedAt: string; databaseReadback: unknown[] };
async function readExecutedWrites(handle: OwnedLocalHandle, browser: BrowserWrites) {
  assertOwnedLocalHandle(handle); const browserSince = date(browser.startedAt); assert.ok(Array.isArray(browser.databaseReadback));
  // Validate all expectations before any database access; a bad table/field
  // cannot borrow an earlier valid read as apparent partial success.
  const planned = browser.databaseReadback.map(value => validateWrite(value, browserSince)), result = [];
  // Scoped read connections do not keep the opaque main control socket active.
  // Renew only at verified closed-scope boundaries; never recover a failed handle.
  let renewedAt = 0;
  for (const plan of planned) {
    if (renewedAt === 0 || Date.now() - renewedAt >= 20_000) {
      await handle.renewDatabaseControlConnection();
      renewedAt = Date.now();
    }
    const { value, contract, fields, projections, types, since, label, metadata } = plan;
    result.push(await readOnly(handle, async connection => {
      const parameters: unknown[] = [value.id];
      const parts = [jsonObjectExpression(fields.length ? fields : [contract.key]) + ' as projection'];
      for (const [index, projection] of projections.entries()) {
        parameters.push(projection.path); const parameter = '$' + parameters.length + '::text[]';
        parts.push('"' + projection.column + '" #> ' + parameter + ' as json_' + index);
        parts.push('("' + projection.column + '" #> ' + parameter + ') is not null as json_' + index + '_present');
      }
      const rows = (await connection.query('select ' + parts.join(',') + ' from public.' + value.table + ' where "' + contract.key + '"=$1', parameters)).rows;
      assert.equal(rows.length, value.deleted ? 0 : 1, 'Native existence differs for ' + value.table + ':' + value.id);
      const actual = rows.length ? object(rows[0].projection) : null;
      if (actual) for (const [field, expected] of Object.entries(value.expected)) {
        if (value.table === 'project_tracking_updates' && field === 'occurred_at') assert.equal(Date.parse(date(actual[field])), Date.parse(date(expected)), 'The authored update instant changed.');
        else assert.deepEqual(actual[field], expected, 'Native saved field differs: ' + value.table + '.' + field);
      }
      const json = projections.map((projection, index) => {
        assert.equal(rows[0]['json_' + index + '_present'], true, 'Authored JSON path must exist, including explicit null values.');
        const actualValue = rows[0]['json_' + index]; assert.deepEqual(actualValue, projection.value, 'Native authored JSON projection differs.');
        return { column: projection.column, path: projection.path, actual: actualValue };
      });
      let audit: Row[];
      if (contract.key === 'key') audit = (await connection.query('select id,action,entity_type,entity_id,entity_label,actor_admin_user_id,metadata from public.admin_audit_logs where entity_type=any($1::text[]) and entity_id is null and entity_label=$2 and created_at >= $3::timestamptz order by id', [types, value.id, since])).rows;
      else audit = await readAudit(connection, contract, types, [value.id as number], since);
      const attributed = audit.filter(row => (label === undefined || row.entity_label === label)
        && Object.entries(metadata).every(([key, expected]) => {
          try { assert.deepEqual(object(row.metadata ?? {})[key], expected); return true; } catch { return false; }
        }));
      assert.ok(attributed.length > 0, 'Executed write must retain actual domain/label/actor-bound audit.');
      const expectedActorId = await readCoreFixedQaActor(connection);
      for (const row of attributed) assertCoreAuditActor(row, expectedActorId);
      const commandReceiptCount = attributed.filter(validateCommandReceipt).length;
      for (const action of value.auditActions ?? []) assert.ok(attributed.some(row => row.action === action), 'Expected current-domain audit action is absent: ' + action);
      if (value.exactAuditCount !== undefined) assert.equal(attributed.length, value.exactAuditCount, 'Unexpected extra or missing attributed write audit.');
      if (value.exactCommandReceiptCount !== undefined) assert.equal(commandReceiptCount, value.exactCommandReceiptCount, 'Atomic command receipt count differs.');
      if (value.aggregateAuditIds) {
        const aggregateIds = attributed.filter(row => row.entity_id === null).map(row => Number(row.id)).sort((a, b) => a - b);
        assert.deepEqual(aggregateIds, [...value.aggregateAuditIds].sort((a, b) => a - b), 'Aggregate audit must be the exact target-containing event captured by the native checkpoint.');
      }
      return { table: value.table, id: value.id, deleted: Boolean(value.deleted), actual, json, expectedActorId,
        auditSince: since, audit: attributed.map(row => auditEvidence(row)),
        ...(value.exactCommandReceiptCount !== undefined ? { commandReceiptCount: value.exactCommandReceiptCount } : {}) };
    }));
  }
  return result;
}

/** A complete successful Browser cohort is required for the passing write receipt. */
export async function verifyCoreDomainWrites(handle: OwnedLocalHandle, browser: BrowserWrites) {
  assertOwnedLocalHandle(handle);
  assert.equal(browser.status, 'pass', 'Failed Browser cohorts cannot receive a passing native write receipt.');
  return readExecutedWrites(handle, browser);
}

/** Preserve completed writes after a failed cohort without promoting the cohort. */
export async function verifyCoreExecutedWriteProjections(handle: OwnedLocalHandle, browser: BrowserWrites) {
  assertOwnedLocalHandle(handle); assert.ok(typeof browser.status === 'string' && browser.status.length > 0);
  const writes = await readExecutedWrites(handle, browser);
  return { status: 'partial-not-global-pass' as const, browserStatus: browser.status, writes, globalClosed: false as const,
    scope: 'Only the listed completed writes were checked against native fields and actor-bound audits; the Browser cohort retains its original status.' };
}
