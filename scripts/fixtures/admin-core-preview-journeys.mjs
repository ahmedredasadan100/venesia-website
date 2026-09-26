import assert from "node:assert/strict";
import { expect } from "playwright/test";

// Fixed verification adapters for the current canonical Preview consumers.
// The authoritative matrix comes from the existing adoption driver; a new
// consumer or state fails coverage validation until its real contract is added.
const CONTRACTS = {
  "topic-article-edit-preview-public": { table: "topics", kind: "article", collection: "topics", editor: true, publicArticle: true },
  "topic-media-edit-preview": { table: "topics", kind: "news", collection: "topics", editor: true, publicArticle: false },
  "topic-category-collection-preview": { table: "topic_categories", kind: "category", collection: "categories", editor: false, publicCategory: true },
  "topic-series-collection-preview": { table: "topic_series", kind: "series", collection: "series", editor: false, publicCategory: false },
};
const PUBLICATIONS = ["published", "unpublished", "deleted"];
const SESSIONS = ["authorized", "revoked"];
const fixtureKey = row => `${row.consumer}:${row.publication}`;
const cellKey = row => `${fixtureKey(row)}:${row.session}`;

function validateFixturePlan(fixtures, previewMatrix) {
  assert.ok(Array.isArray(previewMatrix), "The canonical Preview matrix is required.");
  const consumers = [...new Set(previewMatrix.map(row => row.consumer))].sort();
  assert.deepEqual(consumers, Object.keys(CONTRACTS).sort(), "Preview verification adapters must cover the current canonical consumer inventory exactly.");
  const expected = consumers.flatMap(consumer => PUBLICATIONS.flatMap(publication => SESSIONS.map(session => cellKey({ consumer, publication, session })))).sort();
  assert.deepEqual(previewMatrix.map(cellKey).sort(), expected, "Every canonical publication/session cell must occur exactly once.");
  assert.ok(Array.isArray(fixtures.previewClosure), "The owned native fixture preparer must supply previewClosure.");
  const rows = fixtures.previewClosure;
  assert.deepEqual(rows.map(fixtureKey).sort(), consumers.flatMap(consumer => PUBLICATIONS.map(publication => fixtureKey({ consumer, publication }))).sort(), "Preview fixtures must cover every canonical consumer/publication pair exactly once.");
  const physicalRows = new Set();
  for (const row of rows) {
    assert.equal(row.table, CONTRACTS[row.consumer].table, "Fixture table must match the actual consumer contract.");
    assert.ok(Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0, "A physical persisted fixture ID is required.");
    assert.equal(row.kind, CONTRACTS[row.consumer].kind, "Fixture kind must match the native-validated concrete consumer.");
    assert.ok(typeof row.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.slug), "A canonical fixture slug is required.");
    const label = CONTRACTS[row.consumer].editor ? row.title : row.name;
    assert.ok(typeof label === "string" && label.trim().length > 0, "The physical fixture label is required.");
    const physicalKey = `${row.table}:${Number(row.id)}`;
    assert.ok(!physicalRows.has(physicalKey), "Each state needs a distinct physical fixture; relabelling the same row is not state proof.");
    physicalRows.add(physicalKey);
  }
  return rows;
}

function collectionPath(row) {
  const contract = CONTRACTS[row.consumer];
  const label = contract.editor ? row.title : row.name;
  const search = `?q=${encodeURIComponent(label)}${row.publication === "deleted" ? "&view=trash" : ""}`;
  return `/admin/content/${contract.collection}${search}`;
}
function destinationPath(row) {
  const contract = CONTRACTS[row.consumer];
  if (contract.editor) return `/admin/content/topics/${Number(row.id)}/preview`;
  return contract.publicCategory ? `/topics?category=${encodeURIComponent(row.slug)}` : `/admin/content/topics?series=${Number(row.id)}`;
}
function consumerPath(row) {
  return CONTRACTS[row.consumer].editor ? `/admin/content/topics/${Number(row.id)}` : collectionPath(row);
}
function publicPath(row) {
  const contract = CONTRACTS[row.consumer];
  return contract.publicArticle ? `/topics/${encodeURIComponent(row.slug)}` : contract.publicCategory ? destinationPath(row) : null;
}


