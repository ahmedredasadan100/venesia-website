import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Actual source-derived callbacks run through mounted Data/Feedback owners.
// Domain transport is isolated; this is not authenticated database parity.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json")),
  out = path.join(root, ".tmp-qa", "admin-settled-result-adoption");
mkdirSync(out, { recursive: true });
const isFunction = (n) =>
  ts.isArrowFunction(n) ||
  ts.isFunctionExpression(n) ||
  ts.isFunctionDeclaration(n);
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(path.join(dir, e.name))
      : /\.[tj]sx?$/.test(e.name)
        ? [path.join(dir, e.name)]
        : [],
  );
}
const inventory = [];
for (const absolute of files(path.join(root, "src"))) {
  const file = path.relative(root, absolute).replaceAll("\\", "/"),
    source = readFileSync(absolute, "utf8"),
    sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  let kind;
  const calls = [];
  function visit(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (n.expression.text === "useAdminEntityInstantMutation")
        kind = "active";
      if (n.expression.text === "useAdminBoundedClientInstantMutation")
        kind = "bounded";
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === "mutateAsync"
    ) {
      let callback = n.parent;
      while (callback && !isFunction(callback)) callback = callback.parent;
      if (callback) calls.push({ node: n, callback });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  if (!kind || !calls.length || file.endsWith("/instant-mutation.ts")) continue;
  for (const { node, callback } of calls) {
    assert.equal(
      node.expression.expression.getText(sf),
      "instant",
      "Classify new mutation alias: " + file,
    );
    const names = [];
    for (let p = callback; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) && p.name) names.unshift(p.name.text);
      if (ts.isVariableDeclaration(p)) names.unshift(p.name.getText(sf));
    }
    const request = node.arguments[0],
      actionNode = ts.isObjectLiteralExpression(request)
        ? request.properties.find(
            (p) =>
              ts.isPropertyAssignment(p) && p.name.getText(sf) === "action",
          )?.initializer
        : null;
    const action =
        actionNode && ts.isStringLiteral(actionNode)
          ? actionNode.text
          : "dynamic",
      text = callback.getText(sf);
    inventory.push({
      file,
      kind,
      key: file + "#" + names.join("/") + "#" + action,
      names,
      action,
      text,
      params: callback.parameters.map((p) => p.name.getText(sf)),
      line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
      sha256: createHash("sha256").update(text).digest("hex"),
      helpers: sf.statements
        .filter(
          (n) =>
            ts.isFunctionDeclaration(n) &&
            [
              "toInstantMutationResult",
              "unexpectedMutationFailure",
              "topicActionFormData",
              "reorderOptimisticRows",
            ].includes(n.name?.text),
        )
        .map((n) => n.getText(sf))
        .join("\n"),
    });
  }
}
assert.ok(inventory.length > 0);
assert.equal(
  new Set(inventory.map((x) => x.key)).size,
  inventory.length,
  "Each adapter needs an unambiguous test binding",
);
const active = inventory.filter((x) => x.kind === "active"),
  bounded = inventory.filter((x) => x.kind === "bounded");
// Do not manufacture active refetch failures for disabled bounded RSC queries.
for (const item of bounded)
  assert.ok(
    !item.text.includes("reconcileSuccess:") ||
      item.file.endsWith("/PageBlocksClient.tsx"),
    "Classify reconciliation warning: " + item.key,
  );
