import assert from 'node:assert/strict';
import { assertOwnedLocalHandle, type OwnedLocalHandle } from './lib/isolated-supabase.mts';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** Read-only fixed projections for the current owned Hub journeys. */
export async function readCoreReadonlyHubCheckpoint(handle: OwnedLocalHandle, input: unknown) {
  assertOwnedLocalHandle(handle);
  assert.ok(input && typeof input === 'object' && !Array.isArray(input));
  const request = input as Record<string, unknown>;
  assert.equal(typeof request.id, 'string'); assert.match(request.id as string, uuid); assert.equal(request.kind, 'readonly-hub-state');
  assert.ok(typeof request.entity === 'string' && ['projects', 'tracking', 'dashboard', 'analytics'].includes(request.entity));
  const keys = request.entity === 'tracking' ? ['id', 'kind', 'entity', 'projectId'] : request.entity === 'analytics' ? ['id', 'kind', 'entity', 'period', 'compare'] : ['id', 'kind', 'entity'];
  assert.deepEqual(Object.keys(request).sort(), keys.sort());
  if (request.entity === 'tracking') assert.ok(Number.isSafeInteger(request.projectId) && Number(request.projectId) > 0);
  if (request.entity === 'analytics') {
    assert.ok(typeof request.period === 'string' && ['last_30_days', 'last_90_days'].includes(request.period));
    assert.ok(typeof request.compare === 'string' && ['none', 'previous_period', 'previous_year'].includes(request.compare));
  }
  const value = await handle.withDatabaseConnection(async connection => {
    await connection.query('begin isolation level repeatable read read only');
    let committed = false;
    try {
      await connection.query("set local statement_timeout='10000ms'");
      const identity = (await connection.query("select current_database() database,current_setting('transaction_read_only') readonly,current_setting('transaction_isolation') isolation")).rows[0];
      assert.equal(identity.database, 'postgres'); assert.equal(identity.readonly, 'on'); assert.equal(identity.isolation, 'repeatable read');
      let result: unknown;
      if (request.entity === 'projects') result = (await connection.query("select jsonb_build_object('residential',count(*) filter(where type='residential'),'commercial',count(*) filter(where type='commercial')) value from public.projects")).rows[0].value;
      else if (request.entity === 'tracking') {
        const rows = (await connection.query("select jsonb_build_object('id',p.id,'title',p.arabic_name,'stageCount',(select count(*) from public.project_tracking_stages s where s.project_id=p.id),'updateCount',(select count(*) from public.project_tracking_updates u join public.project_tracking_items i on i.id=u.item_id join public.project_tracking_stages s on s.id=i.stage_id where s.project_id=p.id)) value from public.projects p where p.id=$1", [request.projectId])).rows;
        assert.equal(rows.length, 1, 'The requested owned tracking fixture must exist.'); result = rows[0].value;
      } else if (request.entity === 'dashboard') result = (await connection.query("select coalesce(jsonb_agg(jsonb_build_object('id',item->'id','title',item->'title','status',item->'status') order by ordinal),'[]'::jsonb) value from jsonb_array_elements(public.admin_dashboard_truth_v1()->'recentTopics') with ordinality as recent(item,ordinal)")).rows[0].value;
      else result = (await connection.query("select jsonb_build_object('period',$1::text,'compare',$2::text,'storedReadModelCount',count(*)) value from public.analytics_provider_read_models where period_key=$1::text and compare_key=$2::text", [request.period, request.compare])).rows[0].value;
      await connection.query('commit'); committed = true; return result;
    } finally { if (!committed) await connection.query('rollback'); }
  });
  assertOwnedLocalHandle(handle);
  return { id: request.id, kind: request.kind, entity: request.entity, status: 'pass', ownedRunId: handle.identity.runId, value,
    boundary: 'Fixed owned public read projections only; no credential, provider payload, Auth/Storage schema, arbitrary SQL or external request.' };
}
