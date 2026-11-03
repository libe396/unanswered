-- Private report files. No browser role can list/read/write either table or bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exhibition-reports', 'exhibition-reports', false, 26214400, array['application/json'])
on conflict (id) do nothing;

create table if not exists public.exhibition_reports (
  id text primary key default substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 48),
  content_hash text not null unique,
  byte_size bigint not null check (byte_size between 1 and 26214400),
  ready boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.exhibition_reports enable row level security;
revoke all on public.exhibition_reports from anon, authenticated;
grant all on public.exhibition_reports to service_role;

-- Hashes expire daily; the server never stores the original network address.
create table if not exists public.exhibition_upload_limits (
  client_hash text not null,
  minute timestamptz not null,
  count integer not null,
  primary key (client_hash, minute)
);
alter table public.exhibition_upload_limits enable row level security;
revoke all on public.exhibition_upload_limits from anon, authenticated;

-- Atomic reservations bound anonymous writes and reserve room within a free plan.
create or replace function public.reserve_exhibition_report(p_hash text, p_bytes bigint, p_client text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare result_id text; request_count integer;
begin
  perform pg_advisory_xact_lock(77461101);
  insert into exhibition_upload_limits values (p_client, date_trunc('minute', now()), 1)
    on conflict (client_hash, minute) do update set count = exhibition_upload_limits.count + 1
    returning count into request_count;
  if request_count > 12 then return 'RATE_LIMIT'; end if;
  delete from exhibition_upload_limits where minute < now() - interval '1 day';
  select id into result_id from exhibition_reports where content_hash = p_hash;
  if result_id is not null then return result_id; end if;
  if p_bytes < 1 or p_bytes > 26214400 then return 'TOO_LARGE'; end if;
  if (select coalesce(sum(byte_size), 0) from exhibition_reports) + p_bytes > 838860800
    or (select count(*) from exhibition_reports where created_at > now() - interval '1 day') >= 100
    then return 'CAPACITY'; end if;
  insert into exhibition_reports (content_hash, byte_size) values (p_hash, p_bytes) returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.reserve_exhibition_report(text, bigint, text) from public, anon, authenticated;
grant execute on function public.reserve_exhibition_report(text, bigint, text) to service_role;
