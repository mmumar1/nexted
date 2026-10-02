-- Learnpedia advanced course test seed.
-- Run schema.sql and rls.sql before this file.
-- This script is rerunnable and does not create Auth users or passwords.

do $$
declare
	v_owner_id uuid;
	v_course_id uuid;
	v_foundation_id uuid;
	v_html_id uuid;
	v_css_id uuid;
begin
	select id into v_owner_id
	from public.profiles
	where role in ('super_admin', 'admin', 'instructor')
	order by created_at
	limit 1;

	if v_owner_id is null then
		raise exception 'Create and promote a staff profile before running this seed';
	end if;

	select id into v_course_id
	from public.courses
	where access_code = 'WEB-201-DEMO'
	limit 1;

	if v_course_id is null then
		insert into public.courses (
			title,
			description,
			access_code,
			thumbnail,
			enrollment_mode,
			instructor_id,
			is_published,
			published_at
		) values (
			'Modern Web Development',
			'Build a responsive web experience from structure to interactivity.',
			'WEB-201-DEMO',
			'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
			'self',
			v_owner_id,
			true,
			now()
		) returning id into v_course_id;
	end if;

	insert into public.modules (
		course_id,
		title,
		sort_order,
		content,
		video_url,
		duration_minutes
	)
	select
		v_course_id,
		'Web Foundations',
		1,
		'<h3>Web Foundations</h3><p>Understand browsers, servers, URLs, and the document lifecycle.</p>',
		'https://www.youtube.com/watch?v=oh4L2gcI5ds',
		30
	where not exists (
		select 1
		from public.modules m
		where m.course_id = v_course_id
			and m.title = 'Web Foundations'
	);

	select id into v_foundation_id
	from public.modules m
	where m.course_id = v_course_id
		and m.title = 'Web Foundations'
	limit 1;

	insert into public.modules (
		course_id,
		title,
		sort_order,
		content,
		video_url,
		parent_module_id,
		duration_minutes
	)
	select
		v_course_id,
		'HTML Structure',
		2,
		'<h3>HTML Structure</h3><p>Create semantic page structure with headings, sections, links, and forms.</p>',
		'https://www.youtube.com/watch?v=qz0aWYtcGNU',
		v_foundation_id,
		35
	where not exists (
		select 1
		from public.modules m
		where m.course_id = v_course_id
			and m.title = 'HTML Structure'
	);

	select id into v_html_id
	from public.modules m
	where m.course_id = v_course_id
		and m.title = 'HTML Structure'
	limit 1;

	insert into public.modules (
		course_id,
		title,
		sort_order,
		content,
		video_url,
		parent_module_id,
		prerequisite_module_id,
		duration_minutes
	)
	select
		v_course_id,
		'CSS Layout and Responsive Design',
		3,
		'<h3>CSS Layout</h3><p>Use Flexbox, Grid, responsive units, and media queries to build adaptable layouts.</p>',
		'https://www.youtube.com/watch?v=1Rs2ND1ryYc',
		v_foundation_id,
		v_html_id,
		45
	where not exists (
		select 1
		from public.modules m
		where m.course_id = v_course_id
			and m.title = 'CSS Layout and Responsive Design'
	);

	select id into v_css_id
	from public.modules m
	where m.course_id = v_course_id
		and m.title = 'CSS Layout and Responsive Design'
	limit 1;

	insert into public.quizzes (module_id, title, questions, pass_score)
	select
		v_foundation_id,
		'Web Foundations Quiz',
		jsonb_build_array(
			jsonb_build_object(
				'id', 'web-foundations-1',
				'question', 'Which technology provides the structure of a web page?',
				'options', jsonb_build_array('HTML', 'CSS', 'JavaScript', 'SQL'),
				'correctAnswer', 0
			),
			jsonb_build_object(
				'id', 'web-foundations-2',
				'question', 'Which component responds to a browser request?',
				'options', jsonb_build_array('Server', 'Keyboard', 'Style sheet', 'Image'),
				'correctAnswer', 0
			)
		),
		70
	where not exists (
		select 1 from public.quizzes q where q.module_id = v_foundation_id
	);

	insert into public.quizzes (module_id, title, questions, pass_score)
	select
		v_css_id,
		'Responsive CSS Quiz',
		jsonb_build_array(
			jsonb_build_object(
				'id', 'css-1',
				'question', 'Which CSS system is designed for two-dimensional layouts?',
				'options', jsonb_build_array('Grid', 'Float', 'Inline', 'Border'),
				'correctAnswer', 0
			),
			jsonb_build_object(
				'id', 'css-2',
				'question', 'What commonly changes layout at a viewport breakpoint?',
				'options', jsonb_build_array('Media query', 'Alt text', 'HTML title', 'Database index'),
				'correctAnswer', 0
			)
		),
		70
	where not exists (
		select 1 from public.quizzes q where q.module_id = v_css_id
	);

	insert into public.user_courses (user_id, course_id, access_source)
	select p.id, v_course_id, 'manual'
	from public.profiles p
	where p.role = 'student'
		and not exists (
			select 1
			from public.user_courses uc
			where uc.user_id = p.id
				and uc.course_id = v_course_id
		);
end;
$$;

select
	c.title,
	c.is_published,
	count(distinct m.id) as modules,
	count(distinct q.id) as quizzes,
	count(distinct uc.user_id) as enrolled_students
from public.courses c
left join public.modules m on m.course_id = c.id
left join public.quizzes q on q.module_id = m.id
left join public.user_courses uc on uc.course_id = c.id
where c.access_code = 'WEB-201-DEMO'
group by c.id, c.title, c.is_published;
