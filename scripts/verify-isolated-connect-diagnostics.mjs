import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import pg from 'pg';
import { waitForOwnedDatabaseCapacity } from './lib/isolated-supabase-transport.mjs';

function extract(source){
 const ast=ts.createSourceFile('owner.ts',source,ts.ScriptTarget.Latest,true),wanted=new Set(['OWNER','IsolatedSupabaseError','fail','requireThat','classifyOwnedPgConnectMessage','describeOwnedPgConnectFailure','describeOwnedPgClientFailure','observeApplicationClient','createAdminMeasurementControlLease','transportCodes','ownerTransportCodes','asSafeError','connect']),parts=new Map();
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
 const options=[],capacityBudgets=[];
 class ControlledClient{constructor(config){options.push(config);}async connect(){attempts++;if(failure)throw failure;}async end(){ended++;}}
 function owner(extra={}){
  const loaded={exports:{}},ports={waitForOwnedDatabaseCapacity:async bridge=>{const budget=await waitForOwnedDatabaseCapacity(bridge);capacityBudgets.push(budget);return budget;},pg:{Client:ControlledClient},inspectCaptured:async()=>{inspections++;},serviceResource:()=>({owned:true}),databaseUrl:()=>marker,hostBridge:{snapshot:()=>{snapshots++;return {accepted:snapshots,rejected:0,failed:0,closed:0,active:1,localProcesses:1,stopping:false,listeners:[{host:marker,port:99}]};}},safeRecord:(stage,metadata)=>{if(recordFailure)throw Error(marker);records.push({stage,...metadata});},performance:{now:()=>{time+=4.8;return time;}},IsolatedSupabaseCliError:CliFailure,...extra};
  new Function(...Object.keys(ports),'module','exports',compiled)(...Object.values(ports),loaded,loaded.exports);return loaded.exports;
 }
 const actualOwner=owner();const test=async(name,work)=>{await work();checks.push(name);};
 const failureWrite=(()=>{
  const ast=ts.createSourceFile('owner.mts',source,ts.ScriptTarget.Latest,true),writes=[];
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='recordFile'&&node.arguments[0]?.getText(ast)==='"failure.json"')writes.push(node);ts.forEachChild(node,visit);}
  visit(ast);assert.equal(writes.length,1);
  return new Function('primaryFailure','preparation','recordFile',ts.transpileModule(writes[0].getText(ast)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText);
 })();
 await test('Actual observer and lifecycle evidence retain bounded first cause and safe stack positions',async()=>{
  const client=new EventEmitter(),facts=[],privateCause=Object.assign(new Error(marker),{code:'ECONNRESET'});
  privateCause.stack='Error: '+marker+'\n    at privateFunction (C:\\private-user\\node_modules\\pg\\lib\\connection.js:64:12)';
  const original=Object.assign(new Error('Connection terminated unexpectedly',{cause:privateCause}),{code:'EPIPE'});
  original.stack='Error: '+marker+'\n    at privateFunction (C:\\private-user\\node_modules\\pg\\lib\\client.js:175:19)\n    at Socket.emit (node:events:518:28)\n    at privateFunction (C:\\private-user\\private-file.js:1:2)';
  const observer=actualOwner.observeApplicationClient(client,row=>facts.push(row),()=>({phase:'ordered-source-floor',clientScope:'control',clientState:'current'}));
  const pending=observer.run(()=>new Promise(()=>{}));client.emit('error',original);
  await assert.rejects(pending,error=>{
   assert.equal(error.cause,original);assert.equal(error.cause.cause,privateCause);
   assert.equal(Object.getOwnPropertyDescriptor(error,'transportDiagnostic').enumerable,false);
   assert.equal(JSON.stringify(error).includes(marker),false);
   const diagnostic=error.transportDiagnostic,writes=[];
   failureWrite(error,undefined,(name,value)=>writes.push({name,value}));
   assert.equal(writes.length,1);assert.equal(writes[0].name,'failure.json');assert.equal(writes[0].value.rawErrorRetained,false);
   assert.deepEqual(JSON.parse(JSON.stringify(writes[0].value.transportDiagnostic)),JSON.parse(JSON.stringify(diagnostic)));
   assert.equal(diagnostic.pgCode,'EPIPE');assert.equal(diagnostic.pgMessageClass,'pg_unexpected_end');
   assert.equal(diagnostic.phase,'ordered-source-floor');assert.equal(diagnostic.clientScope,'control');assert.equal(diagnostic.clientState,'current');
   assert.equal(new Date(diagnostic.observedAtUtc).toISOString(),diagnostic.observedAtUtc);
   assert.equal(diagnostic.originalErrorRetainedPrivately,true);assert.equal(diagnostic.originalStackRetainedPrivately,true);
   assert.deepEqual(diagnostic.safeStackFrames,[{source:'pg-client',line:175,column:19},{source:'node-events',line:518,column:28}]);
   assert.equal(diagnostic.causes.length,1);assert.equal(diagnostic.causes[0].pgCode,'ECONNRESET');
   assert.deepEqual(diagnostic.causes[0].safeStackFrames,[{source:'pg-connection',line:64,column:12}]);
   assert.equal(diagnostic.causeChainTruncated,false);
   for(const value of [diagnostic,writes]){const text=JSON.stringify(value);for(const forbidden of [marker,'private-user','privateFunction','private-file','Error:','postgresql://'])assert.equal(text.includes(forbidden),false);}
   client.emit('error',new Error('later'));assert.throws(()=>observer.assertHealthy(),retained=>retained===error);assert.equal(facts.length,1);
   assert.deepEqual(facts,[{pgCode:'EPIPE',pgMessageClass:'pg_unexpected_end'}]);return true;
  });
 });
 await test('Receipt failure preserves original diagnostic and exact private error identities',async()=>{
  const client=new EventEmitter(),original=new Error('Connection terminated unexpectedly'),secondary=new Error(marker);
  const observer=actualOwner.observeApplicationClient(client,()=>{throw secondary;},()=>({phase:'inactive',clientScope:'control',clientState:'non_current'}));
  const pending=observer.run(()=>new Promise(()=>{}));client.emit('error',original);
  await assert.rejects(pending,error=>{assert.equal(error.code,'APPLICATION_CLIENT_RECEIPT_FAILED');assert.equal(error.cause.cause,original);assert.equal(error.receiptCause,secondary);assert.equal(error.transportDiagnostic,error.cause.transportDiagnostic);assert.equal(error.transportDiagnostic.clientState,'non_current');assert.equal(JSON.stringify(error.transportDiagnostic).includes(marker),false);return true;});
 });
 await test('Runtime intrinsic Error stack accessor and ordinary stack data remain readable',()=>{
  const original=new Error(marker),descriptor=Object.getOwnPropertyDescriptor(original,'stack');
  assert.ok(descriptor);
  if(descriptor.get)assert.equal(descriptor.get,Object.getOwnPropertyDescriptor(new Error(),'stack').get);
  const native=actualOwner.describeOwnedPgClientFailure(original);
  assert.equal(native.originalStackRetainedPrivately,true);assert.equal(JSON.stringify(native).includes(marker),false);
  const data=new Error(marker);Object.defineProperty(data,'stack',{value:'Error: '+marker+'\n    at Socket.emit (node:events:518:28)',configurable:true});
  const projected=actualOwner.describeOwnedPgClientFailure(data);
  assert.equal(projected.originalStackRetainedPrivately,true);assert.deepEqual(projected.safeStackFrames,[{source:'node-events',line:518,column:28}]);
 });
 await test('Diagnostic projection bounds cycles, cause depth, frames and accessor fields',()=>{
  const original=new Error(marker);let previous=original;
  for(let index=0;index<5;index++){const cause=new Error(marker);Object.defineProperty(previous,'cause',{value:cause});previous=cause;}
  original.stack='Error: '+marker+'\n'+Array.from({length:40},()=> '    at Socket.emit (node:events:518:28)').join('\n');
  Object.defineProperty(original,'code',{get(){throw Error('must not read code accessor');}});
  const diagnostic=actualOwner.describeOwnedPgClientFailure(original,{phase:marker,clientScope:'scoped',clientState:'scoped'});
  assert.equal(diagnostic.pgCode,null);assert.equal(diagnostic.phase,'application-handoff');assert.equal(diagnostic.causes.length,3);assert.equal(diagnostic.causeChainTruncated,true);assert.equal(diagnostic.safeStackFrames.length,8);
  const cycle=new Error(marker);Object.defineProperty(cycle,'cause',{value:cycle});const circular=actualOwner.describeOwnedPgClientFailure(cycle);assert.equal(circular.causes.length,0);assert.equal(circular.causeChainTruncated,true);assert.equal(circular.clientState,'unknown');
  const accessors=new Error();for(const key of ['stack','cause'])Object.defineProperty(accessors,key,{get(){throw Error(marker);}});
  const safe=actualOwner.describeOwnedPgClientFailure(accessors);assert.deepEqual(safe.safeStackFrames,[]);assert.equal(safe.causes.length,0);assert.equal(safe.originalStackRetainedPrivately,false);
 });
 await test('Healthy observer performs no diagnostic context work or failure evidence write',async()=>{
  const client=new EventEmitter();let calls=0,records=0;
  const observer=actualOwner.observeApplicationClient(client,()=>{records++;},()=>{calls++;throw Error(marker);});
  assert.equal(await observer.run(async()=>42),42);assert.equal(calls,0);assert.equal(records,0);
  const pending=observer.run(()=>new Promise(()=>{}));client.emit('error',new Error('Connection terminated unexpectedly'));
  await assert.rejects(pending,error=>error.code==='APPLICATION_CLIENT_DISCONNECTED'&&error.transportDiagnostic.clientState==='unknown');
  assert.equal(calls,1);assert.equal(records,1);
 });
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
  assert.equal(capacityBudgets.length,1);assert.ok(Number.isInteger(capacityBudgets[0])&&capacityBudgets[0]>0&&capacityBudgets[0]<=5000);
  assert.deepEqual(options[0],{connectionString:marker,connectionTimeoutMillis:capacityBudgets[0],ssl:false,options:'',statement_timeout:30000,query_timeout:30000,application_name:'isolated-supabase'});
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