/** A bounded affected public-read supplement; this is not a full Preview-cell replay. */
export const CORE_PREVIEW_PUBLIC_IMPACT_SELECTION = "preview-public-impact";
export function validateCorePreviewPublicImpactSelection({scope,cohort,selection}) {
  if(selection === undefined || selection === null) return null;
  assert.equal(scope,"core-closure"); assert.equal(cohort,"preview-recovery-templates");
  assert.equal(selection,CORE_PREVIEW_PUBLIC_IMPACT_SELECTION); return selection;
}
export function buildCorePreviewPublicImpactPlan({fixtures,previewMatrix}) {
  const rows=validateFixturePlan(fixtures,previewMatrix).filter(row=>publicPath(row)!==null);
  const observations=rows.flatMap(row=>SESSIONS.map(session=>({
    consumer:row.consumer,publication:row.publication,session,
    fixture:{table:row.table,id:Number(row.id),kind:row.kind,slug:row.slug,expectedPublication:row.publication},
    path:publicPath(row),publicState:CONTRACTS[row.consumer].publicArticle&&row.publication!=="published"?"missing-record":"public-document",
  })));
  assert.equal(rows.length,6); assert.equal(observations.length,12);
  const authorizedJourneyIds=rows.map(row=>"core-preview-public-impact-"+CONTRACTS[row.consumer].collection+"-"+row.id+"-"+row.publication+"-authorized");
  return {selection:CORE_PREVIEW_PUBLIC_IMPACT_SELECTION,rows,observations,journeyIds:[...authorizedJourneyIds,"core-preview-public-impact-revoked"],
    protectedWitnesses:rows.flatMap(row=>[...new Set([consumerPath(row),destinationPath(row)].filter(value=>value.startsWith("/admin/")))].map(value=>({fixture:{table:row.table,id:Number(row.id),kind:row.kind,slug:row.slug,expectedPublication:row.publication},path:value,rejectedToExistingLogin:true}))) };
}
/** Pure strict join. Canonical inventory stays complete and every ledger cell remains open.
 * @param {object} browser
 * @param {{fixtures:object,previewMatrix:object[],canonicalRequiredCases:object[],nativeBefore?:{status:string,stage:string,ownedRunId:string,reads:object[]}|null,nativeAfter?:{status:string,stage:string,ownedRunId:string,reads:object[]}|null,ownedRunId?:string|null,sourceSha256?:string}} input
 */