assert.match(
  readFileSync(
    path.join(
      root,
      "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
    ),
    "utf8",
  ),
  /enabled:\s*false/,
);
const actionNames = [
  "setUnifiedContentStatus",
  "toggleUnifiedContentFeatured",
  "duplicateUnifiedContent",
  "softDeleteUnifiedContent",
  "restoreUnifiedContent",
  "permanentlyDeleteUnifiedContent",
  "bulkUpdateUnifiedContent",
  "emptyUnifiedContentTrash",
  "toggleCategoryStatusAjax",
  "duplicateCategoryAjax",
  "bulkCategoriesLifecycleAjax",
  "toggleSeriesStatusAjax",
  "duplicateSeriesAjax",
  "bulkSeriesActionAjax",
  "deletePages",
  "togglePageStatus",
  "duplicatePageAjax",
  "deleteProjectAjax",
  "duplicateProjectAjax",
  "setProjectFeaturedAjax",
  "setProjectPublicationAjax",
  "setProjectLocationActiveAction",
  "deleteProjectLocationAction",
  "toggleRedirectStatusAction",
  "deleteRedirectAction",
  "setTrackingStageVisibilityAction",
  "setTrackingItemVisibilityAction",
  "setTrackingUpdatePublicationVisibilityAction",
  "deleteTrackingStageAction",
  "deleteTrackingItemAction",
  "deleteTrackingUpdateAction",
  "reorderTrackingStagesAction",
  "reorderTrackingItemsAction",
];
const bindings = active.map((entry, index) => {
  let args = "[row]";
  const name = entry.names.at(-1);
  if (name === "executeBulkMutation") args = "['delete',[1],'']";
  else if (name === "emptyTrash") args = "[1]";
  else if (name === "bulkDelete") args = "[[1]]";
  else if (name === "runLifecycleMutation") args = "[row,'delete',execute]";
  else if (name === "setProjectVisibility") args = "[row,true]";
  else if (entry.file.includes("TrackingCollections"))
    args =
      entry.action === "reorder"
        ? "[[1]]"
        : entry.params.length
          ? "[row,onMutationResult]"
          : "[]";
  else if (
    entry.file.includes("TopicsListClient") &&
    name === "toggleVisibility"
  )
    args = "[row,'published']";
  const preservesDomain = [
    "TopicsListClient",
    "TrackingCollections",
    "ProjectLocationsManagementClient",
    "CategoriesListClient",
    "SeriesTableClient",
  ].some((s) => entry.file.includes(s));
  return (
    "function adapter" +
    index +
    "(instant:any,execute:any,row:any,recover:any){\n" +
    entry.helpers +
    "\n" +
    "const controller={query:{filters:{status:'all',visibility:'all',publication:'all',featured:'all'}}};const projectId=1,stageId=1,itemId=1,level='city',pages=[row];const getPageDeleteBlockReason=()=>null;const adminUserEntityListRowSchema={safeParse:(data:any)=>({success:true,data})};\n" +
    "const " +
    actionNames.map((n) => n + "=execute").join(",") +
    ";\n" +
    "const userAction=async()=>{const value=await execute();if(!value.ok)throw Error(value.message);return {...row,username:'fixture'};};const setAdminUserActiveAction=userAction,deleteAdminUserAction=userAction;\n" +
    "const recoverUnifiedContentCommand=recover;let emitted:any;const onMutationResult=(result:any)=>{emitted=result;};const run=" +
    entry.text.replace(/^async function\s+\w+/, "async function") +
    ";\n" +
    "return{preservesDomain:" +
    preservesDomain +
    ",run:async()=>{try{return await (run as any)(..." +
    args +
    ")??emitted;}catch(error){if(emitted)return emitted;throw error;}}};}"
  );
});
writeFileSync(
  path.join(out, "adapters.ts"),
  "import{adminActionFailure,adminActionSuccess,withAdminActionSettledResult}from'@src/lib/admin/admin-action-result';\n" +
    bindings.join("\n") +
    "\nexport const factories=[" +
    active.map((_, i) => "adapter" + i).join(",") +
    "];\n",
);
// Use the actual consumer recovery callback, declaration, and shared button.
const topicSource = readFileSync(path.join(root, "src/components/admin/content/TopicsListClient.tsx"), "utf8");
const topicAst = ts.createSourceFile("TopicsListClient.tsx", topicSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let recoveryCallback, recoveryDeclaration;
function findRecovery(n) {
  if(ts.isVariableDeclaration(n) && n.name.getText(topicAst) === "recoverPendingCommand") recoveryCallback = n.initializer.arguments[0].getText(topicAst);
  if(ts.isPropertyAssignment(n) && n.name.getText(topicAst) === "recoveryAction") recoveryDeclaration = n.initializer.getText(topicAst);
  ts.forEachChild(n,findRecovery);
}
findRecovery(topicAst);
const toolbarSource = readFileSync(path.join(root, "src/components/admin/entity-list/AdminEntityListFilters.tsx"), "utf8");
const toolbarAst = ts.createSourceFile("AdminEntityListFilters.tsx", toolbarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let recoveryButton;
function findRecoveryButton(n) {
  if(ts.isJsxElement(n) && n.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p) && p.name.getText(toolbarAst)==="data-admin-command-recovery")) recoveryButton=n.getText(toolbarAst);
  ts.forEachChild(n,findRecoveryButton);
}
findRecoveryButton(toolbarAst);
assert.ok(recoveryCallback && recoveryDeclaration && recoveryButton);
const failureHelper = topicAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==="unexpectedMutationFailure").getText(topicAst);
writeFileSync(
  path.join(out, "entry.tsx"),
  String.raw`
import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider,useQuery}from'@tanstack/react-query';import{useAdminEntityInstantMutation}from'@src/lib/admin/entity-list/data-engine/instant-mutation';import{adminEntityListQueryKeys}from'@src/lib/admin/entity-list/data-engine/query-keys';import{mapAdminActionResultToFeedback}from'@src/lib/admin/admin-action-feedback';import{factories}from'./adapters';
const query={search:'',filters:{},sort:{field:'id',direction:'asc'},page:1,pageSize:10,mode:'server-page'},key=adminEntityListQueryKeys.query('settled-adoption',query);
const row={id:1,name:'fixture',title:'fixture',slug:'fixture',path:'/fixture',sort_order:1,status:'unpublished',is_visible:false,is_active:false,is_featured:false,featured:false,publication_status:'unpublished'};
const initial={rows:[row],pagination:{page:1,pageSize:10,totalRows:1,totalPages:1},meta:{generatedAt:'fixture',mode:'server-page'}};
const root=createRoot(document.getElementById('root')!);let client:any,epoch=0;
function Fixture(){
useQuery({queryKey:key,initialData:initial,staleTime:Infinity,retry:false,queryFn:async()=>{const response=await fetch('/read');if(!response.ok)throw Error('Readback HTTP 503');return response.json();}});
const instant=useAdminEntityInstantMutation('settled-adoption',query);const execute=async(...args:any[])=>{window.calls++;const form=args.find(value=>value instanceof FormData);const data=form?Object.fromEntries(form):{};return(await fetch('/mutate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})).json();};
const recover=async(commandId:string)=>(await fetch('/recover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({commandId})})).json();
window.run=async(index:number,opposite=false)=>{const controlled={...instant,mutateAsync:(request:any)=>instant.mutateAsync({...request,optimistic:(cache:any)=>{request.optimistic(cache);window.optimisticSnapshot=structuredClone(client.getQueryData(key));}})};const adapter=factories[index](controlled,execute,opposite?{...row,is_featured:true}:row,recover);const result=await adapter.run();return{result,feedback:mapAdminActionResultToFeedback(result),preservesDomain:adapter.preservesDomain,snapshot:client.getQueryData(key),optimisticSnapshot:window.optimisticSnapshot};};
window.retryRead=()=>client.refetchQueries({queryKey:key,type:'active'},{throwOnError:true}).catch(()=>undefined);
return <output id="ready">{epoch}</output>;}
window.mount=()=>{window.calls=0;window.optimisticSnapshot=null;window.lastRecoveryResult=null;epoch++;client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});root.render(<QueryClientProvider key={epoch} client={client}><Fixture/></QueryClientProvider>);return epoch;};
`,
);

