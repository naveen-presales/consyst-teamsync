ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS lost_category text,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_lost_category_check
  CHECK (lost_category IS NULL OR lost_category IN ('price', 'other'));