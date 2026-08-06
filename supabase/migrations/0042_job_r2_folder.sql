-- 0042: human-readable R2 folder per job, e.g. 2026-08-12_Booth-Build_x7k2f3a1.
-- Stamped once at INSERT (same pattern as 0038's scheduled_at trigger) so the
-- folder never moves when the title is edited later. Existing rows stay NULL
-- and keep uploading to the legacy jobs/{jobId}/ prefix.
alter table jobs add column r2_folder text;

create or replace function public.stamp_r2_folder()
returns trigger language plpgsql as $$
declare
  slug text;
begin
  slug := regexp_replace(coalesce(new.project_title, ''), '[^[:alnum:]]+', '-', 'g');
  slug := trim(both '-' from slug);
  if slug = '' then slug := 'Untitled'; end if;
  slug := trim(both '-' from left(slug, 50));
  new.r2_folder := to_char(new.date::date, 'YYYY-MM-DD') || '_' || slug || '_' || left(new.id::text, 8);
  return new;
end;
$$;

create trigger jobs_stamp_r2_folder
  before insert on jobs
  for each row execute function public.stamp_r2_folder();
