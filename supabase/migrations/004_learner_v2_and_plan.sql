-- ==============================================================================
-- LearnAI — Migration 004: Learner Model v2, Learner Traits & Daily Plan
-- (supabase/migrations/004_learner_v2_and_plan.sql)
-- ==============================================================================

-- 1. Daily Plan Items Table
CREATE TABLE IF NOT EXISTS public.plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('review', 'micro_lesson', 'practice', 'reflect')),
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  concept_name TEXT NOT NULL,
  concept_slug TEXT NOT NULL,
  est_minutes INT NOT NULL DEFAULT 5 CHECK (est_minutes BETWEEN 1 AND 60),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_items_user_date ON public.plan_items(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_plan_items_status ON public.plan_items(status);

-- 2. Learner Traits Table (EWMA Behavioral Profile)
CREATE TABLE IF NOT EXISTS public.learner_traits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_depth TEXT NOT NULL DEFAULT 'balanced' CHECK (preferred_depth IN ('concise', 'balanced', 'in-depth')),
  preferred_length TEXT NOT NULL DEFAULT 'standard' CHECK (preferred_length IN ('short', 'standard', 'detailed')),
  preferred_style TEXT NOT NULL DEFAULT 'analogy' CHECK (preferred_style IN ('analogy', 'steps', 'code_first')),
  pace TEXT NOT NULL DEFAULT 'moderate' CHECK (pace IN ('slow', 'moderate', 'fast')),
  persistence_score NUMERIC NOT NULL DEFAULT 0.50 CHECK (persistence_score BETWEEN 0.0 AND 1.0),
  theory_vs_problem_ratio NUMERIC NOT NULL DEFAULT 0.50 CHECK (theory_vs_problem_ratio BETWEEN 0.0 AND 1.0),
  daily_goal_minutes INT NOT NULL DEFAULT 15 CHECK (daily_goal_minutes BETWEEN 5 AND 120),
  active_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Extend learner_topic_state for Learner Model v2
ALTER TABLE public.learner_topic_state
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'exploring' CHECK (stage IN ('unseen', 'exploring', 'developing', 'proficient', 'mastered')),
  ADD COLUMN IF NOT EXISTS evidence_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0;

-- 4. Enable RLS on newly created tables
ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_traits ENABLE ROW LEVEL SECURITY;

-- Plan items policies: authenticated users can read and update their own items
DROP POLICY IF EXISTS "Users can read own plan items" ON public.plan_items;
CREATE POLICY "Users can read own plan items"
  ON public.plan_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plan items" ON public.plan_items;
CREATE POLICY "Users can update own plan items"
  ON public.plan_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Learner traits policy: users can read their own traits (writes via admin client only)
DROP POLICY IF EXISTS "Users can read own traits" ON public.learner_traits;
CREATE POLICY "Users can read own traits"
  ON public.learner_traits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
