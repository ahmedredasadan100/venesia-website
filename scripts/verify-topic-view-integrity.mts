import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";

type Database = {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
};
type Result = { data: unknown; error: { message: string } | null };
type Context = {
  db: Database; rpcDb: Database; native: boolean;
  load(file: string): unknown; read(file: string): string;
  stubs: Map<string, unknown>; rpcCalls(): number;
  inject(value: (() => Promise<Result>) | undefined): void;
};

export async function verifyTopicViewIntegrity({ db, rpcDb, native, load, read, stubs, rpcCalls, inject }: Context) {
  const originalEnv = { ...process.env };
  const secret = "isolated-fixture-only-signing-key-32-characters";
  let preview = false;
  stubs.set("next/headers", { draftMode: async () => ({ isEnabled: preview }) });
  const security = load("src/lib/content/topic-view-security.ts") as typeof import("../src/lib/content/topic-view-security.ts");
  const route = load("src/app/api/content/topics/[id]/view/route.ts") as typeof import("../src/app/api/content/topics/[id]/view/route.ts");
  const maintenance = load("src/app/api/content/topics/view-maintenance/route.ts") as typeof import("../src/app/api/content/topics/view-maintenance/route.ts");
  const cookie = () => `${security.TOPIC_VIEW_COOKIE}=${security.issueTopicViewVisitor(secret, 2592000)}`;
  const post = (id = "1", visitor?: string, ip = "192.0.2.10", origin = "https://fixture.example") =>
    route.POST(new Request(`${origin}/api/content/topics/${id}/view`, {
      method: "POST", headers: { ...(visitor ? { cookie: visitor } : {}), "x-vercel-forwarded-for": ip },
    }), { params: Promise.resolve({ id }) });
  const count = async () => (await db.query<{ value: number }>("select views_count::integer as value from public.topics where id=1")).rows[0].value;
  const key = (value: string) => createHash("sha256").update(value).digest("hex");
  const direct = async (visitor: string | null, ip = key("direct-ip"), topic = 1) =>
    (await rpcDb.query<{ value: { outcome: string; retry_after_seconds?: number } }>(
      "select public.increment_topic_view($1,$2,$3) as value", [topic, visitor, ip])).rows[0].value;
  const cleanRates = () => db.exec("truncate public.topic_view_request_limits");
  const ledger = async () => (await db.query(`select
    (select jsonb_agg(d order by visitor_key,topic_id) from public.topic_view_deduplication d) as dedup,
    (select jsonb_agg(r order by scope,identity_key) from public.topic_view_request_limits r) as limits,
    (select jsonb_agg(t order by id) from public.topics t) as topics`)).rows[0];
  try {
    Object.assign(process.env, { VERCEL: "1", VERCEL_ENV: "production", CI: "false", NEXT_PUBLIC_SITE_URL: "https://fixture.example", TOPIC_VIEW_SIGNING_SECRET: secret });
    for (const table of ["topic_view_policy", "topic_view_deduplication", "topic_view_request_limits"]) {
      const privileges = await db.query<{ privilege_type: string; is_grantable: boolean }>(`select a.privilege_type,a.is_grantable
        from pg_class c cross join lateral aclexplode(c.relacl) a
        where c.oid=$1::regclass and a.grantee='service_role'::regrole order by a.privilege_type`, [`public.${table}`]);
      assert.deepEqual(privileges.rows.map(row => row.privilege_type), table === "topic_view_policy"
        ? ["SELECT"] : ["DELETE", "INSERT", "SELECT", "UPDATE"], `Final service_role privileges: ${table}`);
      assert.ok(privileges.rows.every(row => !row.is_grantable));
    }
    // Native rpcDb already uses service_role on every independent connection.
    // PGlite uses one connection, so set/reset the real SQL role explicitly.
    if (!native) await db.exec("set role service_role");
    try {
      await assert.rejects(rpcDb.query("update public.topic_view_policy set visitor_request_limit=999 where singleton"), /permission denied for table topic_view_policy/);
      await assert.rejects(rpcDb.query("delete from public.topic_view_policy where singleton"), /permission denied for table topic_view_policy/);
    } finally { if (!native) await db.exec("reset role"); }
    console.log("PASS PUB-07 ACL: pre-existing default ALL grants reduced to exact final privileges; service_role policy UPDATE/DELETE rejected.");
    assert.deepEqual((await db.query("select cookie_ttl_seconds,dedupe_seconds,rate_window_seconds,visitor_request_limit,ip_request_limit from public.topic_view_policy")).rows[0], {
      cookie_ttl_seconds: 2592000, dedupe_seconds: 86400, rate_window_seconds: 60, visitor_request_limit: 30, ip_request_limit: 300,
    });
    const original = await ledger();
    const beforeExcluded = rpcCalls();
    for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL: "" }, { CI: "true" }, { CI: "1" }]) {
      const previous = { ...process.env }; Object.assign(process.env, env);
      assert.equal((await (await post()).json()).outcome, "excluded");
      process.env = previous;
    }
    for (const origin of ["http://localhost:3000", "https://127.0.0.1", "https://fixture-preview.example"]) {
      assert.equal((await (await post("1", undefined, "192.0.2.10", origin)).json()).outcome, "excluded");
    }
    preview = true; assert.equal((await (await post()).json()).outcome, "excluded"); preview = false;
    assert.equal(rpcCalls(), beforeExcluded); assert.deepEqual(await ledger(), original);
    assert.doesNotMatch(read("src/app/admin/content/topics/[id]/preview/page.tsx"), /TopicViewTracker/);

    const bootstrap = await post();
    assert.equal(bootstrap.status, 202); assert.equal(await count(), 418);
    const setCookie = bootstrap.headers.get("set-cookie")!;
    for (const part of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=2592000"]) assert.ok(setCookie.includes(part));
    const visitor = setCookie.split(";")[0];
    assert.equal((await (await post("1", visitor)).json()).outcome, "counted");
    assert.equal(await count(), 419);
    const countedLedger = (await db.query("select * from public.topic_view_deduplication")).rows;
    assert.equal((await (await post("1", visitor)).json()).outcome, "duplicate");
    assert.equal((await (await post("1", visitor, "192.0.2.11")).json()).outcome, "duplicate", "IP movement is not a new visitor");
    assert.equal(await count(), 419);
    assert.deepEqual((await db.query("select * from public.topic_view_deduplication")).rows, countedLedger, "duplicates never extend the window");
    for (const value of [undefined, `${security.TOPIC_VIEW_COOKIE}=invalid`, `${visitor}0`, `${visitor}; ${visitor}`,
      `${security.TOPIC_VIEW_COOKIE}=${security.issueTopicViewVisitor(secret, 60, Date.now() - 120000)}`]) {
      assert.equal((await post("1", value)).status, 202); assert.equal(await count(), 419);
    }
    for (const id of ["2", "3", "999"]) assert.equal((await post(id, cookie())).status, 404);
    for (const id of ["0", "-1", "1.5", "1e0", "abc", "9007199254740993", "9".repeat(400)]) {
      assert.equal((await post(id, cookie())).status, 400);
    }
    await cleanRates();
    await db.exec("update public.topic_view_deduplication set counted_at=now()-interval '24 hours 1 second', expires_at=now()-interval '1 second'");
    assert.equal((await (await post("1", visitor)).json()).outcome, "counted");
    assert.equal(await count(), 420);

    // Native mode uses 40 independent PostgreSQL connections as service_role.
    // PGlite executes the same regression cases but cannot establish contention.
    await cleanRates();
    const concurrentVisitor = cookie();
    const burst = await Promise.all(Array.from({ length: 40 }, () => post("1", concurrentVisitor)));
    const outcomes = await Promise.all(burst.map(response => response.clone().json()));
    assert.equal(outcomes.filter(row => row.outcome === "counted").length, 1);
    assert.equal(outcomes.filter(row => row.outcome === "duplicate").length, 29);
    assert.equal(burst.filter(row => row.status === 429).length, 10);
    for (const response of burst.filter(row => row.status === 429)) {
      assert.ok(Number(response.headers.get("retry-after")) >= 1 && Number(response.headers.get("retry-after")) <= 60);
    }
    assert.equal(await count(), 421);
    await cleanRates();
    const ipBurst = await Promise.all(Array.from({ length: 301 }, (_, index) => direct(key(`ip-visitor-${index}`), key("shared-ip"))));
    assert.equal(ipBurst.filter(row => row.outcome === "counted").length, 300);
    assert.equal(ipBurst.filter(row => row.outcome === "rate_limited").length, 1);
    assert.equal(await count(), 721);
    const expiredIp = key("shared-ip");
    await db.query("update public.topic_view_request_limits set request_times=array[now()-interval '61 seconds'],expires_at=now()-interval '1 second' where identity_key=$1", [expiredIp]);
    assert.equal((await direct(key("after-window"), expiredIp)).outcome, "counted");
    assert.equal(await count(), 722);
    assert.ok((await db.query<{ size: number }>("select max(cardinality(request_times))::integer as size from public.topic_view_request_limits")).rows[0].size <= 300);
    await cleanRates();
    const crossIp = key("cross-ip-visitor");
    const moving = await Promise.all(Array.from({ length: 40 }, (_, i) => direct(crossIp, key(`ip-${i}`))));
    assert.equal(moving.filter(row => row.outcome === "counted").length, 1);
    assert.equal(moving.filter(row => row.outcome === "duplicate").length, 29);
    assert.equal(moving.filter(row => row.outcome === "rate_limited").length, 10);

    await assert.rejects(rpcDb.query("select public.increment_topic_view(1)"), /does not exist/);
    await assert.rejects(rpcDb.query("update public.topics set views_count=views_count+1 where id=1"), /topic_view_protected_increment_required/);
    await assert.rejects(direct(null, ""), /topic_view_identity_invalid/);
    const acl = await db.query<{ allowed: boolean }>(`select has_function_privilege(role_name,'public.increment_topic_view(bigint,text,text)','EXECUTE') as allowed from (values ('anon'),('authenticated')) roles(role_name)`);
    assert.ok(acl.rows.every(row => !row.allowed));
    assert.equal((await db.query<{ n: number }>("select count(*)::integer as n from pg_policies where tablename like 'topic_view_%'")).rows[0].n, 0);
    assert.equal((await db.query<{ n: number }>("select count(*)::integer as n from pg_class where relname in ('topic_view_policy','topic_view_deduplication','topic_view_request_limits') and relrowsecurity")).rows[0].n, 3);
    const beforeFailure = await ledger();
    await db.exec(`create function reject_view_ledger() returns trigger language plpgsql as $$ begin raise exception 'fixture_after_increment_failure'; end $$;
      create trigger reject_view_ledger before insert on public.topic_view_deduplication for each row execute function reject_view_ledger();`);
    const failure = await post("1", cookie(), "192.0.2.99");
    assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /fixture_after_increment/);
    assert.deepEqual(await ledger(), beforeFailure, "failure after +1 rolls back counter, admission and dedup together");
    await db.exec("drop trigger reject_view_ledger on public.topic_view_deduplication");
    for (const data of [null, {}, 1, { outcome: "counted" }, { outcome: "rate_limited", retry_after_seconds: 0, cookie_ttl_seconds: 2592000 }]) {
      inject(async () => ({ data, error: null })); assert.equal((await post("1", cookie())).status, 503);
    }
    inject(async () => { throw new Error("private transport failure"); });
    assert.equal((await post("1", cookie())).status, 503); inject(undefined);
    const lostVisitor = cookie();
    const digest = security.readTopicViewVisitor(new Request("https://fixture.example", { headers: { cookie: lostVisitor } }), secret)!;
    const beforeLost = await count();
    inject(async () => { await direct(digest, key("lost-ip")); throw new Error("response lost after commit"); });
    assert.equal((await post("1", lostVisitor)).status, 503); inject(undefined);
    assert.equal((await (await post("1", lostVisitor)).json()).outcome, "duplicate");
    assert.equal(await count(), beforeLost + 1);
    const beforeProtectionFailure = await ledger();
    delete process.env.TOPIC_VIEW_SIGNING_SECRET;
    assert.equal((await post("1", cookie())).status, 503); process.env.TOPIC_VIEW_SIGNING_SECRET = secret;
    assert.equal((await post("1", cookie(), "")).status, 503);
    assert.equal((await post("1", cookie(), "192.0.2.1, 192.0.2.2")).status, 503);
    assert.deepEqual(await ledger(), beforeProtectionFailure);
    await db.exec(`create function reject_rate() returns trigger language plpgsql as $$ begin raise exception 'fixture_rate_failure'; end $$;
      create trigger reject_rate before insert on public.topic_view_request_limits for each row execute function reject_rate();`);
    assert.equal((await post("1", cookie())).status, 503); assert.deepEqual(await ledger(), beforeProtectionFailure);
    await db.exec("drop trigger reject_rate on public.topic_view_request_limits");

    process.env.CRON_SECRET = "isolated-existing-cron-contract";
    assert.equal((await maintenance.GET(new Request("https://fixture.example"))).status, 401);
    const maintenanceRequest = new Request("https://fixture.example", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const beforePrune = await count();
    await db.exec("update public.topic_view_deduplication set counted_at=now()-interval '25 hours',expires_at=now()-interval '1 hour'");
    await db.exec("update public.topic_view_request_limits set expires_at=now()-interval '1 second'");
    const prune = await maintenance.GET(maintenanceRequest); assert.equal(prune.status, 200);
    const removed = await prune.json(); assert.ok(removed.deduplication_deleted > 0 && removed.limits_deleted > 0);
    assert.equal(await count(), beforePrune);
    assert.equal((await db.query("select * from public.topic_view_deduplication")).rows.length, 0);
    assert.equal((await db.query("select * from public.topic_view_request_limits")).rows.length, 0);
    assert.equal((await db.query("select is_popular from public.topics where id=1")).rows[0].is_popular, true);
    await verifyMaintenanceProxy({ db, load, stubs, rpcCalls, maintenance });
    console.log(`PASS PUB-07 ${native ? "PostgreSQL independent-connection contention" : "PGlite regression"}: production/preview, signed cookie, rolling dedup, 40 concurrent requests, both limits, moving IP, expiry, protected writer/ACL, rollback, lost response retry, failure closure, bounded retention.`);
  } finally { inject(undefined); process.env = originalEnv; }
}

