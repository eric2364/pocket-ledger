-- Run once in Supabase SQL Editor or deploy with Supabase CLI migrations.
create table if not exists public.wallet_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  entity text not null check (entity in ('transaction','module','template','category','historical','review','source')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
alter table public.wallet_records enable row level security;
create policy "Read own wallet" on public.wallet_records for select to authenticated using ((select auth.uid())=user_id);
-- Mutations exclusively use the version-checking RPC, not direct client writes.
revoke all on public.wallet_records from anon,authenticated;
grant select on public.wallet_records to authenticated;
create or replace function public.save_wallet_record(p_id text,p_entity text,p_payload jsonb,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_row public.wallet_records; owner_id uuid := auth.uid(); next_version bigint;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if p_id is null or p_id = '' or p_payload->>'id' is distinct from p_id then raise exception 'Invalid record ID'; end if;
  -- Serialize concurrent creation as well as updates for the same user and record.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_id,0));
  select * into current_row from public.wallet_records where user_id=owner_id and id=p_id for update;
  if found then
    -- A lost success response can be safely retried without producing a conflict.
    if current_row.payload=p_payload and current_row.entity=p_entity then return jsonb_build_object('status','saved','version',current_row.version); end if;
    if current_row.version <> p_expected_version then return jsonb_build_object('status','conflict','remote',to_jsonb(current_row)); end if;
    if current_row.entity <> p_entity then raise exception 'Record entity cannot change'; end if;
    next_version:=current_row.version+1;
    update public.wallet_records set payload=p_payload,version=next_version,updated_at=now() where user_id=owner_id and id=p_id;
  else
    if p_expected_version <> 0 then return jsonb_build_object('status','conflict','remote',null); end if;
    next_version:=1;
    insert into public.wallet_records(user_id,id,entity,payload,version) values(owner_id,p_id,p_entity,p_payload,next_version);
  end if;
  return jsonb_build_object('status','saved','version',next_version);
end $$;
revoke all on function public.save_wallet_record(text,text,jsonb,bigint) from public,anon;
grant execute on function public.save_wallet_record(text,text,jsonb,bigint) to authenticated;
insert into storage.buckets (id,name,public) values ('wallet-private','wallet-private',false) on conflict(id) do nothing;
create policy "Read own private files" on storage.objects for select to authenticated using (bucket_id='wallet-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own private files" on storage.objects for insert to authenticated with check (bucket_id='wallet-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Delete own private files" on storage.objects for delete to authenticated using (bucket_id='wallet-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
