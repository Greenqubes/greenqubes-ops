-- Add optional end date to jobs for multi-day jobs
alter table jobs add column if not exists date_end date;
