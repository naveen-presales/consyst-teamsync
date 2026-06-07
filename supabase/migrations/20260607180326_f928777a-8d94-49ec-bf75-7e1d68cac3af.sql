ALTER TABLE public.rating_answers DROP CONSTRAINT IF EXISTS rating_answers_score_check;
UPDATE public.rating_answers SET score = score * 2 WHERE score <= 5;
ALTER TABLE public.rating_answers ADD CONSTRAINT rating_answers_score_check CHECK (score >= 1 AND score <= 10);