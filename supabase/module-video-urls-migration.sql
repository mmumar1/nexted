alter table public.modules
  add column if not exists video_urls text[] not null default '{}'::text[];

update public.modules
set video_urls = array[video_url]
where video_url is not null
  and btrim(video_url) <> ''
  and cardinality(video_urls) = 0;
