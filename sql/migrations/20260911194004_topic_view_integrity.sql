-- PUB-07: extend the existing view-counter owner. No counter reset/backfill.
-- Additive private state; replaces the unprotected bigint-only RPC signature.
-- Apply before the matching application release. Old callers fail closed.
-- Forward fix only: do not restore the unprotected RPC to roll back a release.
-- Expired state is pruned by the existing Vercel Cron mechanism (daily), with
-- logical expiry enforced on every request. Maximum scheduled retention is
-- the relevant policy window plus one cron interval; no raw IP is persisted.
begin;

create table public.topic_view_policy (
  singleton boolean primary key default true check (singleton),
  cookie_ttl_seconds integer not null check (cookie_ttl_seconds between 60 and 2592000),
  dedupe_seconds integer not null check (dedupe_seconds between 1 and 86400),
  rate_window_seconds integer not null check (rate_window_seconds between 1 and 3600),
  visitor_request_limit integer not null check (visitor_request_limit between 1 and 1000),
  ip_request_limit integer not null check (ip_request_limit between 1 and 10000)
);
-- Sole tunable policy record. The RPC returns the cookie lifetime to the server
-- so there is no independent application copy of these product values.
insert into public.topic_view_policy values (true,2592000,86400,60,30,300);

create table public.topic_view_deduplication (
  visitor_key text not null check (visitor_key ~ '^[a-f0-9]{64}$'),
  topic_id bigint not null references public.topics(id) on delete cascade,
  counted_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (visitor_key, topic_id),
  check (expires_at > counted_at)
);
create index topic_view_deduplication_expiry on public.topic_view_deduplication(expires_at);

create table public.topic_view_request_limits (
  scope text not null check (scope in ('ip','visitor')),
  identity_key text not null check (identity_key ~ '^[a-f0-9]{64}$'),
  request_times timestamptz[] not null,
  expires_at timestamptz not null,
  primary key (scope, identity_key),
  check (cardinality(request_times) between 0 and 10000)
);
create index topic_view_request_limits_expiry on public.topic_view_request_limits(expires_at);

alter table public.topic_view_policy enable row level security;
alter table public.topic_view_deduplication enable row level security;
alter table public.topic_view_request_limits enable row level security;
-- Explicit final ACL, including any service_role grants inherited from the
-- installer's default privileges. A SELECT grant alone does not remove DML.
revoke all on public.topic_view_policy, public.topic_view_deduplication, public.topic_view_request_limits from public, anon, authenticated, service_role;
grant select on public.topic_view_policy to service_role;
grant select, insert, update, delete on public.topic_view_deduplication, public.topic_view_request_limits to service_role;

create or replace function public.enforce_topic_view_counter_integrity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.views_count is distinct from old.views_count then
    if current_setting('app.topic_view_increment',true) is distinct from 'on'
       or new.views_count is distinct from old.views_count + 1 then
      raise exception using errcode='42501', message='topic_view_protected_increment_required';
    end if;
  end if;
  return new;
end;
$$;
create trigger topic_view_counter_integrity before update of views_count on public.topics
for each row execute function public.enforce_topic_view_counter_integrity();
revoke all on function public.enforce_topic_view_counter_integrity() from public, anon, authenticated;

drop function public.increment_topic_view(bigint);
create or replace function public.increment_topic_view(
  p_topic_id bigint,
  p_visitor_key text,
  p_ip_key text
)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_policy public.topic_view_policy%rowtype;
  v_now timestamptz;
  v_scope text;
  v_key text;
  v_limit integer;
  v_times timestamptz[];
  v_retry integer := 0;
  v_next_count bigint;
  v_result jsonb;
