import assert from "node:assert/strict";

// The Action and list transport are isolated; the Form, cache helper, modal,
// QueryClient and active query observer are the production owners.
export const TRACKING_FORM_SETTLEMENT_ENTRY = String.raw`
import { useQuery as useSettlementQuery } from '@tanstack/react-query';
import { TrackingUpdateFormModal } from '@src/components/admin/projects/tracking/TrackingForms';
import { PROJECT_TRACKING_ENTITY_KEYS, trackingUpdatesQueryContract } from '@src/lib/admin/projects/tracking-contract';
import { normalizeAdminEntityListQuery } from '@src/lib/admin/entity-list/data-engine/contracts';
import { adminEntityListQueryKeys } from '@src/lib/admin/entity-list/data-engine/query-keys';
import { invalidateAdminEntityListCaches } from '@src/lib/admin/entity-list/data-engine/instant-mutation-cache';
const settlementKey = adminEntityListQueryKeys.query(PROJECT_TRACKING_ENTITY_KEYS.updates,
  normalizeAdminEntityListQuery(trackingUpdatesQueryContract, new URLSearchParams('project_id=1&item_id=2')));
const oldUpdate = {id:3,item_id:2,title:'Old title',body:'Old body',occurred_at:'2026-09-17T00:00:00Z',publication_status:'draft',published_at:null,created_at:'2026-09-17',updated_at:'2026-09-17',media:[]};
const freshUpdate = {...oldUpdate,title:'Saved title',body:'Saved body',occurred_at:'2026-09-05T00:00:00Z',media:[
  {id:4,client_key:'00000000-0000-4000-8000-000000000004',update_id:3,media_kind:'image',public_url:'/images/venesia-5.png',poster_url:null,title:null,sort_order:0},
  {id:5,client_key:'00000000-0000-4000-8000-000000000005',update_id:3,media_kind:'video',public_url:'https://www.youtube.com/watch?v=QA-saved',poster_url:'/images/venesia-5.png',title:'Saved video',sort_order:1}
]};
function TrackingSettlementFixture({client}) {
  const [editing,setEditing] = useState(oldUpdate);
  const request = useSettlementQuery({queryKey:settlementKey,initialData:{rows:[oldUpdate]},staleTime:Infinity,retry:false,
    queryFn:()=>{window.refetches++;return new Promise((resolve,reject)=>{window.finishRefetch=()=>resolve({rows:[freshUpdate]});window.failRefetch=()=>reject(new Error('Isolated list transport failure'));});}});
  window.markStaleOnly=()=>invalidateAdminEntityListCaches(client,[PROJECT_TRACKING_ENTITY_KEYS.updates]);
  window.activeObservers=()=>client.getQueryCache().find({queryKey:settlementKey,exact:true}).getObserversCount();
  window.cacheRow=()=>client.getQueryData(settlementKey).rows[0];
  return <><button data-settlement-edit disabled={Boolean(editing)} onClick={()=>setEditing(request.data.rows[0])}>Edit latest update</button>
    <TrackingUpdateFormModal open={Boolean(editing)} update={editing??undefined} projectId={1} itemId={2}
      onClose={()=>{window.proofClosed++;window.rowAtClose=client.getQueryData(settlementKey).rows[0];setEditing(null);}}/>
  </>;
}
`;

export async function verifyTrackingFormSettlement(page, { rejectRefetch }) {
  await page.locator('input[name="title"]').waitFor();
  assert.equal(await page.evaluate(() => window.activeObservers()), 1);
  await page.evaluate(() => window.markStaleOnly());
  assert.equal(await page.evaluate(() => window.refetches), 0, "Default invalidation marks stale without refetching active queries");
  await page.locator('input[name="title"]').fill("Saved title");
  await page.locator('textarea[name="body"]').fill("Saved body");
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.calls === 1);
  await page.evaluate(() => window.finish());
  await page.waitForFunction(() => window.refetches === 1);
  assert.equal(await page.getByRole("dialog").count(), 1, "Committed write must keep its modal while active list is stale");
  assert.equal(await page.evaluate(() => window.proofClosed), 0);
  assert.equal(await page.locator('input[name="title"]').isDisabled(), true);
  assert.equal(await page.locator('button[type="submit"]').isDisabled(), true);
  assert.equal(await page.locator('[data-settlement-edit]').isDisabled(), true);
  await page.locator('button[type="submit"]').evaluate(element => element.click());
  assert.equal(await page.evaluate(() => window.calls), 1, "Settlement cannot replay a committed Action");
  if (rejectRefetch) {
    await page.evaluate(() => window.failRefetch());
    await page.waitForFunction(() => window.proofClosed === 1);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator('[data-admin-feedback-entry]').count(), 1);
    assert.ok((await page.locator('[data-admin-feedback-entry]').innerText()).includes("لا يلزم تكرار الحفظ"));
    assert.equal(await page.evaluate(() => window.rowAtClose.title), "Old title");
  } else {
    await page.evaluate(() => window.finishRefetch());
    await page.locator('[data-settlement-edit]').click();
    await page.locator('input[name="title"]').waitFor();
    assert.equal(await page.locator('input[name="update_id"]').inputValue(), "3");
    assert.equal(await page.locator('input[name="title"]').inputValue(), "Saved title");
    assert.equal(await page.locator('textarea[name="body"]').inputValue(), "Saved body");
    assert.equal(await page.locator('input[name="occurred_on"]').inputValue(), "2026-09-05");
    assert.equal(await page.locator('input[name="image_urls"]').inputValue(), "/images/venesia-5.png");
    const videos = JSON.parse(await page.locator('input[name="videos_json"]').inputValue());
    assert.equal(videos.length, 1);
    assert.equal(videos[0].url, "https://www.youtube.com/watch?v=QA-saved");
    assert.equal(videos[0].poster_url, "/images/venesia-5.png");
    assert.equal(await page.evaluate(() => window.rowAtClose.title), "Saved title");
  }
  assert.equal(await page.evaluate(() => window.calls), 1);
  assert.equal(await page.evaluate(() => window.refetches), 1);
  assert.equal(await page.evaluate(() => window.proofClosed), 1);
  return { claims: ["actual active QueryClient observer and shared Form invalidation", "default none leaves active query unfetched", "active mode blocks close/edit/duplicate submit until list settles", rejectRefetch ? "failed refetch preserves committed warning without Action replay" : "immediate reopen uses same ID with current body/date/image/video"], refetches: 1, actionCalls: 1 };
}
