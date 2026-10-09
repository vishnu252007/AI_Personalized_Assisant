-- ==============================================================================
-- LearnAI — Migration 003: Open Concepts, Chat Quizzes & Learning Events
-- (supabase/migrations/003_concepts_and_events.sql)
-- ==============================================================================

-- 1. Extend Quizzes table for Chat integration and open concepts
ALTER TABLE public.quizzes 
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concept_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_quizzes_conversation ON public.quizzes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_concept_slug ON public.quizzes(concept_slug);
CREATE INDEX IF NOT EXISTS idx_topics_slug ON public.topics(slug);

-- 2. Learning Events Table (Fine-grained pedagogical audit trail)
CREATE TABLE IF NOT EXISTS public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'quiz_generated',
    'quiz_completed',
    'question_answered',
    'concept_extracted',
    'hint_delivered',
    'style_updated'
  )),
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  concept_slug TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_events_user ON public.learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_type ON public.learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_created ON public.learning_events(created_at DESC);

-- 3. Row Level Security for Learning Events
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own learning events
DROP POLICY IF EXISTS "Users can read own learning events" ON public.learning_events;
CREATE POLICY "Users can read own learning events"
  ON public.learning_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role admin client can insert learning events (derived data integrity)
-- No INSERT/UPDATE/DELETE policy for authenticated client
