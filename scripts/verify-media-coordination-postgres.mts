import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const required = process.env.MEDIA_COORDINATION_DATABASE_REQUIRED === "1";
const acknowledgedDisposable =
  process.env.MEDIA_COORDINATION_DATABASE_DISPOSABLE === "1";
const connectionString = process.env.MEDIA_COORDINATION_DATABASE_URL?.trim();

if (!connectionString) {
  if (required) {
    console.error(
      "FAIL verify-media-coordination-postgres: MEDIA_COORDINATION_DATABASE_URL is required.",
    );
    process.exit(1);
  }

  console.log(
    "SKIP verify-media-coordination-postgres: no isolated MEDIA_COORDINATION_DATABASE_URL was provided.",
  );
  process.exit(0);
}

let databaseUrl: URL;
try {
  databaseUrl = new URL(connectionString);
} catch {
  console.error(
    "FAIL verify-media-coordination-postgres: MEDIA_COORDINATION_DATABASE_URL is not a valid URL.",
  );
  process.exit(1);
}

const allowedProtocols = new Set(["postgres:", "postgresql:"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
const isolatedDatabaseName =
  databaseName === "venesia_media_coordination_ci" ||
  /(?:^|_)media_coordination_(?:test|ci)(?:_|$)/.test(databaseName);

if (
  !allowedProtocols.has(databaseUrl.protocol) ||
  !loopbackHosts.has(databaseUrl.hostname) ||
  !isolatedDatabaseName ||
  !acknowledgedDisposable
) {
  console.error(
    "FAIL verify-media-coordination-postgres: refusing a database that is not loopback-only, explicitly disposable, and named for media coordination test/CI.",
  );
  process.exit(1);
}

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const psqlBinary = process.env.PSQL_BIN?.trim() || "psql";
const setupSqlFiles = [
  "scripts/fixtures/media-coordination-postgres-bootstrap.sql",
  "sql/migrations/20250625400000_site_settings_footer.sql",
  "sql/migrations/20250625600000_admin_users.sql",
  "sql/migrations/20260725090000_media_catalog_reference_foundation.sql",
  "sql/migrations/20260725180000_media_delete_reservation_saga.sql",
  "scripts/fixtures/media-coordination-postgres-concurrency-setup.sql",
];

const versionProbe = spawnSync(psqlBinary, ["--version"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  windowsHide: true,
});

if (versionProbe.error || versionProbe.status !== 0) {
  console.error(
    `FAIL verify-media-coordination-postgres: PostgreSQL client is unavailable (${versionProbe.error?.message ?? versionProbe.stderr.trim()}).`,
  );
  process.exit(1);
}

function applySqlFile(relativePath: string) {
  const result = spawnSync(
    psqlBinary,
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      `--dbname=${connectionString}`,
      `--file=${path.join(repositoryRoot, relativePath)}`,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error || result.status !== 0) {
    console.error(
      `FAIL verify-media-coordination-postgres while applying ${relativePath}`,
    );
    if (result.stdout.trim()) console.error(result.stdout.trim());
    if (result.stderr.trim()) console.error(result.stderr.trim());
    if (result.error) console.error(result.error.message);
    process.exit(1);
  }

  console.log(`PASS ${relativePath}`);
}

type PsqlSessionResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

function startPsqlSession(input: {
  label: string;
  sql: string;
  readyMarker?: string;
}) {
  const child = spawn(
    psqlBinary,
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
      `--dbname=${connectionString}`,
      "--file=-",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, PGAPPNAME: `venesia-${input.label}` },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let markerObserved = !input.readyMarker;
  let resolveReady = () => {};
  let rejectReady: (reason?: unknown) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  if (markerObserved) resolveReady();

  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
    if (
      !markerObserved &&
      input.readyMarker &&
      stdout.includes(input.readyMarker)
    ) {
      markerObserved = true;
      resolveReady();
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 20_000);

  const completion = new Promise<PsqlSessionResult>((resolve) => {
    child.on("error", (error) => {
      stderr += error.message;
    });
    child.on("close", (status, signal) => {
      clearTimeout(timeout);
      if (!markerObserved && input.readyMarker) {
        rejectReady(
          new Error(
            `${input.label} exited before emitting ${input.readyMarker}: ${stderr || stdout}`,
          ),
        );
      }
      resolve({ status, signal, stdout, stderr, timedOut });
    });
  });

  child.stdin.end(input.sql);
  return { ready, completion };
}

function assertSuccessfulSession(label: string, result: PsqlSessionResult) {
  if (result.status !== 0 || result.timedOut) {
    throw new Error(
      `${label} failed (status=${result.status}, signal=${result.signal}, timedOut=${result.timedOut}): ${result.stderr || result.stdout}`,
    );
  }
}

function assertExpectedSessionFailure(
  label: string,
  result: PsqlSessionResult,
  expectedMessages: readonly string[],
) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (
    result.status === 0 ||
    result.timedOut ||
    /deadlock detected|lock timeout|statement timeout/i.test(output) ||
    !expectedMessages.some((message) => output.includes(message))
  ) {
    throw new Error(
      `${label} did not fail with the expected coordination result: ${output}`,
    );
  }
}

async function runSqlSession(label: string, sql: string) {
  const session = startPsqlSession({ label, sql });
  const result = await session.completion;
  assertSuccessfulSession(label, result);
}

async function verifyReverseOrderBatchLocking() {
  const first = startPsqlSession({
    label: "reverse-order-a",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c2.jpg","domainKey":"content","entityType":"topic","entityIdentity":"concurrent:batch"},{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c1.jpg","domainKey":"content","entityType":"topic","entityIdentity":"concurrent:batch"}]'::jsonb,
        null, 'ci-reverse-order-a', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  });
  const second = startPsqlSession({
    label: "reverse-order-b",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c1.jpg","domainKey":"content","entityType":"topic","entityIdentity":"concurrent:batch"},{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c2.jpg","domainKey":"content","entityType":"topic","entityIdentity":"concurrent:batch"}]'::jsonb,
        null, 'ci-reverse-order-b', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  });

  const results = await Promise.all([first.completion, second.completion]);
  const successes = results.filter(
    (result) => result.status === 0 && !result.timedOut,
  );
  const failures = results.filter(
    (result) => result.status !== 0 || result.timedOut,
  );
  if (successes.length !== 1 || failures.length !== 1) {
    throw new Error(
      `reverse-order acquisition was not atomic (successes=${successes.length}, failures=${failures.length})`,
    );
  }
  assertExpectedSessionFailure(
    "reverse-order contender",
    failures[0],
    ["media_write_lease_conflict"],
  );

  await runSqlSession(
    "reverse-order-cleanup",
    `
      \\set ON_ERROR_STOP on
      select public.fail_media_reference_write_lease(
        active.lease_token, 'concurrent:batch', 'ci-concurrency-cleanup', '{}'::jsonb, false
      )
      from (
        select distinct lease_token
        from public.media_reference_write_leases
        where request_identity in ('ci-reverse-order-a', 'ci-reverse-order-b')
          and status = 'active'
      ) active;
    `,
  );
  console.log(
    "PASS concurrent reverse-order multi-asset acquisition (one atomic winner, one conflict, no deadlock).",
  );
}