begin
  if p_ip_key is null or p_ip_key !~ '^[a-f0-9]{64}$'
     or (p_visitor_key is not null and p_visitor_key !~ '^[a-f0-9]{64}$') then
    raise exception using errcode='22023', message='topic_view_identity_invalid';
  end if;
  select * into strict v_policy from public.topic_view_policy where singleton;
  -- The fixed IP -> visitor order prevents deadlocks when one visitor moves
  -- between IPs. Transaction locks also coordinate different server instances.
  perform pg_advisory_xact_lock(hashtextextended('topic-view-ip:' || p_ip_key,0));
  if p_visitor_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('topic-view-visitor:' || p_visitor_key,0));
  end if;
  v_now := clock_timestamp();
  v_result := jsonb_build_object('cookie_ttl_seconds',v_policy.cookie_ttl_seconds);
  foreach v_scope in array array['ip','visitor'] loop
    v_key := case when v_scope='ip' then p_ip_key else p_visitor_key end;
    if v_key is null then continue; end if;
    v_limit := case when v_scope='ip' then v_policy.ip_request_limit else v_policy.visitor_request_limit end;
    select coalesce(array_agg(requested_at order by requested_at),'{}'::timestamptz[])
      into v_times
    from public.topic_view_request_limits r, unnest(r.request_times) as requested_at
    where r.scope=v_scope and r.identity_key=v_key
      and requested_at > v_now - make_interval(secs=>v_policy.rate_window_seconds);
    if cardinality(v_times) >= v_limit then
      v_retry := greatest(v_retry,ceil(extract(epoch from
        v_times[cardinality(v_times)-v_limit+1] + make_interval(secs=>v_policy.rate_window_seconds) - v_now))::integer);
    else
      v_times := array_append(v_times,v_now);
    end if;
    -- Arrays are bounded by the configured admission limit; rejected floods
    -- do not append unbounded rows or extend the oldest admission's lifetime.
    insert into public.topic_view_request_limits(scope,identity_key,request_times,expires_at)
    values(v_scope,v_key,v_times,v_times[cardinality(v_times)] + make_interval(secs=>v_policy.rate_window_seconds))
    on conflict(scope,identity_key) do update set request_times=excluded.request_times, expires_at=excluded.expires_at;
  end loop;
  if v_retry > 0 then
    return v_result || jsonb_build_object('outcome','rate_limited','retry_after_seconds',greatest(1,v_retry));
  end if;
  if p_topic_id is null or p_topic_id <= 0 then
    return v_result || jsonb_build_object('outcome','invalid');
  end if;
  if p_visitor_key is null then
    return v_result || jsonb_build_object('outcome','identity_required');
  end if;
  perform 1 from public.topics where id=p_topic_id and status='published' and deleted_at is null for update;
  if not found then return v_result || jsonb_build_object('outcome','not_viewable'); end if;
  -- Count time follows any wait for another writer of this topic. Admission
  -- time above still owns the request-rate window independently.
  v_now := clock_timestamp();
  if exists (select 1 from public.topic_view_deduplication
    where visitor_key=p_visitor_key and topic_id=p_topic_id and expires_at>v_now) then
    -- A duplicate must not move counted_at or extend the rolling 24h window.
    return v_result || jsonb_build_object('outcome','duplicate');
  end if;
  perform set_config('app.topic_view_increment','on',true);
  update public.topics set views_count = views_count + 1
  where id=p_topic_id and status='published' and deleted_at is null
  returning views_count into v_next_count;
  perform set_config('app.topic_view_increment','off',true);
  if v_next_count is null then raise exception 'topic_view_increment_failed'; end if;
  insert into public.topic_view_deduplication(visitor_key,topic_id,counted_at,expires_at)
  values(p_visitor_key,p_topic_id,v_now,v_now + make_interval(secs=>v_policy.dedupe_seconds))
  on conflict(visitor_key,topic_id) do update set counted_at=excluded.counted_at,expires_at=excluded.expires_at;
  return v_result || jsonb_build_object('outcome','counted');
end;
$$;
revoke all on function public.increment_topic_view(bigint,text,text) from public, anon, authenticated;
grant execute on function public.increment_topic_view(bigint,text,text) to service_role;
comment on function public.increment_topic_view(bigint,text,text) is
  'PUB-07 owner: verified server visitor/IP digests; atomic rate admission, qualified view deduplication and +1. NULL visitor establishes identity without counting. No client clock or bypass overload.';

create or replace function public.prune_topic_view_state()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_views integer; v_limits integer;
begin
  delete from public.topic_view_deduplication where expires_at <= clock_timestamp();
  get diagnostics v_views = row_count;
  delete from public.topic_view_request_limits where expires_at <= clock_timestamp();
  get diagnostics v_limits = row_count;
  return jsonb_build_object('deduplication_deleted',v_views,'limits_deleted',v_limits);
end;
$$;
revoke all on function public.prune_topic_view_state() from public, anon, authenticated;
grant execute on function public.prune_topic_view_state() to service_role;
select pg_notify('pgrst','reload schema');
commit;
