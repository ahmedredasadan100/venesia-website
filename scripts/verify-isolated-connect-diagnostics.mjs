import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import pg from 'pg';

function extract(source){
 const ast=ts.createSourceFile('owner.ts',source,ts.ScriptTarget.Latest,true),wanted=new Set(['OWNER','IsolatedSupabaseError','fail','requireThat','classifyOwnedPgConnectMessage','describeOwnedPgConnectFailure','createAdminMeasurementControlLease','transportCodes','ownerTransportCodes','asSafeError','connect']),parts=new Map();
 function visit(node){
  const name=(ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node))&&node.name?.text;
  if(name&&wanted.has(name)){assert.ok(!parts.has(name));parts.set(name,node.getText(ast));}
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&wanted.has(node.name.text)){assert.ok(!parts.has(node.name.text));parts.set(node.name.text,'const '+node.getText(ast)+';');}
  ts.forEachChild(node,visit);
 }visit(ast);assert.equal(parts.size,wanted.size);
 return ts.transpileModule([...wanted].map(key=>parts.get(key)).join('\n')+'\nexport {connect,asSafeError};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
export async function verifyIsolatedConnectDiagnostics(source){
 const compiled=extract(source),checks=[];let attempts=0,ended=0,inspections=0,records=[],failure=new Error('timeout expired'),recordFailure=false,time=100,snapshots=0;
 const marker='postgresql://private-user:private-value@example.invalid/postgres';
 class CliFailure extends Error{constructor(){super('private-message');this.code='CLI_CONTROLLED';this.stage='cli';}}
 const options=[];
 class ControlledClient{constructor(config){options.push(config);}async connect(){attempts++;if(failure)throw failure;}async end(){ended++;}}
 function owner(extra={}){
  const loaded={exports:{}},ports={pg:{Client:ControlledClient},inspectCaptured:async()=>{inspections++;},serviceResource:()=>({owned:true}),databaseUrl:()=>marker,hostBridge:{snapshot:()=>{snapshots++;return {accepted:snapshots,rejected:0,failed:0,closed:0,active:1,localProcesses:1,stopping:false,listeners:[{host:marker,port:99}]};}},safeRecord:(stage,metadata)=>{if(recordFailure)throw Error(marker);records.push({stage,...metadata});},performance:{now:()=>{time+=4.8;return time;}},IsolatedSupabaseCliError:CliFailure,...extra};
  new Function(...Object.keys(ports),'module','exports',compiled)(...Object.values(ports),loaded,loaded.exports);return loaded.exports;
 }
 const actualOwner=owner();const test=async(name,work)=>{await work();checks.push(name);};
 for(const [message,code,kind]of [['timeout expired','DB_CONNECTION_TIMEOUT','pg_timeout_expired'],['Connection terminated unexpectedly','DB_CONNECTION_EOF','pg_unexpected_end'],['Connection terminated','DB_CONNECTION_ENDED','pg_requested_end'],['Connection terminated due to connection timeout','DB_CONNECTION_TIMEOUT','pg_legacy_timeout']]){
  await test('Exact '+kind+' classified without retaining text',()=>{const value=actualOwner.classifyOwnedPgConnectMessage(new Error(message));assert.deepEqual(value,{code,messageClass:kind});assert.equal(actualOwner.asSafeError(new Error(message),'database-connect').code,code);assert.equal(actualOwner.asSafeError(new Error(message),'application-query').code,message.includes('due to connection timeout')?'DB_CONNECTION_TIMEOUT':'PREREQUISITE_OR_OPERATION_FAILED');});
 }
 for(const value of [new Error('timeout expired '+marker),new Error('timeout expired\n'),new Error(' timeout expired'),new Error('TIMEOUT EXPIRED'),new Error(marker),{message:'timeout expired'},'timeout expired',null]){
  await test('Unknown or augmented message denied '+checks.length,()=>{assert.equal(actualOwner.classifyOwnedPgConnectMessage(value),null);});
 }
 await test('Message accessor is not invoked by fixed diagnostic classifier',()=>{const error=new Error();Object.defineProperty(error,'message',{get(){throw Error(marker);}});assert.equal(actualOwner.classifyOwnedPgConnectMessage(error),null);});
 await test('Only fixed counters and valid monotonic duration survive observation',()=>{
  const value=actualOwner.describeOwnedPgConnectFailure(new Error(marker),12.9,{accepted:3,rejected:2,failed:1,closed:0,active:2,localProcesses:2,stopping:false,password:marker,listeners:[marker]},{accepted:4,rejected:2,failed:1,closed:1,active:2,localProcesses:2,stopping:true});
  assert.equal(value.elapsedMs,12);assert.equal(value.pgMessageClass,'unclassified');assert.equal(value.beforeBridgeAccepted,3);assert.equal(value.afterBridgeAccepted,4);assert.equal(Object.keys(value).length,16);assert.ok(!JSON.stringify(value).includes(marker));
  for(const key of Object.keys(value))assert.ok(!/password|secret|token|connection|raw|body|payload|authorization/i.test(key));
 });
 for(const duration of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])await test('Invalid duration becomes null '+String(duration),()=>assert.equal(actualOwner.describeOwnedPgConnectFailure(new Error(),duration,null,null).elapsedMs,null));
 await test('Invalid/throwing snapshot fields cannot leak or replace connect failure',()=>{
  const snapshot={accepted:marker,rejected:-1,failed:0.5,closed:Infinity,active:NaN,localProcesses:{secret:marker},get stopping(){throw Error(marker);}};
  const value=actualOwner.describeOwnedPgConnectFailure(new Error(),1,snapshot,null);assert.ok(Object.entries(value).filter(([key])=>key.startsWith('beforeBridge')).every(([,value])=>value===null));assert.ok(!JSON.stringify(value).includes(marker));
 });
 await test('Actual connect boundary records one failed attempt and retains pinned config/cleanup',async()=>{
  failure=new Error('timeout expired');const before=attempts;await assert.rejects(actualOwner.connect('postgres'),error=>error.code==='DB_CONNECTION_TIMEOUT'&&error.stage==='database-connect');
  assert.equal(attempts,before+1);assert.equal(ended,1);assert.equal(inspections,1);assert.equal(records.length,1);assert.equal(records[0].stage,'database-connect-failed');assert.equal(records[0].safeCode,'DB_CONNECTION_TIMEOUT');assert.equal(records[0].pgMessageClass,'pg_timeout_expired');assert.equal(records[0].elapsedMs,4);assert.ok(!JSON.stringify(records).includes(marker));
  assert.deepEqual(options[0],{connectionString:marker,connectionTimeoutMillis:5000,ssl:false,options:'',statement_timeout:30000,application_name:'isolated-supabase'});
 });
 await test('Diagnostic receipt failure preserves original classified rejection and closes client once',async()=>{recordFailure=true;failure=new Error('Connection terminated unexpectedly');const before=attempts,closed=ended;await assert.rejects(actualOwner.connect('postgres'),error=>error.code==='DB_CONNECTION_EOF');assert.equal(attempts,before+1);assert.equal(ended,closed+1);recordFailure=false;});
 await test('Transport codes and SQLSTATE retain precedence over message classification',()=>{for(const code of ['ECONNRESET','ECONNREFUSED','42501']){const error=Object.assign(new Error('timeout expired'),{code});assert.equal(actualOwner.asSafeError(error,'database-connect').code,code);}});
 await test('No arbitrary code/message or CLI private text is copied into safe errors',()=>{assert.equal(actualOwner.asSafeError(Object.assign(new Error(marker),{code:marker}),'database-connect').code,'PREREQUISITE_OR_OPERATION_FAILED');assert.equal(actualOwner.asSafeError(new CliFailure(),'database-connect').code,'CLI_CONTROLLED');});
 await test('A successful first attempt adds no failure receipt or retry',async()=>{failure=null;const before=attempts,saved=records.length,closed=ended;const client=await actualOwner.connect('postgres');assert.equal(attempts,before+1);assert.equal(records.length,saved);assert.equal(ended,closed);await client.end();});
 for(const code of ['DB_CONNECTION_TIMEOUT','DB_CONNECTION_EOF','DB_CONNECTION_ENDED','PREREQUISITE_OR_OPERATION_FAILED']){
  await test('Lease still fails closed on '+code+' without current-socket fallback or retry',async()=>{
   let clock=0,opens=0,queries=0;const client={connect:async()=>{},query:async()=>{queries++;return {rows:[]};},end:async()=>{},on:()=>{}};
   const lease=actualOwner.createAdminMeasurementControlLease(client,{connect:async()=>{opens++;throw new actualOwner.IsolatedSupabaseError(code,'database-connect');},assertHealthy(){},assertOwned:async()=>{},watch(){},replaced(){throw Error('must not publish');},record(){throw Error('must not defer');},now:()=>clock});
   clock=240_000;await assert.rejects(lease.renewIfDue(true),error=>error.code===code);assert.equal(opens,1);assert.equal(queries,0);assert.equal(lease.client,client);
  });
 }
 // Actual installed pg, one attempt per disposable loopback listener. No Docker,
 // database, credentials, SQL, retries, or production-owner timeout override.
 for(const kind of ['eof','timeout']){
  await test('Installed pg code-less '+kind+' reaches the exact safe diagnostic boundary',async()=>{
   const sockets=new Set(),server=createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{});if(kind==='eof')socket.once('data',()=>socket.end());});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port,observed=[];let opened=0;
   const actual=owner({pg:{Client:class extends pg.Client{constructor(config){opened++;super(config);}}},databaseUrl:()=> 'postgresql://diagnostic@127.0.0.1:'+port+'/postgres',performance,hostBridge:undefined,safeRecord:(stage,metadata)=>observed.push({stage,...metadata})});
   try{await assert.rejects(actual.connect('postgres'),error=>error.code===(kind==='eof'?'DB_CONNECTION_EOF':'DB_CONNECTION_TIMEOUT'));assert.equal(opened,1);assert.equal(observed.length,1);assert.equal(observed[0].pgMessageClass,kind==='eof'?'pg_unexpected_end':'pg_timeout_expired');assert.ok(observed[0].elapsedMs>=0);if(kind==='timeout')assert.ok(observed[0].elapsedMs>=4500);assert.ok(!JSON.stringify(observed).includes('postgresql'));}
   finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
  });
 }
 return {status:'pass',checks:checks.length,cases:checks,boundary:'Actual owner functions and installed-pg loopback failures; no Docker/Production, transport retry, timeout, lease or capacity modification.'};
}

if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const candidate=process.argv.includes('--candidate'),file=candidate?'.tmp-qa/core-final-closure/r10-safe-connect-diagnostics/files/scripts/lib/isolated-supabase.mts':'scripts/lib/isolated-supabase.mts';
 console.log(JSON.stringify(await verifyIsolatedConnectDiagnostics(readFileSync(file,'utf8')),null,2));
}

