CREATE UNIQUE INDEX IF NOT EXISTS opportunities_crm_number_unique_idx
  ON public.opportunities (lower(crm_number));