async function verifyReservationAgainstConcurrentWrites() {
  const reservation = startPsqlSession({
    label: "held-delete-reservation",
    readyMarker: "MEDIA_DELETE_RESERVATION_HELD",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      begin;
      select * from public.reserve_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000c3', null, 'ci-held-reservation',
        'supabase', 'images', 'coordination/concurrent-c3.jpg',
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
      \\echo MEDIA_DELETE_RESERVATION_HELD
      select pg_sleep(1.5);
      commit;
    `,
  });
  await reservation.ready;

  const lease = startPsqlSession({
    label: "lease-against-reservation",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c3.jpg","domainKey":"content","entityType":"topic","entityIdentity":"concurrent:stale"}]'::jsonb,
        null, 'ci-stale-lease', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  });
  const entityRebind = startPsqlSession({
    label: "entity-rebind-against-reservation",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select public.replace_media_references_for_entity(
        'content', 'topic', 'concurrent-stale-topic',
        '[{"assetId":"00000000-0000-0000-0000-0000000000c3","fieldKey":"image"}]'::jsonb,
        null, null
      );
    `,
  });
  const providerRebind = startPsqlSession({
    label: "provider-rebind-against-reservation",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select public.replace_media_references_for_provider(
        'concurrent.provider',
        '[{"assetId":"00000000-0000-0000-0000-0000000000c3","entityType":"topic","entityIdentity":"concurrent-stale-topic","fieldKey":"image"}]'::jsonb,
        '30000000-0000-0000-0000-000000000001',
        public.get_media_reference_provider_revision('concurrent.provider')
      );
    `,
  });

  const [reservationResult, leaseResult, entityResult, providerResult] =
    await Promise.all([
      reservation.completion,
      lease.completion,
      entityRebind.completion,
      providerRebind.completion,
    ]);
  assertSuccessfulSession("held delete reservation", reservationResult);
  assertExpectedSessionFailure("lease against reservation", leaseResult, [
    "media_write_lease_asset_not_active",
    "media_write_lease_delete_reserved",
  ]);
  assertExpectedSessionFailure("entity rebind against reservation", entityResult, [
    "media_reference_asset_not_active",
    "media_reference_delete_reserved",
  ]);
  assertExpectedSessionFailure("provider rebind against reservation", providerResult, [
    "media_reference_asset_not_active",
    "media_reconciliation_delete_reserved",
  ]);

  await runSqlSession(
    "held-reservation-cleanup",
    `
      \\set ON_ERROR_STOP on
      do $$
      begin
        if exists (
          select 1 from public.media_references
          where asset_id = '00000000-0000-0000-0000-0000000000c3'
        ) then
          raise exception 'concurrent_reserved_asset_was_rebound';
        end if;
      end;
      $$;
      select public.cancel_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000c3', reservation.id,
        'ci-concurrency-cleanup', '{}'::jsonb, 'exists', clock_timestamp()
      )
      from public.media_delete_reservations reservation
      where reservation.asset_id = '00000000-0000-0000-0000-0000000000c3'
        and reservation.status = 'reserved';
    `,
  );
  console.log(
    "PASS held delete reservation rejects concurrent lease/entity/provider rebind before any reference is committed.",
  );
}

async function verifyReverseOrderFailureRevisionLocking() {
  await runSqlSession(
    "failed-revision-order-setup",
    `
      \\set ON_ERROR_STOP on
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c8.jpg","domainKey":"concurrent.alpha","entityType":"topic","entityIdentity":"concurrent-fail-a"},{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c8.jpg","domainKey":"concurrent.beta","entityType":"topic","entityIdentity":"concurrent-fail-a"}]'::jsonb,
        null, 'ci-failed-revision-order-a', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c9.jpg","domainKey":"concurrent.beta","entityType":"topic","entityIdentity":"concurrent-fail-b"},{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c9.jpg","domainKey":"concurrent.alpha","entityType":"topic","entityIdentity":"concurrent-fail-b"}]'::jsonb,
        null, 'ci-failed-revision-order-b', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
      update public.media_reference_write_leases
      set write_targets = '[{"domainKey":"concurrent.beta","entityType":"topic","entityIdentity":"concurrent-fail-b"},{"domainKey":"concurrent.alpha","entityType":"topic","entityIdentity":"concurrent-fail-b"}]'::jsonb
      where request_identity = 'ci-failed-revision-order-b';
    `,
  );

  const first = startPsqlSession({
    label: "failed-revision-order-a",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select public.fail_media_reference_write_lease(
        lease_token, 'concurrent-fail-a', 'ci-concurrent-fail-a', '{}'::jsonb, false
      )
      from public.media_reference_write_leases
      where request_identity = 'ci-failed-revision-order-a'
      limit 1;
    `,
  });
  const second = startPsqlSession({
    label: "failed-revision-order-b",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select public.fail_media_reference_write_lease(
        lease_token, 'concurrent-fail-b', 'ci-concurrent-fail-b', '{}'::jsonb, false
      )
      from public.media_reference_write_leases
      where request_identity = 'ci-failed-revision-order-b'
      limit 1;
    `,
  });
  const [firstResult, secondResult] = await Promise.all([
    first.completion,
    second.completion,
  ]);
  assertSuccessfulSession("first multi-domain lease failure", firstResult);
  assertSuccessfulSession("reverse-order multi-domain lease failure", secondResult);
  console.log(
    "PASS concurrent multi-domain lease failures create/lock revisions in one stable order without deadlock.",
  );
}

async function verifyProviderSnapshotBeforeEntityWrite() {
  await runSqlSession(
    "provider-revision-race-setup",
    `
      \\set ON_ERROR_STOP on
      insert into public.media_references (
        asset_id, domain_key, entity_type, entity_identity, field_key
      ) values (
        '00000000-0000-0000-0000-0000000000c6',
        'concurrent.revision', 'topic', 'concurrent-revision-row', 'image'
      );
    `,
  );

  const providerFirst = startPsqlSession({
    label: "provider-revision-race-provider-first",
    readyMarker: "MEDIA_PROVIDER_REVISION_LOCK_HELD",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      begin;
      select public.replace_media_references_for_provider(
        'concurrent.revision',
        '[{"assetId":"00000000-0000-0000-0000-0000000000c6","entityType":"topic","entityIdentity":"concurrent-revision-row","fieldKey":"image"}]'::jsonb,
        '30000000-0000-0000-0000-000000000002',
        public.get_media_reference_provider_revision('concurrent.revision')
      );
      \\echo MEDIA_PROVIDER_REVISION_LOCK_HELD
      select pg_sleep(1.5);
      commit;
    `,
  });
  await providerFirst.ready;

  const entityAfterProvider = startPsqlSession({
    label: "provider-revision-race-entity-after-provider",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select lease_token as token
      from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c7.jpg","domainKey":"concurrent.revision","entityType":"topic","entityIdentity":"concurrent-revision-row"}]'::jsonb,
        null, 'ci-provider-revision-entity-after-provider', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      )
      \\gset
      select public.replace_media_references_for_entity(
        'concurrent.revision', 'topic', 'concurrent-revision-row',
        '[{"assetId":"00000000-0000-0000-0000-0000000000c7","fieldKey":"image"}]'::jsonb,
        :'token'::uuid, 'concurrent-revision-row'
      );
      select public.complete_media_reference_write_lease(
        :'token'::uuid, 'concurrent-revision-row'
      );
    `,
  });

  const [providerResult, entityResult] = await Promise.all([
    providerFirst.completion,
    entityAfterProvider.completion,
  ]);
  assertSuccessfulSession("provider-first revision contender", providerResult);
  assertSuccessfulSession("entity write after provider snapshot", entityResult);

  await runSqlSession(
    "provider-revision-race-proof",
    `
      \\set ON_ERROR_STOP on
      do $$
      begin
        if not exists (
          select 1 from public.media_references
          where domain_key = 'concurrent.revision'
            and asset_id = '00000000-0000-0000-0000-0000000000c7'
        ) or exists (
          select 1 from public.media_references
          where domain_key = 'concurrent.revision'
            and asset_id = '00000000-0000-0000-0000-0000000000c6'
        ) then
          raise exception 'provider_snapshot_won_over_newer_entity_write';
        end if;
      end;
      $$;
    `,
  );
  console.log(
    "PASS provider-first snapshot and later entity write serialize without deadlock; the newer entity state wins.",
  );
}

async function verifyPhysicalMoveAgainstStaleSafeDelete() {
  await runSqlSession(
    "physical-move-race-transition-first-lease",
    `
      \\set ON_ERROR_STOP on
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c4.jpg","domainKey":"media_catalog_physical_move","entityType":"media_asset","entityIdentity":"00000000-0000-0000-0000-0000000000c4"}]'::jsonb,
        null, 'ci-physical-move-race-transition-first', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  );

  const transitionFirst = startPsqlSession({
    label: "physical-move-race-transition-first",
    readyMarker: "MEDIA_MOVE_TRANSITION_LOCK_HELD",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      begin;
      select public.transition_media_asset_identity_for_move(
        '00000000-0000-0000-0000-0000000000c4',
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-transition-first'
            and status = 'active'
          limit 1
        ),
        'supabase', 'images', 'coordination/concurrent-c4.jpg',
        '/images/coordination/concurrent-c4.jpg',
        'images', 'coordination/moved-concurrent-c4.jpg',
        '/images/coordination/moved-concurrent-c4.jpg', 'images/coordination'
      );
      \\echo MEDIA_MOVE_TRANSITION_LOCK_HELD
      select pg_sleep(1.5);
      commit;
    `,
  });
  await transitionFirst.ready;

  const staleDeleteAfterTransition = startPsqlSession({
    label: "physical-move-race-stale-delete-after-transition",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select * from public.reserve_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000c4', null,
        'ci-stale-delete-after-move-transition',
        'supabase', 'images', 'coordination/concurrent-c4.jpg',
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  });

  const [transitionFirstResult, staleDeleteAfterTransitionResult] =
    await Promise.all([
      transitionFirst.completion,
      staleDeleteAfterTransition.completion,
    ]);
  assertSuccessfulSession(
    "physical move transition-first contender",
    transitionFirstResult,
  );
  assertExpectedSessionFailure(
    "stale delete after physical move transition",
    staleDeleteAfterTransitionResult,
    ["media_delete_asset_identity_changed"],
  );

  await runSqlSession(
    "physical-move-race-transition-first-proof",
    `
      \\set ON_ERROR_STOP on
      do $$
      begin
        if exists (
          select 1
          from public.media_delete_reservations
          where asset_id = '00000000-0000-0000-0000-0000000000c4'
        ) then
          raise exception 'stale_delete_created_reservation_after_move_transition';
        end if;
        if not exists (
          select 1
          from public.media_assets
          where id = '00000000-0000-0000-0000-0000000000c4'
            and object_key = 'coordination/moved-concurrent-c4.jpg'
            and reconciliation_state = 'uncertain'
        ) then
          raise exception 'move_transition_identity_not_preserved_after_stale_delete';
        end if;
      end;
      $$;
      select public.finalize_media_asset_identity_move(
        '00000000-0000-0000-0000-0000000000c4',
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-transition-first'
          limit 1
        ),
        'supabase', 'images', 'coordination/moved-concurrent-c4.jpg',
        '/images/coordination/moved-concurrent-c4.jpg'
      );
      select public.complete_media_reference_write_lease(
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-transition-first'
          limit 1
        ),
        '00000000-0000-0000-0000-0000000000c4'
      );
    `,
  );

  await runSqlSession(
    "physical-move-race-delete-first-lease",
    `
      \\set ON_ERROR_STOP on
      select * from public.acquire_media_reference_write_lease(
        '[{"provider":"supabase","bucket":"images","objectKey":"coordination/concurrent-c5.jpg","domainKey":"media_catalog_physical_move","entityType":"media_asset","entityIdentity":"00000000-0000-0000-0000-0000000000c5"}]'::jsonb,
        null, 'ci-physical-move-race-delete-first', 180,
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
    `,
  );

  const staleDeleteFirst = startPsqlSession({
    label: "physical-move-race-delete-first",
    readyMarker: "MEDIA_STALE_DELETE_LOCK_HELD",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      begin;
      select id
      from public.media_assets
      where id = '00000000-0000-0000-0000-0000000000c5'
      for update;
      \\echo MEDIA_STALE_DELETE_LOCK_HELD
      select pg_sleep(1.5);
      select * from public.reserve_media_asset_deletion(
        '00000000-0000-0000-0000-0000000000c5', null,
        'ci-stale-delete-lock-first',
        'supabase', 'images', 'coordination/concurrent-c5.jpg',
        'supabase', 'ci', 'postgres15:venesia_media_coordination_ci', 'ci-registry-v1'
      );
      commit;
    `,
  });
  await staleDeleteFirst.ready;

  const transitionAfterDeleteLock = startPsqlSession({
    label: "physical-move-race-transition-after-delete-lock",
    sql: `
      \\set ON_ERROR_STOP on
      set lock_timeout = '8s';
      set statement_timeout = '12s';
      select public.transition_media_asset_identity_for_move(
        '00000000-0000-0000-0000-0000000000c5',
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-delete-first'
            and status = 'active'
          limit 1
        ),
        'supabase', 'images', 'coordination/concurrent-c5.jpg',
        '/images/coordination/concurrent-c5.jpg',
        'images', 'coordination/moved-concurrent-c5.jpg',
        '/images/coordination/moved-concurrent-c5.jpg', 'images/coordination'
      );
    `,
  });

  const [staleDeleteFirstResult, transitionAfterDeleteLockResult] =
    await Promise.all([
      staleDeleteFirst.completion,
      transitionAfterDeleteLock.completion,
    ]);
  assertExpectedSessionFailure(
    "stale delete holding the asset row before move",
    staleDeleteFirstResult,
    ["media_delete_write_lease_unresolved"],
  );
  assertSuccessfulSession(
    "physical move after stale delete was rejected",
    transitionAfterDeleteLockResult,
  );

  await runSqlSession(
    "physical-move-race-delete-first-proof",
    `
      \\set ON_ERROR_STOP on
      do $$
      begin
        if exists (
          select 1
          from public.media_delete_reservations
          where asset_id = '00000000-0000-0000-0000-0000000000c5'
        ) then
          raise exception 'lease_blocked_stale_delete_left_a_reservation';
        end if;
        if not exists (
          select 1
          from public.media_assets
          where id = '00000000-0000-0000-0000-0000000000c5'
            and object_key = 'coordination/moved-concurrent-c5.jpg'
            and reconciliation_state = 'uncertain'
        ) then
          raise exception 'move_did_not_commit_after_stale_delete_failed_closed';
        end if;
      end;
      $$;
      select public.finalize_media_asset_identity_move(
        '00000000-0000-0000-0000-0000000000c5',
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-delete-first'
          limit 1
        ),
        'supabase', 'images', 'coordination/moved-concurrent-c5.jpg',
        '/images/coordination/moved-concurrent-c5.jpg'
      );
      select public.complete_media_reference_write_lease(
        (
          select lease_token
          from public.media_reference_write_leases
          where request_identity = 'ci-physical-move-race-delete-first'
          limit 1
        ),
        '00000000-0000-0000-0000-0000000000c5'
      );
    `,
  );

  console.log(
    "PASS physical move versus stale safe delete race (transition-first rejects stale identity; delete-lock-first fails closed on the active move lease).",
  );
}

for (const relativePath of setupSqlFiles) applySqlFile(relativePath);
await verifyReverseOrderBatchLocking();
await verifyReservationAgainstConcurrentWrites();
await verifyReverseOrderFailureRevisionLocking();
await verifyProviderSnapshotBeforeEntityWrite();
await verifyPhysicalMoveAgainstStaleSafeDelete();
applySqlFile("scripts/fixtures/media-coordination-postgres-tests.sql");

console.log(
  `PASS verify-media-coordination-postgres (${setupSqlFiles.length + 1} isolated PostgreSQL 15 fixture/migration/test files plus multi-session race proof).`,
);