const composition = bounded.filter(
  (item) =>
    item.file.endsWith("/PageBlocksClient.tsx") &&
    item.text.includes("reconcileSuccess:"),
);
const compositionSource = readFileSync(
    path.join(root, composition[0].file),
    "utf8",
  ),
  compositionAst = ts.createSourceFile(
    "PageBlocksClient.tsx",
    compositionSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
let feedbackExpression;
function findFeedback(n) {
  if (
    ts.isJsxAttribute(n) &&
    n.name.getText(compositionAst) === "feedback" &&
    n.initializer &&
    ts.isJsxExpression(n.initializer) &&
    n.initializer.expression?.getText(compositionAst).includes("actionFeedback")
  )
    feedbackExpression = n.initializer.expression.getText(compositionAst);
  ts.forEachChild(n, findFeedback);
}
findFeedback(compositionAst);
assert.ok(feedbackExpression);
const boundedFactories = composition.map(
  (item, index) =>
    "function boundedAdapter" +
    index +
    "(instant:any,execute:any,row:any,domainWarning:boolean){let actionFeedback:any;const setActionFeedback=(value:any)=>{actionFeedback=value;};const page={id:1},regionKeys=['hero','body'],manualReorderEnabled=true;const normalizeLayoutSlot=(slot:any)=>slot,normalizeBoolean=(value:any)=>Boolean(value),assignmentRowId=(value:any)=>String(value.id),getDisplayPositionOptions=()=>regionKeys,comparePageAssignmentOrder=(a:any,b:any)=>a.sortOrder-b.sortOrder,getAssignmentSiblings=()=>instant.rows;const updatePageBlockAssignment=execute,reorderPageComposition=async()=>({...await execute(),warning:domainWarning?'Committed domain warning':null});const run=" +
    item.text.replace(/^async function\s+\w+/, "async function") +
    ";return async()=>{await run(row," +
    (item.action === "display-position" ? "'body'" : "1") +
    ");return{result:actionFeedback,feedback:(" +
    feedbackExpression +
    ")};};}",
);
appendFileSync(
  path.join(out, "adapters.ts"),
  "\n" +
    boundedFactories.join("\n") +
    "\nexport const boundedFactories=[" +
    composition.map((_, index) => "boundedAdapter" + index).join(",") +
    "];\n",
);
let entry = readFileSync(path.join(out, "entry.tsx"), "utf8")
  .replace(
    "import{factories}from'./adapters';",
    "import{factories,boundedFactories}from'./adapters';",
  )
  .replace(
    "import{useAdminEntityInstantMutation}",
    "import{useAdminEntityInstantMutation,useAdminBoundedClientInstantMutation}",
  );
entry = entry.replace(
  "const initial={rows:[row]",
  "const boundedRows=[{...row,slot:'hero',module_kind:'content',sort_order:10},{...row,id:2,slot:'hero',module_kind:'content',sort_order:20}];\nconst initial={rows:[row]",
);
entry = entry.replace(
  "const instant=useAdminEntityInstantMutation('settled-adoption',query);",
  "const instant=useAdminEntityInstantMutation('settled-adoption',query);const boundedInstant=useAdminBoundedClientInstantMutation({entity:'bounded-settled',initialRows:boundedRows});",
);
entry = entry.replace(
  "window.retryRead=",
  String.raw`
window.runBounded=async(index:number,fault:boolean,domainWarning:boolean)=>{
 const base=boundedInstant;const controlled={...base,mutateAsync:(request:any)=>base.mutateAsync({...request,reconcileSuccess:request.reconcileSuccess?(result:any,tools:any)=>request.reconcileSuccess(result,fault?{...tools,cache:{...tools.cache,patchRows:()=>{throw Error('Injected local reconciliation failure');}}}:tools):undefined})};
 const item=domainWarning?{...boundedRows[0],slot:'body'}:boundedRows[0];
 const run=boundedFactories[index](controlled,execute,item,domainWarning);return run();
};
window.retryRead=`,
);
entry = entry.replace("import React from'react';", "import React from'react';import{mapTopicsActionResultToFeedback as actualTopicsFeedback}from'@src/lib/admin/content/topics-action-feedback';");
entry = entry.replace("function Fixture(){", failureHelper + "\nfunction Fixture(){");
entry = entry.replace('return <output id="ready">{epoch}</output>;',
  'const currentListPath="/admin/content/topics",UNIFIED_CONTENT_LIST_ID="content-topics-table";const mapTopicsActionResultToFeedback=(result:any,context:any)=>{window.lastRecoveryResult=result;return actualTopicsFeedback(result,context);};const publishFeedback=(feedback:any)=>{window.lastRecoveryFeedback=feedback;};const recoverPendingCommand='+recoveryCallback+';const recoveryAction='+recoveryDeclaration+';return <><output id="ready">{epoch}</output>{recoveryAction?'+recoveryButton+':null}</>;');
writeFileSync(path.join(out, "entry.tsx"), entry);
await require("next/dist/build/swc").loadBindings();

const webpack = require("next/dist/compiled/webpack/webpack").webpack;
const compiler = webpack({
  mode: "development",
  target: "web",
  context: root,
  entry: path.join(out, "entry.tsx"),
  output: { path: out, filename: "fixture.js" },
  devtool: false,
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({ NODE_ENV: "development" }),
    }),
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    modules: [path.join(root, "node_modules")],
    alias: { "@src": path.join(root, "src") },
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader:
              require.resolve("next/dist/build/webpack/loaders/next-swc-loader"),
            options: {
              rootDir: root,
              isServer: false,
              compilerType: "client",
              hasReactRefresh: false,
              nextConfig: {},
              jsConfig: {},
              swcCacheDir: path.join(out, "swc-cache"),
              serverComponents: false,
              serverReferenceHashSalt: "settled-adoption",
              esm: false,
              transpilePackages: [],
            },
          },
        ],
      },
    ],
  },
});
await new Promise((resolve, reject) =>
  compiler.run((error, stats) =>
    compiler.close((closeError) => {
      if (error || closeError || stats?.hasErrors())
        reject(
          error ??
            closeError ??
            Error(
              JSON.stringify(stats.toJson({ all: false, errors: true }).errors),
            ),
        );
      else resolve();
    }),
  ),
);
let mode,
  writes = 0,
  reads = 0;