async function verifyMaintenanceProxy({ db, load, stubs, rpcCalls, maintenance }: Pick<Context, "db" | "load" | "stubs" | "rpcCalls"> & {
  maintenance: typeof import("../src/app/api/content/topics/view-maintenance/route.ts");
}) {
  let maintenanceOn = false;
  let activeAdmin = true;
  let handlerCalls = 0;
  const stub = (file: string, value: unknown) => stubs.set(path.resolve(import.meta.dirname, "..", file), value);
  stub("src/lib/maintenance/read-maintenance-mode.ts", { isMaintenanceModeEnabled: async () => maintenanceOn });
  stub("src/lib/redirects/resolve-public-redirect.ts", { resolvePublicRedirect: async () => null });
  stub("src/lib/admin/auth/admin-users.ts", { validateAdminSessionPayload: async () => activeAdmin });
  const { NextRequest } = createRequire(import.meta.url)("next/server") as typeof import("next/server");
  const { proxy, config } = load("src/proxy.ts") as typeof import("../src/proxy.ts");
  const session = load("src/lib/admin/auth/session.ts") as typeof import("../src/lib/admin/auth/session.ts");
  process.env.ADMIN_SESSION_SECRET = "isolated-admin-session-proxy-fixture";
  const adminCookie = `${session.ADMIN_SESSION_COOKIE}=${session.createAdminSessionToken(
    { id: 1, username: "isolated-fixture", sessionVersion: 1 }, process.env.ADMIN_SESSION_SECRET)}`;
  const url = "https://fixture.example/api/content/topics/view-maintenance";
  const authorized = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  // Next 16.3's installed export retains the Middleware name despite the
  // bundled guide showing doesProxyMatch. Use the real installed matcher.
  const { unstable_doesMiddlewareMatch } = createRequire(import.meta.url)("next/experimental/testing/server") as typeof import("next/experimental/testing/server");
  assert.equal(unstable_doesMiddlewareMatch({ config, url }), true, "framework matcher must reach the proxy");
  const throughProxy = async (headers: Record<string, string> = {}) => {
    const request = new NextRequest(url, { headers });
    const decision = await proxy(request);
    if (decision.headers.get("x-middleware-next") !== "1") return decision;
    handlerCalls++;
    return maintenance.GET(request); // real handler -> real SQL RPC as service_role
  };
  const before = (await db.query("select * from public.topics order by id")).rows;
  const unauthorizedHeaders: Array<Record<string, string>> = [{}, { authorization: "Bearer wrong-cron-secret" }];
  for (maintenanceOn of [true, false]) {
    const callsBefore = rpcCalls();
    const handlersBefore = handlerCalls;
    for (const headers of unauthorizedHeaders) {
      const response = await throughProxy(headers);
      assert.equal(response.status, maintenanceOn ? 503 : 401);
    }
    assert.equal(handlerCalls, handlersBefore + (maintenanceOn ? 0 : 2));
    assert.equal(rpcCalls(), callsBefore, "unauthorized requests never reach SQL cleanup");
    // An Admin maintenance bypass still cannot authorize the Cron handler.
    assert.equal((await throughProxy({ cookie: adminCookie })).status, 401);
    assert.equal(rpcCalls(), callsBefore);
    await db.exec(`insert into public.topic_view_deduplication values(repeat('a',64),1,now()-interval '25 hours',now()-interval '1 hour');
      insert into public.topic_view_request_limits values('ip',repeat('b',64),array[now()-interval '61 seconds'],now()-interval '1 second');`);
    const clean = await throughProxy(authorized);
    assert.equal(clean.status, 200);
    assert.deepEqual(await clean.json(), { deduplication_deleted: 1, limits_deleted: 1 });
    assert.equal(rpcCalls(), callsBefore + 1);
    assert.equal((await db.query("select * from public.topic_view_deduplication")).rows.length, 0);
    assert.equal((await db.query("select * from public.topic_view_request_limits")).rows.length, 0);

    for (const endpoint of ["/api/admin/entity-lists/topics", "/api/admin/integrations/sync"]) {
      assert.equal((await proxy(new NextRequest(`https://fixture.example${endpoint}`, { headers: authorized }))).status, 401,
        "Cron bearer must never replace Admin session authentication");
    }
    const adminRedirect = await proxy(new NextRequest("https://fixture.example/admin/content/topics", { headers: authorized }));
    assert.equal(new URL(adminRedirect.headers.get("location")!).pathname, "/admin/login");
    assert.equal((await proxy(new NextRequest("https://fixture.example/api/admin/entity-lists/topics", { headers: { cookie: adminCookie } }))).headers.get("x-middleware-next"), "1");
    activeAdmin = false;
    assert.equal((await proxy(new NextRequest("https://fixture.example/api/admin/entity-lists/topics", { headers: { cookie: adminCookie } }))).status, 401);
    activeAdmin = true;
    if (maintenanceOn) {
      for (const endpoint of ["/api/content/topics/1/view", "/api/content/topics/view-maintenance/extra"]) {
        assert.equal((await proxy(new NextRequest(`https://fixture.example${endpoint}`, { headers: authorized }))).status, 503);
      }
      assert.equal((await proxy(new NextRequest(url, { method: "POST", headers: authorized }))).status, 503);
    }
  }
  assert.deepEqual((await db.query("select * from public.topics order by id")).rows, before);
  console.log("PASS PUB-07 maintenance: actual framework matcher -> proxy -> handler -> SQL cleanup with maintenance ON/OFF; unauthorized blocked, exact GET scope, Admin/session boundary preserved, counters unchanged.");
}