export function assertCorePreviewPublicImpactReceipt(browser,{fixtures,previewMatrix,canonicalRequiredCases,nativeBefore=null,nativeAfter=null,ownedRunId=null,sourceSha256=browser.sourceSha256}) {
  assert.equal(validateCorePreviewPublicImpactSelection({scope:browser.scope,cohort:browser.cohort,selection:browser.journeySelection}),CORE_PREVIEW_PUBLIC_IMPACT_SELECTION);
  const plan=buildCorePreviewPublicImpactPlan({fixtures,previewMatrix});
  const identities=rows=>{assert.ok(Array.isArray(rows)&&rows.length>0);assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);return rows.map(row=>{const identity={...row};delete identity.status;delete identity.evidence;return identity;}).sort((a,b)=>a.key.localeCompare(b.key));};
  assert.deepEqual(identities(browser.requiredCases),identities(canonicalRequiredCases),"Keep the full canonical open-cell universe.");
  assert.ok(browser.requiredCases.every(row=>row.status==="open"&&row.evidence===null),"Public-read supplement cannot close whole Preview or other ledger cells.");
  assert.equal(browser.status,"pass");assert.equal(browser.driverCompleted,true);assert.deepEqual(browser.errors,[]);
  assert.equal(browser.globalClosed,false);assert.equal(browser.wholeCohortExecuted,false);
  assert.match(sourceSha256,/^[a-f0-9]{64}$/);assert.equal(browser.sourceSha256,sourceSha256);
  assert.deepEqual(browser.selectedJourneyIds,plan.journeyIds);assert.deepEqual(browser.executedJourneyIds,plan.journeyIds);
  assert.deepEqual(browser.databaseReadback,[]);assert.deepEqual(browser.readOnlyReadback,[]);assert.deepEqual(browser.menuIntegrityReadback,[]);
  assert.deepEqual(browser.previewMatrix.map(({status,evidence,...cell})=>{assert.equal(status,"open");assert.equal(evidence,null);return cell;}),previewMatrix.map(row=>{const cell={...row};delete cell.status;delete cell.evidence;return cell;}));
  assert.deepEqual(browser.evidence.map(row=>row.id),["existing-auth-login",...plan.journeyIds]);
  assert.ok(browser.evidence.every(row=>row.status==="pass"&&Array.isArray(row.coverage)&&row.coverage.length===0&&!Object.hasOwn(row,"previewCells")));
  const login=browser.evidence[0];assert.equal(login.authenticated,true);assert.equal(login.sessionArtifactWritten,false);
  const observed=[];
  for(const [index,row] of browser.evidence.slice(1).entries()){
    assert.equal(row.nativeStateReadbackRequired,true);assert.ok(Array.isArray(row.publicPreviewObservations));
    if(index<plan.rows.length){assert.equal(row.publicPreviewObservations.length,1);assert.equal(row.publicPreviewObservations[0].session,"authorized");}
    else{assert.equal(row.publicPreviewObservations.length,plan.rows.length);assert.ok(row.publicPreviewObservations.every(value=>value.session==="revoked"));assert.equal(row.existingLogoutRevokedRetainedSignedCookie,true);assert.equal(row.cookieArtifactsWritten,false);assert.deepEqual(row.protectedWitnesses,plan.protectedWitnesses);}
    observed.push(...row.publicPreviewObservations);
  }
  const expected=[...plan.observations.filter(row=>row.session==="authorized"),...plan.observations.filter(row=>row.session==="revoked")];
  assert.equal(observed.length,expected.length);assert.equal(new Set(observed.map(cellKey)).size,expected.length);
  for(const [index,row]of observed.entries()){
    assert.deepEqual(Object.keys(row).sort(),["consumer","publication","session","fixture","path","publicState","status",...(CONTRACTS[row.consumer]?.publicCategory?["collectionDestinationNotEntityDetail"]:[])].sort());
    const {status,collectionDestinationNotEntityDetail,...identity}=row;assert.deepEqual(identity,expected[index]);
    assert.ok(Number.isSafeInteger(status)&&status>=200&&status<500);
    if(row.publicState==="public-document")assert.equal(status,200);
    if(CONTRACTS[row.consumer].publicCategory)assert.equal(collectionDestinationNotEntityDetail,true);
  }
  const summary={selection:plan.selection,consumerCount:2,physicalFixtures:6,plannedPublicObservations:12,completedPublicObservations:12,observationKeys:expected.map(cellKey),wholePreviewMatrixExecuted:false,automaticCoverage:[],globalClosed:false};
  assert.deepEqual(browser.publicPreviewImpact,summary);
  let native=null;
  assert.equal(nativeBefore===null,nativeAfter===null,"Native stages must join together.");
  if(nativeBefore!==null){
    assert.ok(typeof ownedRunId==="string"&&ownedRunId.length>0);
    for(const [stage,receipt]of [["before",nativeBefore],["after",nativeAfter]]){
      assert.equal(receipt.status,"pass");assert.equal(receipt.stage,stage);assert.equal(receipt.ownedRunId,ownedRunId);
      assert.equal(receipt.reads.length,fixtures.previewClosure.length);
      for(const [index,fixture]of fixtures.previewClosure.entries()){
        const row=receipt.reads[index];assert.deepEqual(Object.keys(row).sort(),["consumer","publication","table","id","slug","status","deleted",...(fixture.table==="topic_categories"?["is_active"]:[])].sort());
        for(const key of ["consumer","publication","table","id","slug"])assert.equal(row[key],fixture[key]);
        assert.equal(row.status,fixture.expectedStatus);assert.equal(row.deleted,fixture.expectedDeleted);
        if(fixture.expectedActive!==null)assert.equal(row.is_active,fixture.expectedActive);
      }
    }
    assert.deepEqual(nativeAfter.reads,nativeBefore.reads);
    native={ownedRunId,selectedPhysicalRows:plan.rows.map(({table,id})=>({table,id})),additionalReadOnlyRows:fixtures.previewClosure.length-plan.rows.length,unchanged:true,additionalRowsReceiveBehaviorCredit:false};
  }
  return {...summary,sourceSha256,native};
}

