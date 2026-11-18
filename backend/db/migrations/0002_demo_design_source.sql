-- =====================================================================
-- TrendsTees  |  Migration 002  |  Demo design source tracking
-- =====================================================================
-- Kyun: TeePublic se scraped designs sirf LOCAL demo ke liye hain.
-- Har design pe likha hoga ke woh kahan se aaya, taake launch se pehle
-- ek query se saare demo designs hataye ja sakein.
--
-- source_platform  = 'own' (apne designs)  ya  'teepublic_demo'
-- source_reference = source website ka design id (duplicate import rokne ke liye)
-- =====================================================================


ALTER TABLE public.designs
  ADD COLUMN source_platform  varchar(30)  NOT NULL DEFAULT 'own',
  ADD COLUMN source_reference varchar(300);

ALTER TABLE public.designs ADD CONSTRAINT chk_designs_source_platform
  CHECK (source_platform IN ('own', 'teepublic_demo'));

-- Same source design do baar import na ho
CREATE UNIQUE INDEX uq_designs_source_ref
  ON public.designs (source_platform, source_reference)
  WHERE source_reference IS NOT NULL;

