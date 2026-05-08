-- Add project_title column to jobs table.
-- Displayed on the schedule in place of client name.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS project_title TEXT;
