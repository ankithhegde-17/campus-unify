-- Run after migrations 001–003. Does NOT depend on migration 004.
-- Server-side authorization protects this prototype workspace.
begin;
create table if not exists public.cu_workspace (
 id text primary key check (id = 'main'),
 payload jsonb not null,
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.cu_workspace enable row level security;
revoke all on public.cu_workspace from anon, authenticated;
grant select, insert, update on public.cu_workspace to service_role;
create or replace function public.cu_save_workspace(expected_revision bigint, next_payload jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare saved_revision bigint;
begin
 update public.cu_workspace
 set payload=next_payload, revision=revision+1, updated_at=now()
 where id='main' and revision=expected_revision
 returning revision into saved_revision;
 return saved_revision;
end;
$$;
revoke all on function public.cu_save_workspace(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.cu_save_workspace(bigint,jsonb) to service_role;
-- Preserve issued receipts and audit entries even through the trusted save RPC.
create or replace function public.cu_preserve_history()
returns trigger language plpgsql set search_path = '' as $$
declare entry jsonb;
begin
 for entry in select value from jsonb_array_elements(coalesce(old.payload->'payments','[]'::jsonb)) loop
  if not exists (
   select 1 from jsonb_array_elements(coalesce(new.payload->'payments','[]'::jsonb)) n
   where n->>'id'=entry->>'id' and n=entry
  ) then raise exception 'Issued payments and receipts are immutable; append a reversal'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(coalesce(old.payload->'audit','[]'::jsonb)) loop
  if not exists (
   select 1 from jsonb_array_elements(coalesce(new.payload->'audit','[]'::jsonb)) n
   where n->>'id'=entry->>'id' and n=entry
  ) then raise exception 'Audit history is append-only'; end if;
 end loop;
 return new;
end;
$$;
drop trigger if exists cu_history_guard on public.cu_workspace;
create trigger cu_history_guard before update on public.cu_workspace
for each row execute function public.cu_preserve_history();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('cu-documents','cu-documents',false,512000,array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;
commit;