let recoveries=0,recoveryAvailable=true;
const receipts=new Map();
const commandIds=[];
const server = createServer(async (request, response) => {
  if(request.url==="/recover"){
    recoveries++;let raw="";for await(const chunk of request)raw+=chunk;
    const {commandId}=JSON.parse(raw);
    response.setHeader("content-type","application/json");
    response.end(JSON.stringify(recoveryAvailable&&receipts.has(commandId)?receipts.get(commandId):{ok:false,feedbackStatus:"warning",completion:"unknown",commandId,code:"completion_unknown",title:"Unknown",message:"Outcome unknown"}));return;
  }
  if(request.url==="/mutate"&&mode?.startsWith("command-")){
    let raw="";for await(const chunk of request)raw+=chunk;
    const data=JSON.parse(raw),commandId=data.command_id;
    assert.match(commandId,/^[0-9a-f-]{36}$/i);
    commandIds.push(commandId);
    response.setHeader("content-type","application/json");
    if(mode==="command-rejected"){response.end(JSON.stringify({ok:false,feedbackStatus:"error",completion:"not_committed",commandId,code:"invalid_input",title:"Rejected",message:"No commit",entityId:1}));return;}
    writes++;const result={ok:true,feedbackStatus:"success",completion:"committed",commandId,correlationId:commandId,entityId:1,title:"Committed",message:"Committed",code:"saved"};
    receipts.set(commandId,result);
    if(mode==="command-lost"){response.writeHead(200);response.write("{");setTimeout(()=>response.destroy(),5);return;}
    if(mode==="command-unknown-reply"){response.end(JSON.stringify({ok:false,feedbackStatus:"warning",completion:"unknown",commandId,code:"completion_unknown",title:"Unknown",message:"Outcome unknown"}));return;}
    response.end(JSON.stringify(result));return;
  }
  if (request.url === "/mutate") {
    response.setHeader("content-type", "application/json");
    if (mode === "error") {
      response.end(
        JSON.stringify({
          ok: false,
          title: "Denied",
          message: "No commit",
          code: "unauthorized_actor",
          entityId: 1,
          correlationId: "c1-proof",
        }),
      );
      return;
    }
    writes++;
    response.end(
      JSON.stringify({
        ok: true,
        feedbackStatus: mode === "cache-warning" ? "warning" : "success",
        title: mode === "cache-warning" ? "Domain warning" : "Saved",
        message:
          mode === "cache-warning" ? "Committed; cache pending" : "Committed",
        code:
          mode === "cache-warning"
            ? "committed_cache_revalidation_pending"
            : "saved",
        entityId: 1,
        correlationId: "c1-proof",
        insertedId: 1,
        projectId: 1,
        pageId: 1,
        deletedIds: [1],
        blockedCount: 0,
        updatedAt: "confirmed",
        isActive: true,
        status: "published",
        featured: true,
        publication_status: "published",
      }),
    );
    return;
  }
  if (request.url === "/read") {
    reads++;
    response.statusCode = mode === "success" ? 200 : 503;
    response.end(
      mode === "success"
        ? JSON.stringify({
            rows: [],
            pagination: { page: 1, pageSize: 10, totalRows: 0, totalPages: 1 },
            meta: { mode: "server-page", generatedAt: "confirmed" },
          })
        : "Readback unavailable",
    );
    return;
  }
  if (request.url === "/fixture.js") {
    response.setHeader("content-type", "application/javascript");
    response.end(readFileSync(path.join(out, "fixture.js")));
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end('<div id="root"></div><script src="/fixture.js"></script>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port,
  browser = await require("playwright").chromium.launch({ headless: true }),
  context = await browser.newContext({ serviceWorkers: "block" }),
  blocked = [],
  results = [];
await context.route("**/*", (route) =>
  new URL(route.request().url()).origin === origin
    ? route.continue()
    : (blocked.push(route.request().url()), route.abort()),
);
try {
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => window.mount);
  for (const [index, adapter] of active.entries())
    for (mode of ["success", "readback-warning", "cache-warning", "error"]) {
      writes = 0;
      reads = 0;
      const epoch = await page.evaluate(() => window.mount());
      await page.waitForFunction(
        (value) =>
          document.querySelector("#ready")?.textContent === String(value),
        epoch,
      );
      const observed = await page.evaluate((index) => window.run(index), index),
        label = adapter.key + " / " + mode;
      assert.equal(observed.result.ok, mode !== "error", label);
      assert.equal(
        observed.feedback.variant,
        mode === "error"
          ? "danger"
          : mode === "success"
            ? "success"
            : "warning",
        label,
      );
      assert.equal(writes, mode === "error" ? 0 : 1, label);
      assert.equal(reads, mode === "error" ? 0 : 1, label);
      if (mode === "readback-warning" || mode === "cache-warning") {
        assert.match(observed.result.message, /إعادة القراءة/, label);
        if (observed.preservesDomain) {
          assert.equal(observed.result.entityId, 1, label);
          assert.equal(observed.result.correlationId, "c1-proof", label);
        }
        if (mode === "cache-warning" && observed.preservesDomain) {
          assert.equal(
            observed.result.code,
            "committed_cache_revalidation_pending",
            label,
          );
          assert.equal(observed.result.title, "Domain warning", label);
        }
        await page.evaluate(() => window.retryRead());
        assert.equal(writes, 1, label + " read-only recovery");
        assert.equal(reads, 2, label);
      }
      results.push({
        key: adapter.key,
        mode,
        writes,
        reads,
        result: observed.result,
        feedback: observed.feedback.variant,
      });
    }

  for (const [index, adapter] of composition.entries()) {
    for (mode of [
      "success",
      "reconciliation-warning",
      "error",
      ...(adapter.action === "reorder" ? ["domain-warning"] : []),
    ]) {
      writes = 0;
      reads = 0;
      const epoch = await page.evaluate(() => window.mount());
      await page.waitForFunction(
        (value) =>
          document.querySelector("#ready")?.textContent === String(value),
        epoch,
      );
      const observed = await page.evaluate(
        ({ index, fault, domainWarning }) =>
          window.runBounded(index, fault, domainWarning),
        {
          index,
          fault: mode === "reconciliation-warning",
          domainWarning: mode === "domain-warning",
        },
      );
      const label = adapter.key + " / " + mode;
      assert.equal(observed.result.ok, mode !== "error", label);
      assert.equal(
        observed.feedback.variant,
        mode === "error"
          ? "danger"
          : mode === "success"
            ? "success"
            : "warning",
        label,
      );
      assert.equal(writes, mode === "error" ? 0 : 1, label);
      assert.equal(reads, 0, label + " bounded queries remain disabled");
      if (mode === "reconciliation-warning")
        assert.match(observed.result.message, /تعذر تحديث العرض المحلي/, label);
      results.push({
        key: adapter.key,
        mode,
        writes,
        reads,
        result: observed.result,
        feedback: observed.feedback.variant,
      });
    }
  }
  const receiptAdapters=active.map((item,index)=>({item,index})).filter(({item})=>item.file.endsWith("/TopicsListClient.tsx")&&item.text.includes("recover:"));
  assert.equal(receiptAdapters.length,6,"Only the six approved Topics command paths opt into receipts");
  for(const {item,index} of receiptAdapters){
    for(const scenario of ["command-lost","command-unknown-reply","command-rejected"]){
      mode=scenario;writes=0;reads=0;recoveries=0;receipts.clear();commandIds.length=0;recoveryAvailable=true;
      const epoch=await page.evaluate(()=>window.mount());await page.waitForFunction(value=>document.querySelector("#ready")?.textContent===String(value),epoch);
      const observed=await page.evaluate(index=>window.run(index),index),label=item.key+" / "+mode;
      assert.equal(observed.result.ok,mode!=="command-rejected",label);
      assert.equal(writes,mode==="command-rejected"?0:1,label);
      assert.equal(recoveries,mode==="command-rejected"?0:1,label);
      assert.equal(observed.result.completion,mode==="command-rejected"?"not_committed":"committed",label);
      assert.equal(observed.result.commandId,commandIds[0],label);
      if(mode!=="command-rejected"){assert.equal(observed.feedback.variant,"warning",label);assert.equal(observed.result.correlationId,commandIds[0],label);}
      results.push({key:item.key,mode,writes,reads,recoveries,result:observed.result,feedback:observed.feedback.variant});
    }
    mode="command-lost";writes=0;reads=0;recoveries=0;receipts.clear();commandIds.length=0;recoveryAvailable=false;
    const epoch=await page.evaluate(()=>window.mount());await page.waitForFunction(value=>document.querySelector("#ready")?.textContent===String(value),epoch);
    const first=await page.evaluate(index=>window.run(index),index);
    assert.equal(first.result.completion,"unknown",item.key);
    assert.equal(first.feedback.variant,"warning",item.key);
    assert.equal(writes,1);assert.equal(recoveries,1);
    assert.deepEqual(first.snapshot,first.optimisticSnapshot,item.key+" unknown transport cannot roll back optimistic cache");
    await page.getByRole("button",{name:"استعادة نتيجة العملية"}).waitFor();
    const second=await page.evaluate(index=>window.run(index),index);
    assert.equal(second.result.completion,"unknown",item.key);
    assert.equal(second.result.commandId,first.result.commandId,item.key+" keeps identity");
    assert.equal(writes,1,item.key+" same intent cannot replay mutation");assert.equal(recoveries,2);
    const featuredIndex=receiptAdapters.find(({item})=>item.names.at(-1)==="toggleFeatured").index;
    const blockedOpposite=await page.evaluate(index=>window.run(index,true),featuredIndex);
    assert.equal(blockedOpposite.result.completion,"unknown",item.key+" blocks opposite pending intent");assert.equal(writes,1);assert.equal(recoveries,2);
    await page.getByRole("button",{name:"استعادة نتيجة العملية"}).click();
    await page.waitForFunction(()=>window.lastRecoveryResult?.completion==="unknown");
    assert.equal(writes,1);assert.equal(recoveries,3);
    await page.waitForFunction(()=>!document.querySelector('[data-admin-command-recovery]')?.disabled);
    recoveryAvailable=true;
    await page.getByRole("button",{name:"استعادة نتيجة العملية"}).click();
    await page.waitForFunction(()=>window.lastRecoveryResult?.completion==="committed");
    const recovered=await page.evaluate(()=>({result:window.lastRecoveryResult,feedback:window.lastRecoveryFeedback}));
    await page.getByRole("button",{name:"استعادة نتيجة العملية"}).waitFor({state:"detached"});
    assert.equal(recovered.result.correlationId,first.result.commandId);
    assert.equal(recovered.result.entityId,1);
    assert.equal(recovered.feedback.variant,"warning");
    assert.equal(recovered.result.completion,"committed",item.key);assert.equal(recovered.result.commandId,first.result.commandId);assert.equal(writes,1);assert.equal(recoveries,4);
    const opposite=await page.evaluate(index=>window.run(index,true),featuredIndex);
    assert.equal(opposite.result.completion,"committed");assert.notEqual(opposite.result.commandId,first.result.commandId);assert.equal(writes,2);
    results.push({key:item.key,mode:"retained-unknown-mounted-recovery-clicks-and-opposite-intent",writes,reads,recoveries,first:first.result,recovered:recovered.result,opposite:opposite.result});
  }
  assert.deepEqual(blocked, []);
} finally {
  writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        scope:
          "Mounted real Data/Feedback and source-derived callbacks; isolated domain transport, not authenticated DB parity",
        inventory: inventory.map((item) =>
          Object.fromEntries(
            Object.entries(item).filter(
              ([name]) => !["text", "helpers"].includes(name),
            ),
          ),
        ),
        results,
        blocked,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(
  JSON.stringify({
    proof: "settled-result adopter behavior",
    activeCallbacks: active.length,
    boundedCallbacks: bounded.length,
    cases: results.length,
    artifact: path.join(out, "results.json"),
  }),
);
