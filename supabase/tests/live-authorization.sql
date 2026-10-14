-- Run in Supabase SQL Editor as its normal admin role after migration.
-- Replace only <OWNER_UUID> privately; this file contains no personal records.
-- All operations are inside one transaction and rollback. No Auth users are changed.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','<OWNER_UUID>','role','authenticated')::text,true);
set local role authenticated;
do $$
declare safe_count bigint; protected_id text; leaked_count bigint;
begin
 begin
  perform 1 from public.wallet_records limit 1;
  raise exception 'FAIL: authenticated base table SELECT allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.wallet_summary_security limit 1;
  raise exception 'FAIL: authenticated password configuration SELECT allowed';
 exception when insufficient_privilege then null; end;
 select count(*) into safe_count from public.wallet_records_safe;
 if safe_count=0 then raise exception 'FAIL: imported owner records missing from safe view'; end if;
 select count(*) into leaked_count from public.wallet_records_safe where user_id<>auth.uid();
 if leaked_count<>0 then raise exception 'FAIL: another user exposed through safe view'; end if;
 select count(*) into leaked_count from public.wallet_records_safe
 where payload->>'lockedSummary'='true' and payload-array['id','lockedSummary','type']<>'{}'::jsonb;
 if leaked_count<>0 then raise exception 'FAIL: protected payload details exposed'; end if;
 select id into protected_id from public.wallet_records_safe where payload->>'lockedSummary'='true' limit 1;
 if protected_id is null then raise exception 'FAIL: expected imported protected baseline missing'; end if;
 begin
  perform public.save_wallet_record(protected_id,'transaction',jsonb_build_object('id',protected_id),0);
  raise exception 'FAIL: protected record recast allowed';
 exception when others then
  if sqlerrm not like '%Cannot overwrite protected Summary records%' then raise; end if;
 end;
 begin
  perform public.save_wallet_record('synthetic-security-probe','module',jsonb_build_object('id','synthetic-security-probe','type','reconciliation'),0);
  raise exception 'FAIL: ordinary sync accepted new protected record';
 exception when others then
  if sqlerrm not like '%Summary records require protected access%' then raise; end if;
 end;
 select count(*) into leaked_count from storage.objects where bucket_id='wallet-private';
 if leaked_count<>0 then raise exception 'FAIL: direct private archive SELECT/download allowed'; end if;
 raise notice 'PASS: owner safe view, locked redaction, protected write/recast denial, base/config denial, archive SELECT denial';
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
 if exists(select 1 from public.wallet_records_safe) then raise exception 'FAIL: unrelated account can read owner records'; end if;
 if exists(select 1 from storage.objects where bucket_id='wallet-private') then raise exception 'FAIL: unrelated account can read owner archives'; end if;
 raise notice 'PASS: unrelated account cannot read owner records or archives';
end $$;
reset role;
do $$
begin
 if not has_table_privilege('service_role','public.wallet_records','SELECT') then raise exception 'FAIL: server cannot read owned wallet records'; end if;
 if not has_table_privilege('service_role','public.wallet_summary_security','SELECT') then raise exception 'FAIL: server cannot read Summary configuration'; end if;
 if not has_column_privilege('service_role','public.wallet_summary_security','failed_attempts','UPDATE') or not has_column_privilege('service_role','public.wallet_summary_security','locked_until','UPDATE') then raise exception 'FAIL: server cannot reset verified password attempts'; end if;
 if has_table_privilege('authenticated','public.wallet_summary_security','SELECT') or has_table_privilege('anon','public.wallet_summary_security','SELECT') then raise exception 'FAIL: browser client can read Summary configuration'; end if;
 if has_function_privilege('anon','public.save_wallet_record(text,text,jsonb,bigint)','execute') then raise exception 'FAIL: anonymous ordinary writes allowed'; end if;
 if has_function_privilege('authenticated','public.wallet_setup_summary(uuid,jsonb,jsonb)','execute') then raise exception 'FAIL: client can bypass password setup'; end if;
 if has_function_privilege('authenticated','public.wallet_summary_attempt(uuid)','execute') then raise exception 'FAIL: client can tamper with password attempt counter'; end if;
 if exists(select 1 from storage.buckets where id='wallet-private' and public) then raise exception 'FAIL: wallet archive bucket public'; end if;
 raise notice 'PASS: anonymous and privileged RPC permissions, private archive bucket';
end $$;
rollback;
select 'PASS: wallet authorization checks completed; transaction rolled back' as result;
