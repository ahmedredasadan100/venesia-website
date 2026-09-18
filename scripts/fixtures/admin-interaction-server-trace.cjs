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
const control = process.env.QA_ADMIN_TRACE_CONTROL_PATH;
if (control && (!path.isAbsolute(control) || !['heavy-editor-performance-excellence-2026-09-18','heavy-editor-closure-2026-09-18'].some(study => control.endsWith(path.join('.tmp-qa',study,'control','server-trace-mode.json'))))) throw new Error('Invalid owned trace control');
let mode = control ? 'off' : 'full', controlToken = null, buffered = [], writing = false;
const flush = () => {
  if (writing || !buffered.length) return;
  writing = true; const chunk = buffered.join(''); buffered = [];
  fs.appendFile(target, chunk, { mode: 0o600 }, error => { writing = false; if (error) throw error; flush(); });
};
const record = value => {
  if (!control) { fs.appendFileSync(target, JSON.stringify(value) + '\n', { mode: 0o600 }); return; }
  buffered.push(JSON.stringify(value) + '\n');
};
if (control) {
  setInterval(flush, 250).unref();
  setInterval(() => fs.readFile(control, 'utf8', (error, raw) => {
    if (error && error.code === 'ENOENT') return;
    if (error) throw error;
    // The driver replaces a tiny local control file between cohorts; partial
    // reads are retried, never interpreted as permission for another mode.
    let command; try { command = JSON.parse(raw); } catch { return; }
    const next = command.mode;
    if (!['off','headers','full'].includes(next)) throw new Error('Unknown trace mode');
    if (typeof command.token !== 'string' || !/^[a-zA-Z0-9:-]+$/.test(command.token)) throw new Error('Invalid trace control token');
    if (command.token !== controlToken) {
      mode = next; controlToken = command.token; const at = Date.now();
      record({ type:'trace-mode', mode, token:controlToken, at });
      fs.writeFile(control.replace(/\.json$/, '-ack.json'), JSON.stringify({mode,token:controlToken,at}), {mode:0o600}, error => { if (error) throw error; });
    }
  }), 250).unref();
  process.on('exit', () => { if (buffered.length) fs.appendFileSync(target, buffered.join(''), { mode:0o600 }); });
}
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function(event, ...args) {
  if (event !== 'request') return originalEmit.call(this,event,...args);
  if (mode === 'off') return originalEmit.call(this,event,...args);
  const [request,response] = args;
  const url = new URL(request.url,'http://127.0.0.1');
  const context = { requestId: ++serial,traceMode:mode,method: request.method,pathname: url.pathname,queryKeys: [...url.searchParams.keys()],rsc:request.headers.rsc === '1',prefetch:request.headers['next-router-prefetch'] === '1' || Boolean(request.headers['next-router-segment-prefetch']) || request.headers.purpose === 'prefetch',serverAction:Boolean(request.headers['next-action']),startedAt:Date.now() };
  const started = performance.now(); record({type:'request-start',...context});
  response.once('finish',()=>record({type:'request-end',...context,status:response.statusCode,durationMs:performance.now()-started,finishedAt:Date.now()}));
  return store.run(context,()=>originalEmit.call(this,event,...args));
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if(url.origin !== expected.origin && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {record({type:'denied-external-fetch',origin:url.origin,pathname:url.pathname,at:Date.now()});throw new Error('Isolated Admin runtime denied a nonlocal fetch');}
  const context = store.getStore();
  if (mode === 'off' && !context) return originalFetch(input,init);
  const started=performance.now(),at=Date.now(),method=init?.method ?? input?.method ?? 'GET';
  try {
    const response=await originalFetch(input,init);
    const selected=url.searchParams.get('select');
    const row={type:'data-fetch',requestId:context?.requestId??null,pathname:url.pathname,queryKeys:[...url.searchParams.keys()],
      selectedColumns:selected&&/^[A-Za-z0-9_*,().:!\s]+$/.test(selected)?selected:null,
      method,status:response.status,startedAt:at,headersAt:Date.now(),headersMs:performance.now()-started};
    if ((context?.traceMode ?? mode) === 'full') response.clone().arrayBuffer().then(bytes=>record({...row,bytes:bytes.byteLength,finishedAt:Date.now(),totalMs:performance.now()-started})).catch(()=>record({...row,bytes:null,bodyObservationFailed:true}));
    else record({...row,bytes:null,bodyObserved:false});
    return response;
  } catch(error) {record({type:'data-fetch-error',requestId:context?.requestId??null,pathname:url.pathname,method,startedAt:at,durationMs:performance.now()-started,name:error.name});throw error;}
};
