/* eslint-disable @typescript-eslint/no-require-imports -- Node's fixed --require preload installs tracing before Next.js imports. */
const fs = require('node:fs');
const http = require('node:http');
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
const target = process.env.QA_ADMIN_SERVER_TRACE_PATH;
if (!target || !path.isAbsolute(target) || !target.includes(path.sep + '.tmp-qa' + path.sep)) throw new Error('Missing owned Admin trace destination');
const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (expected.protocol !== 'http:' || expected.hostname !== '127.0.0.1') throw new Error('Admin trace requires the owned local data API');
const store = new AsyncLocalStorage();
let serial = 0;
const record = value => fs.appendFileSync(target, JSON.stringify(value) + '\n', { mode: 0o600 });
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function(event, ...args) {
  if (event !== 'request') return originalEmit.call(this,event,...args);
  const [request,response] = args;
  const url = new URL(request.url,'http://127.0.0.1');
  const context = { requestId: ++serial,method: request.method,pathname: url.pathname,queryKeys: [...url.searchParams.keys()],rsc:request.headers.rsc === '1',serverAction:Boolean(request.headers['next-action']),startedAt:Date.now() };
  const started = performance.now(); record({type:'request-start',...context});
  response.once('finish',()=>record({type:'request-end',...context,status:response.statusCode,durationMs:performance.now()-started,finishedAt:Date.now()}));
  return store.run(context,()=>originalEmit.call(this,event,...args));
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if(url.origin !== expected.origin && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {record({type:'denied-external-fetch',origin:url.origin,pathname:url.pathname,at:Date.now()});throw new Error('Isolated Admin runtime denied a nonlocal fetch');}
  const context = store.getStore();
  const started=performance.now(),at=Date.now(),method=init?.method ?? input?.method ?? 'GET';
  try {
    const response=await originalFetch(input,init);
    const selected=url.searchParams.get('select');
    const row={type:'data-fetch',requestId:context?.requestId??null,pathname:url.pathname,queryKeys:[...url.searchParams.keys()],
      selectedColumns:selected&&/^[A-Za-z0-9_*,().:!\s]+$/.test(selected)?selected:null,
      method,status:response.status,startedAt:at,headersAt:Date.now(),headersMs:performance.now()-started};
    response.clone().arrayBuffer().then(bytes=>record({...row,bytes:bytes.byteLength,finishedAt:Date.now(),totalMs:performance.now()-started})).catch(()=>record({...row,bytes:null,bodyObservationFailed:true}));
    return response;
  } catch(error) {record({type:'data-fetch-error',requestId:context?.requestId??null,pathname:url.pathname,method,startedAt:at,durationMs:performance.now()-started,name:error.name});throw error;}
};
