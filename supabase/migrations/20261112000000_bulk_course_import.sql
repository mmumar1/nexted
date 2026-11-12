create or replace function public.create_course_draft_from_import(
  p_title text,
  p_description text,
  p_instructor_id uuid,
  p_modules jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_course_id uuid;
  v_module_ids uuid[] := array[]::uuid[];
  v_module jsonb;
  v_ordinality bigint;
  v_parent_value jsonb;
  v_parent_index integer;
  v_parent_module_id uuid;
  v_video_urls text[];
  v_module_count integer;
begin
  if nullif(trim(p_title), '') is null or nullif(trim(p_description), '') is null then
    raise exception 'Course title and description are required';
  end if;

  if p_modules is null or jsonb_typeof(p_modules) <> 'array' then
    raise exception 'Course modules must be an array';
  end if;

  v_module_count := jsonb_array_length(p_modules);
  if v_module_count < 2 or v_module_count > 200 then
    raise exception 'Course imports must contain between 2 and 200 modules and lessons';
  end if;

  insert into public.courses (
    title,
    description,
    access_code,
    enrollment_mode,
    instructor_id,
    is_published,
    published_at
  ) values (
    trim(p_title),
    trim(p_description),
    '',
    'self'::public.enrollment_mode,
    p_instructor_id,
    false,
    null
  )
  returning id into v_course_id;

  for v_module, v_ordinality in
    select item.value, item.ordinality
    from jsonb_array_elements(p_modules) with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    v_parent_value := v_module -> 'parentIndex';
    v_parent_module_id := null;

    if v_parent_value is not null and jsonb_typeof(v_parent_value) <> 'null' then
      v_parent_index := (v_parent_value #>> '{}')::integer + 1;
      if v_parent_index < 1 or v_parent_index >= v_ordinality then
        raise exception 'Each lesson must refer to a preceding course module';
      end if;
      v_parent_module_id := v_module_ids[v_parent_index];
      if v_parent_module_id is null then
        raise exception 'Lessons must be nested directly under a course module';
      end if;
    end if;

    select coalesce(array_agg(value), array[]::text[])
    into v_video_urls
    from jsonb_array_elements_text(coalesce(v_module -> 'videoUrls', '[]'::jsonb)) as videos(value);

    insert into public.modules (
      course_id,
      title,
      sort_order,
      content,
      video_url,
      video_urls,
      parent_module_id,
      duration_minutes
    ) values (
      v_course_id,
      trim(v_module ->> 'title'),
      (v_module ->> 'order')::integer,
      coalesce(v_module ->> 'content', ''),
      v_video_urls[1],
      v_video_urls,
      v_parent_module_id,
      30
    )
    returning id into v_parent_module_id;

    v_module_ids := array_append(v_module_ids, v_parent_module_id);
  end loop;

  return v_course_id;
end;
$$;

revoke all on function public.create_course_draft_from_import(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_course_draft_from_import(text, text, uuid, jsonb) to service_role;
