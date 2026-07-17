create unique index if not exists daily_entries_user_date_uidx
  on public.daily_entries (user_id, date);

alter table public.daily_entries enable row level security;

drop policy if exists "daily_entries_select_own" on public.daily_entries;
create policy "daily_entries_select_own"
  on public.daily_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_insert_own" on public.daily_entries;
create policy "daily_entries_insert_own"
  on public.daily_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_update_own" on public.daily_entries;
create policy "daily_entries_update_own"
  on public.daily_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_delete_own" on public.daily_entries;
create policy "daily_entries_delete_own"
  on public.daily_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_daily_entries_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_daily_entries_updated_at on public.daily_entries;
create trigger set_daily_entries_updated_at
before insert or update on public.daily_entries
for each row execute function public.set_daily_entries_updated_at();
