-- Summary plaintext is accessible only through the authenticated Edge Function,
-- with the independent Summary password. Generic sync sees locked placeholders.
create or replace function public.wallet_is_protected(p_entity text,p_payload jsonb)
returns boolean language sql immutable set search_path='' as $$
 select p_entity='historical' or p_payload->>'encryptedSummary'='1' or p_payload->>'lockedSummary'='true'
 or (p_entity='module' and p_payload->>'type' in ('saving','income-summary','expense-summary','tax','investment','reconciliation'))
 or (p_entity='review' and (
 coalesce(p_payload->>'sourceSheet','') ~* '^(Saving|Income|[0-9]{4}_Expense|TaxProjection|MonthlyInvestment)$'
 or coalesce(p_payload#>>'{originalRecord,sourceSheet}','') ~* '^(Saving|Income|[0-9]{4}_Expense|TaxProjection|MonthlyInvestment)$'
 or p_payload#>>'{originalRecord,entity}'='historical'
 or p_payload#>>'{originalRecord,type}' in ('saving','income-summary','expense-summary','tax','investment','reconciliation')
 or p_payload#>>'{originalRecord,payload,type}' in ('saving','income-summary','expense-summary','tax','investment','reconciliation'))) is true
$$;
create table public.wallet_summary_security (
 user_id uuid primary key references auth.users(id) on delete cascade,
 config jsonb not null,
 failed_attempts integer not null default 0,
 locked_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.wallet_summary_security enable row level security;
revoke all on public.wallet_summary_security from public,anon,authenticated;
revoke select on public.wallet_records from authenticated;
-- Owner's view runs as view creator so base-table SELECT stays unavailable.
-- Explicit auth.uid predicate supplies the user boundary; protected metadata is minimal.
create view public.wallet_records_safe with (security_barrier=true) as
 select user_id,id,entity,
 case when public.wallet_is_protected(entity,payload) then jsonb_build_object('id',id,'lockedSummary',true,'type',coalesce(payload->>'type','historical')) else payload end as payload,
 version,updated_at from public.wallet_records where user_id=(select auth.uid());
revoke all on public.wallet_records_safe from public,anon;
grant select on public.wallet_records_safe to authenticated;
create or replace function public.save_wallet_record(p_id text,p_entity text,p_payload jsonb,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.wallet_records; owner_id uuid:=auth.uid(); next_version bigint;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'Invalid expected version'; end if;
 if p_id is null or p_id='' or jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
 if public.wallet_is_protected(p_entity,p_payload) then raise exception 'Summary records require protected access'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||p_id,0));
 select * into current_row from public.wallet_records where user_id=owner_id and id=p_id for update;
 if found then
  if public.wallet_is_protected(current_row.entity,current_row.payload) then raise exception 'Cannot overwrite protected Summary records'; end if;
  if current_row.payload=p_payload and current_row.entity=p_entity then return jsonb_build_object('status','saved','version',current_row.version); end if;
  if current_row.version<>p_expected_version then return jsonb_build_object('status','conflict','remote',to_jsonb(current_row)); end if;
  if current_row.entity<>p_entity then raise exception 'Record entity cannot change'; end if;
  next_version:=current_row.version+1;
  update public.wallet_records set payload=p_payload,version=next_version,updated_at=now() where user_id=owner_id and id=p_id;
 else
  if p_expected_version<>0 then return jsonb_build_object('status','conflict','remote',null); end if;
  next_version:=1;
  insert into public.wallet_records(user_id,id,entity,payload,version) values(owner_id,p_id,p_entity,p_payload,next_version);
 end if;
 return jsonb_build_object('status','saved','version',next_version);
end $$;
-- Service-only atomic setup verifies every row/version and encrypts all protected rows.
create function public.wallet_setup_summary(p_user_id uuid,p_config jsonb,p_records jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb; expected_count bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':summary',0));
 if exists(select 1 from public.wallet_summary_security where user_id=p_user_id) then raise exception 'Summary already configured'; end if;
 select count(*) into expected_count from public.wallet_records where user_id=p_user_id and public.wallet_is_protected(entity,payload);
 if expected_count<>jsonb_array_length(p_records) then raise exception 'Summary changed during setup. Retry'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
  update public.wallet_records set payload=item->'payload',version=version+1,updated_at=now()
  where user_id=p_user_id and id=item->>'id' and entity=item->>'entity' and version=(item->>'version')::bigint
  and public.wallet_is_protected(entity,payload) and item->'payload'->>'encryptedSummary'='1';
  if not found then raise exception 'Summary changed during setup. Retry'; end if;
 end loop;
 insert into public.wallet_summary_security(user_id,config) values(p_user_id,p_config);
end $$;
revoke all on function public.wallet_setup_summary(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.wallet_setup_summary(uuid,jsonb,jsonb) to service_role;
-- Storage SELECT also permits downloading: remove it and use the password-gated Edge endpoint.
drop policy if exists "Read own private files" on storage.objects;
create function public.wallet_summary_attempt(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare row_value public.wallet_summary_security;
begin
 select * into row_value from public.wallet_summary_security where user_id=p_user_id for update;
 if not found then return true; end if;
 if row_value.locked_until>now() then return false; end if;
 if row_value.locked_until is not null then row_value.failed_attempts:=0; end if;
 update public.wallet_summary_security set failed_attempts=row_value.failed_attempts+1,
 locked_until=case when row_value.failed_attempts+1>=5 then now()+interval '1 minute' else null end
 where user_id=p_user_id;
 return true;
end $$;
revoke all on function public.wallet_summary_attempt(uuid) from public,anon,authenticated;
grant execute on function public.wallet_summary_attempt(uuid) to service_role;
-- Enforce private state even if an existing bucket had been misconfigured.
update storage.buckets set public=false where id='wallet-private';
