alter table public.profiles
  add column if not exists last_login_at timestamptz;

create or replace function public.touch_course_updated_at_from_module()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.courses set updated_at = now() where id = old.course_id;
    return old;
  end if;

  update public.courses set updated_at = now() where id = new.course_id;
  if tg_op = 'UPDATE' and old.course_id is distinct from new.course_id then
    update public.courses set updated_at = now() where id = old.course_id;
  end if;
  return new;
end;
$$;

drop trigger if exists modules_touch_course_updated_at on public.modules;
create trigger modules_touch_course_updated_at
after insert or update or delete on public.modules
for each row execute procedure public.touch_course_updated_at_from_module();
