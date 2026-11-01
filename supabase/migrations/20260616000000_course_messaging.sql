create table public.course_conversations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_conversations_course_student_key unique (course_id, student_id)
);

create index idx_course_conversations_student_updated
  on public.course_conversations(student_id, updated_at desc);

create table public.course_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.course_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index idx_course_messages_conversation_created
  on public.course_messages(conversation_id, created_at desc);

create index idx_course_messages_unread
  on public.course_messages(conversation_id, sender_id)
  where read_at is null;

create function public.touch_course_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.course_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger course_messages_touch_conversation
after insert on public.course_messages
for each row execute function public.touch_course_conversation_after_message();

alter table public.course_conversations enable row level security;
alter table public.course_messages enable row level security;

create policy "Participants can view course conversations"
on public.course_conversations for select
using (
  (
    student_id = auth.uid()
    and public.current_user_role() = 'student'
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.is_published
    )
  )
  or exists (
    select 1 from public.courses c
    where c.id = course_id
      and c.instructor_id = auth.uid()
      and public.current_user_role() in ('instructor', 'admin', 'super_admin')
  )
);

create policy "Students can start their own course conversations"
on public.course_conversations for insert
with check (
  student_id = auth.uid()
  and public.current_user_role() = 'student'
  and exists (
    select 1 from public.courses c
    where c.id = course_id and c.is_published and c.instructor_id is not null
  )
);

create policy "Participants can view course messages"
on public.course_messages for select
using (
  exists (
    select 1
    from public.course_conversations cc
    join public.courses c on c.id = cc.course_id
    where cc.id = conversation_id
      and c.is_published
      and (
        (cc.student_id = auth.uid() and public.current_user_role() = 'student')
        or (
          c.instructor_id = auth.uid()
          and public.current_user_role() in ('instructor', 'admin', 'super_admin')
        )
      )
  )
);

create policy "Participants can send course messages"
on public.course_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.course_conversations cc
    join public.courses c on c.id = cc.course_id
    where cc.id = conversation_id
      and c.is_published
      and (
        (cc.student_id = auth.uid() and public.current_user_role() = 'student')
        or (
          c.instructor_id = auth.uid()
          and public.current_user_role() in ('instructor', 'admin', 'super_admin')
        )
      )
  )
);

revoke update on public.course_messages from authenticated;
grant update(read_at) on public.course_messages to authenticated;

create policy "Recipients can mark course messages read"
on public.course_messages for update
using (
  sender_id <> auth.uid()
  and read_at is null
  and exists (
    select 1
    from public.course_conversations cc
    join public.courses c on c.id = cc.course_id
    where cc.id = conversation_id
      and c.is_published
      and (
        (cc.student_id = auth.uid() and public.current_user_role() = 'student')
        or (
          c.instructor_id = auth.uid()
          and public.current_user_role() in ('instructor', 'admin', 'super_admin')
        )
      )
  )
)
with check (
  sender_id <> auth.uid()
  and read_at is not null
  and exists (
    select 1
    from public.course_conversations cc
    join public.courses c on c.id = cc.course_id
    where cc.id = conversation_id
      and c.is_published
      and (
        (cc.student_id = auth.uid() and public.current_user_role() = 'student')
        or (
          c.instructor_id = auth.uid()
          and public.current_user_role() in ('instructor', 'admin', 'super_admin')
        )
      )
  )
);