/** No SQL, action injection, credentials, cookie artifacts or Product hooks. */
export async function runCorePreviewJourneys(ctx) {
  const { browser, context, page, origin, fixtures, run, observe, popupProof, ownedNetworkOnly, revokeSession, previewMatrix } = ctx;
  const rows = validateFixturePlan(fixtures, previewMatrix);
  assert.equal(new URL(origin).hostname, "127.0.0.1", "Preview journeys run only on the owning isolated app.");
  assert.equal(page.context(), context, "Popup proofs must use the owning authenticated context.");
  assert.equal(typeof revokeSession, "function", "Use the existing real logout owner.");
  const completed = new Set();
  const navigate = async (surface, path, stage) => {
    const response = await observe(stage, () => surface.goto(origin + path, { waitUntil: "domcontentloaded" }));
    assert.ok(response, "A real destination response is required.");
    assert.ok(response.status() < 500, "Destination server failure is not a missing-record or access-denial proof.");
    await expect(surface.locator("body")).not.toContainText("Internal Server Error");
    return response;
  };
  const fixtureIdentity = row => ({ table: row.table, id: Number(row.id), kind: row.kind, slug: row.slug, expectedPublication: row.publication });
  const provePublic = async (surface, row, stage) => {
    const path = publicPath(row);
    assert.ok(path);
    const response = await navigate(surface, path, stage);
    assert.equal(new URL(surface.url()).pathname + new URL(surface.url()).search, path);
    assert.notEqual(new URL(surface.url()).pathname, "/admin/login");
    if (CONTRACTS[row.consumer].publicArticle && row.publication !== "published") {
      // The installed Next default public notFound boundary owns this 404 UI.
      // Streaming may already have sent 200; semantic missing UI is required.
      await expect(surface.getByRole("heading", { name: "404", exact: true })).toBeVisible();
      await expect(surface.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/u);
      await expect(surface.getByRole("heading", { name: row.title, exact: true })).toHaveCount(0);
      return { path, status: response.status(), publicState: "missing-record" };
    }
    assert.equal(response.status(), 200);
    await expect(surface.locator("main").first()).toBeVisible();
    await expect(surface.locator("h1").first()).toBeVisible();
    if (CONTRACTS[row.consumer].publicArticle) await expect(surface.getByRole("heading", { name: row.title, exact: true }).first()).toBeVisible();
    return { path, status: response.status(), publicState: "public-document", ...(CONTRACTS[row.consumer].publicCategory ? { collectionDestinationNotEntityDetail: true } : {}) };
  };


  if(ctx.journeySelection!==undefined&&ctx.journeySelection!==null){
    validateCorePreviewPublicImpactSelection({scope:"core-closure",cohort:"preview-recovery-templates",selection:ctx.journeySelection});
    const plan=buildCorePreviewPublicImpactPlan({fixtures,previewMatrix}),observations=[];
    const observation=(row,session,proof)=>({consumer:row.consumer,publication:row.publication,session,fixture:fixtureIdentity(row),...proof});
    for(const [index,row]of plan.rows.entries())await run(plan.journeyIds[index],[],async()=>{
      const item=observation(row,"authorized",await provePublic(page,row,"core-preview-impact-authorized-public-policy"));observations.push(item);
      return {publicPreviewObservations:[item],nativeStateReadbackRequired:true};
    });
    assert.equal(observations.length,plan.rows.length,"Do not revoke after an incomplete selected authorized pass.");
    await run(plan.journeyIds.at(-1),[],async()=>{
      const retainedSession=await revokeSession();assert.ok(retainedSession?.cookies?.some(cookie=>cookie.httpOnly));
      const stale=await observe("core-preview-impact-stale-context",()=>browser.newContext({storageState:retainedSession}));
      const revoked=[],protectedWitnesses=[];
      try{
        await stale.route("**/*",ownedNetworkOnly);const tab=await observe("core-preview-impact-stale-page",()=>stale.newPage());tab.setDefaultTimeout(25_000);
        for(const row of plan.rows){
          for(const path of [...new Set([consumerPath(row),destinationPath(row)].filter(value=>value.startsWith("/admin/")))]){
            await navigate(tab,path,"core-preview-impact-revoked-protected-witness");await observe("core-preview-impact-revoked-login",()=>tab.waitForURL(url=>url.pathname==="/admin/login"));
            await expect(tab.locator('input[name="username"]')).toBeVisible();await expect(tab.locator("[data-admin-entity-preview-action]")).toHaveCount(0);
            protectedWitnesses.push({fixture:fixtureIdentity(row),path,rejectedToExistingLogin:true});
          }
          revoked.push(observation(row,"revoked",await provePublic(tab,row,"core-preview-impact-revoked-public-policy")));
        }
      }finally{await observe("core-preview-impact-stale-close",()=>stale.close());}
      assert.deepEqual(protectedWitnesses,plan.protectedWitnesses);observations.push(...revoked);
      return {publicPreviewObservations:revoked,protectedWitnesses,existingLogoutRevokedRetainedSignedCookie:true,cookieArtifactsWritten:false,nativeStateReadbackRequired:true};
    });
    assert.equal(observations.length,plan.observations.length);
    return {selection:plan.selection,consumerCount:2,physicalFixtures:6,plannedPublicObservations:12,completedPublicObservations:12,observationKeys:observations.map(cellKey),wholePreviewMatrixExecuted:false,automaticCoverage:[],globalClosed:false};
  }

  // The fixtures are already validated physical states. These journeys only
  // read them; state transitions and native final readback remain with the owner.
  for (const row of rows) {
    const contract = CONTRACTS[row.consumer];
    const id = Number(row.id);
    await run(`core-preview-${contract.collection}-${id}-${row.publication}-authorized`, [], async () => {
      const observations = [];
      await navigate(page, collectionPath(row), "core-preview-collection");
      const more = page.locator(`[data-admin-row-action="more"][data-admin-entity-id="${id}"]`);
      await expect(more).toBeVisible();
      const physicalRow = page.getByRole("row").filter({ has: more });
      await expect(physicalRow).toHaveCount(1);
      if (row.publication !== "deleted") {
        const label = contract.editor ? row.title : row.name;
        const visibility = page.locator(`[data-admin-row-action="visibility"][data-admin-entity-id="${id}"] button`);
        await expect(visibility).toHaveAttribute("aria-label", `${row.publication === "published" ? "إخفاء" : "إظهار"} ${label}`);
      }
      if (contract.editor) {
        if (row.publication === "deleted") {
          for (const path of [consumerPath(row), destinationPath(row)]) {
            const response = await navigate(page, path, "core-preview-deleted-topic");
            await expect(page.getByRole("heading", { name: "صفحة الإدارة غير موجودة", exact: true })).toBeVisible();
            await expect(page.locator("[data-admin-entity-preview-action]")).toHaveCount(0);
            observations.push({ path, status: response.status(), missingRecordUi: true });
          }
        } else {
          await navigate(page, consumerPath(row), "core-preview-editor");
          await expect(page.locator('[name="title"]').first()).toHaveValue(row.title);
          await expect(page.locator('input[name="status"][data-content-publishing-options]')).toHaveValue(row.publication);
          observations.push(await popupProof(page.locator('a[data-admin-entity-preview-action="internal-preview"]'), destinationPath(row), row.title));
          const publicLink = page.locator('[data-admin-entity-preview-action="public-view"]');
          if (contract.publicArticle && row.publication === "published") observations.push(await popupProof(publicLink, publicPath(row), row.title));
          else await expect(publicLink).toHaveCount(0);
        }
      } else if (row.publication === "deleted") {
        await expect(physicalRow.locator('[data-admin-row-action="preview"]')).toHaveCount(0);
        const path = destinationPath(row);
        const response = await navigate(page, path, "core-preview-deleted-taxonomy-collection");
        assert.equal(response.status(), 200);
        assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, path);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.locator("h1").first()).toBeVisible();
        observations.push({ path, deletedConsumerPreviewHidden: true, collectionDestinationNotEntityDetail: true });
      } else {
        observations.push(await popupProof(physicalRow.locator('[data-admin-row-action="preview"] a'), destinationPath(row), null));
      }
      if (publicPath(row)) observations.push(await provePublic(page, row, "core-preview-authorized-public-policy"));
      const cell = { consumer: row.consumer, publication: row.publication, session: "authorized" };
      completed.add(cellKey(cell));
      return { fixture: fixtureIdentity(row), observations, nativeStateReadbackRequired: true, previewCells: [cell] };
    });
  }
  assert.equal(completed.size, rows.length, "Do not revoke the only session after an incomplete authorized Preview pass.");

  // Revoke once through the existing logout owner; keep the signed old cookie
  // only in memory and verify each distinct physical state in a new context.
  await run("core-preview-revoked-all-physical-states", [], async () => {
    const retainedSession = await revokeSession();
    assert.ok(retainedSession?.cookies?.some(cookie => cookie.httpOnly), "A previously valid retained signed session is required, not an empty-cookie context.");
    const stale = await observe("core-preview-stale-context", () => browser.newContext({ storageState: retainedSession }));
    const cells = [], observations = [];
    try {
      await stale.route("**/*", ownedNetworkOnly);
      const tab = await observe("core-preview-stale-page", () => stale.newPage());
      tab.setDefaultTimeout(25_000);
      for (const row of rows) {
        const protectedPaths = [...new Set([consumerPath(row), destinationPath(row)].filter(path => path.startsWith("/admin/")))];
        for (const path of protectedPaths) {
          await navigate(tab, path, "core-preview-revoked-protected");
          await observe("core-preview-revoked-login-route", () => tab.waitForURL(url => url.pathname === "/admin/login"));
          await expect(tab.locator('input[name="username"]')).toBeVisible();
          await expect(tab.locator("[data-admin-entity-preview-action]")).toHaveCount(0);
          observations.push({ fixture: fixtureIdentity(row), path, rejectedToExistingLogin: true });
        }
        if (publicPath(row)) observations.push({ fixture: fixtureIdentity(row), ...await provePublic(tab, row, "core-preview-revoked-public-policy") });
        cells.push({ consumer: row.consumer, publication: row.publication, session: "revoked" });
      }
    } finally {
      await observe("core-preview-stale-close", () => stale.close());
    }
    for (const cell of cells) completed.add(cellKey(cell));
    return { observations, existingLogoutRevokedRetainedSignedCookie: true, cookieArtifactsWritten: false, nativeStateReadbackRequired: true, previewCells: cells };
  });
  assert.deepEqual([...completed].sort(), previewMatrix.map(cellKey).sort(), "Every canonical Preview cell must have completed real browser assertions.");
  return { consumerCount: Object.keys(CONTRACTS).length, physicalFixtures: rows.length, previewCells: completed.size, nativeStateReadbackRequired: true };
}
