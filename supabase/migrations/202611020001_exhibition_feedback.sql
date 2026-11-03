-- Feedback and optional research linkage are private and expire separately
-- from the visitor's QR report. Consent is never assumed from report access.
create table if not exists public.exhibition_feedback (
  id uuid primary key,
  meaning text not null check (char_length(meaning) <= 600),
  replay_help integer check (replay_help between 0 and 5),
  friction text not null check (char_length(friction) <= 600),
  consent_version text not null,
  record_consent boolean not null default false,
  report_id text references public.exhibition_reports(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 months'),
  check (record_consent = (report_id is not null))
);
alter table public.exhibition_feedback enable row level security;
revoke all on public.exhibition_feedback from anon, authenticated;
grant all on public.exhibition_feedback to service_role;

create or replace function public.submit_exhibition_feedback(
  p_id uuid, p_meaning text, p_help integer, p_friction text,
  p_record_consent boolean, p_report text, p_client text
) returns text language plpgsql security definer set search_path = public, extensions as $$
declare request_count integer;
begin
  perform pg_advisory_xact_lock(77461102);
  if exists(select 1 from exhibition_feedback where id = p_id) then return 'OK'; end if;
  if char_length(p_meaning) > 600 or char_length(p_friction) > 600
    or (p_help is not null and (p_help < 0 or p_help > 5))
    or (trim(p_meaning) = '' and p_help is null and trim(p_friction) = '') then return 'INVALID'; end if;
  if p_record_consent and not exists(select 1 from exhibition_reports where id = p_report and ready) then return 'INVALID_REPORT'; end if;
  insert into exhibition_upload_limits values ('feedback:' || p_client, date_trunc('minute', now()), 1)
    on conflict (client_hash, minute) do update set count = exhibition_upload_limits.count + 1
    returning count into request_count;
  if request_count > 5 then return 'RATE_LIMIT'; end if;
  if (select count(*) from exhibition_feedback) >= 20000
    or (select count(*) from exhibition_feedback where created_at > now() - interval '1 day') >= 1000 then return 'CAPACITY'; end if;
  insert into exhibition_feedback(id, meaning, replay_help, friction, consent_version, record_consent, report_id)
    values(p_id, p_meaning, p_help, p_friction, 'ut-2026-11-02-v1', p_record_consent, case when p_record_consent then p_report else null end);
  return 'OK';
end;
$$;
revoke all on function public.submit_exhibition_feedback(uuid, text, integer, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.submit_exhibition_feedback(uuid, text, integer, text, boolean, text, text) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('unanswered-feedback-retention', '17 3 * * *',
  $$delete from public.exhibition_feedback where expires_at < now();$$);
notify pgrst, 'reload schema';
