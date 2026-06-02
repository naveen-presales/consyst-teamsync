ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS system_details text,
  ADD COLUMN IF NOT EXISTS final_bom text;