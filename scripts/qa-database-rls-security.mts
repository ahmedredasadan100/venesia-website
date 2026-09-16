import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runIsolatedSupabase, type OwnedLocalHandle } from "./lib/isolated-supabase.mts";
import { applyCanonicalApplicationVerificationPrefix } from "./lib/isolated-public-application.mts";
import { captureDatabaseRlsRoleMetadata, verifyDatabaseRlsRoleBehavior } from "./lib/database-rls-role-verification.mts";
import { loadDatabaseSecurityContract, captureDatabaseSecurityCatalog, assertDatabaseSecurityCatalog } from "./lib/database-rls-security-contract.mts";

const root = resolve(import.meta.dirname, "..");
const values = new Map<string,string>();
let captureOnly = false;
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i];
  if(key==="--capture-only") { assert.equal(captureOnly,false);captureOnly=true;continue; }
  assert.ok(["--output","--cli-binary","--docker-host"].includes(key) && !values.has(key) && process.argv[i+1]);
  values.set(key,process.argv[++i]);
}
assert.ok(values.has("--output") && values.has("--cli-binary"));
const output=resolve(values.get("--output")!);
assert.ok(output.startsWith(resolve(root,".tmp-qa")+"\\") && !existsSync(output));
mkdirSync(output,{recursive:true});
const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+"\n");
const hash=(source:string)=>createHash("sha256").update(source).digest("hex");
const securityVersion="20260819040000";
const securityPath=resolve(root,`sql/migrations/${securityVersion}_database_rls_security_contract.sql`);
const immutable86=readFileSync(resolve(root,"sql/migrations/20260819041808_harden_rls_auto_enable_execute_acl.sql"),"utf8");
function corpus(){return readdirSync(resolve(root,"sql/migrations")).filter(file=>/^\d{14}_[a-z0-9_]+\.sql$/u.test(file)).sort().map(file=>({file,version:file.slice(0,14),name:file.slice(15,-4),sql:readFileSync(resolve(root,"sql/migrations",file),"utf8").replace(/\r\n?/gu,"\n")}));}
const sourcePaths=[securityPath,import.meta.filename,
  resolve(root,"scripts/lib/database-rls-security-contract.mts"),resolve(root,"scripts/lib/database-rls-role-verification.mts"),
  resolve(root,"scripts/lib/isolated-supabase-cli.mts"),
  resolve(root,"scripts/lib/isolated-public-application.mts")];
const sources=()=>Object.fromEntries(sourcePaths.map(file=>[file,hash(readFileSync(file,"utf8").replace(/\r\n?/gu,"\n"))]));
const frozenSources=sources();
save("source-identities.json",frozenSources);
const contract=captureOnly?null:loadDatabaseSecurityContract(corpus(),{throughVersion:securityVersion});
let currentStage="bootstrap";
try {
  await runIsolatedSupabase({
    lockPath:resolve(root,"scripts/fixtures/isolated-supabase/stack.lock.json"),
    artifactDir:resolve(output,"runtime"),cliBinary:resolve(values.get("--cli-binary")!),
    dockerHost:values.get("--docker-host"),
    async handoff(handle:OwnedLocalHandle) {
      currentStage="prefix85";
      save("prefix85.json",await applyCanonicalApplicationVerificationPrefix(handle,"20260818010000"));
      currentStage="capture-before-security";
      const before=await captureDatabaseRlsRoleMetadata(handle);
      save("before-security.json",before);
      save("catalog-ordering.json",(await handle.query(`select
        (select jsonb_build_object('collation',datcollate,'ctype',datctype,'provider',datlocprovider)
         from pg_catalog.pg_database where datname=current_database()) as database_locale,
        jsonb_agg(value::"char" order by value::"char") as catalog_char_order,
        jsonb_agg(value order by value) as json_text_order,
        jsonb_agg(value order by value collate "C") as canonical_text_order
        from (values ('S'::text),('r'::text)) as objects(value)`)).rows);
      process.stdout.write(JSON.stringify({stage:"isolated85-captured",output,productionAccess:false})+"\n");
      if(captureOnly){save("outcome.json",{status:"isolated85-captured-only",securityMigrationApplied:false});return;}
      assert.equal(readFileSync(resolve(root,"sql/migrations/20260819041808_harden_rls_auto_enable_execute_acl.sql"),"utf8"),immutable86);
      assert.deepEqual(sources(),frozenSources,"Security proof source changed.");
      assert.ok(contract);
      currentStage="apply-security-migration";
      save("security-migration.json",await applyCanonicalApplicationVerificationPrefix(handle,securityVersion));
      currentStage="capture-after-security";
      const catalog=await captureDatabaseSecurityCatalog(handle,contract);
      save("after-security-catalog.json",catalog);
      currentStage="verify-security-catalog";
      save("security-contract-proof.json",assertDatabaseSecurityCatalog(contract,catalog));
      currentStage="verify-role-behavior";
      save("role-behavior-proof.json",await verifyDatabaseRlsRoleBehavior(handle,contract,before));
      save("after-security.json",await captureDatabaseRlsRoleMetadata(handle));
      assert.deepEqual(sources(),frozenSources,"Security proof source changed.");
      assert.equal(readFileSync(resolve(root,"sql/migrations/20260819041808_harden_rls_auto_enable_execute_acl.sql"),"utf8"),immutable86);
      save("outcome.json",{status:"security-contract-verified",migration86Applied:false,productionRead:false,productionWrite:false});
      process.stdout.write(JSON.stringify({stage:"security-contract-verified",migration86Applied:false})+"\n");
    },
  });
} catch(error) {
  const code=typeof error==="object"&&error!==null&&"code" in error&&typeof error.code==="string"?error.code:"SECURITY_PROOF_STOP";
  save("outcome.json",{status:"stopped",stage:currentStage,code,productionRead:false,productionWrite:false});
  process.stderr.write(JSON.stringify({stage:"stopped",at:currentStage,code})+"\n");process.exitCode=1;
}
