
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS end_user text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS rfq_reading_hours numeric,
  ADD COLUMN IF NOT EXISTS estimation_hours numeric,
  ADD COLUMN IF NOT EXISTS opportunity_cost numeric;
