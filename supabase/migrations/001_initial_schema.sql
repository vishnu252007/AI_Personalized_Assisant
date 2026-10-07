-- ==============================================================================
-- LearnAI — Initial Database Migration (001_initial_schema.sql)
-- Complete Hardened Schema with Foreign Keys, Constraints, Indexes & Strict RLS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Helper: Updated At Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subject TEXT,
  level TEXT DEFAULT 'beginner' NOT NULL,
  onboarded BOOLEAN DEFAULT false NOT NULL,
  preferred_style TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Topics Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT DEFAULT 'Computer Science' NOT NULL,
  domain TEXT DEFAULT 'Computer Science' NOT NULL,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. Learner Topic State (Elo Mastery & Spaced Repetition)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learner_topic_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  mastery_score NUMERIC(4, 3) DEFAULT 0.500 NOT NULL CHECK (mastery_score >= 0.0 AND mastery_score <= 1.0),
  half_life_days NUMERIC(6, 2) DEFAULT 2.00 NOT NULL CHECK (half_life_days >= 0.5 AND half_life_days <= 365.0),
  attempts_count INTEGER DEFAULT 0 NOT NULL,
  last_reviewed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  misconceptions JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_topic UNIQUE(user_id, topic_id)
);

DROP TRIGGER IF EXISTS trigger_learner_topic_state_updated_at ON public.learner_topic_state;
CREATE TRIGGER trigger_learner_topic_state_updated_at
  BEFORE UPDATE ON public.learner_topic_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Style Stats Table (Bayesian Learning Style Alpha/Beta Parameters)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.style_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  style TEXT NOT NULL,
  alpha FLOAT DEFAULT 1.0 NOT NULL,
  beta FLOAT DEFAULT 1.0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, style)
);

DROP TRIGGER IF EXISTS trigger_style_stats_updated_at ON public.style_stats;
CREATE TRIGGER trigger_style_stats_updated_at
  BEFORE UPDATE ON public.style_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Conversations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Conversation' NOT NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DROP TRIGGER IF EXISTS trigger_conversations_updated_at ON public.conversations;
CREATE TRIGGER trigger_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. Messages Table (role, style, content)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  style TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger Function: Update conversations.updated_at on message INSERT
CREATE OR REPLACE FUNCTION public.touch_conversation_updated_at()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = timezone('utc'::text, now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messages_touch_conversation ON public.messages;
CREATE TRIGGER trigger_messages_touch_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_updated_at();

-- ------------------------------------------------------------------------------
-- 7. Quizzes Table (topic_id nullable)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  status TEXT DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  score INTEGER DEFAULT 0 NOT NULL,
  total_questions INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 8. Questions Table (Public facing: choices only, no leaked answers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  order_index INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_options_length CHECK (jsonb_array_length(options) = 4)
);

-- ------------------------------------------------------------------------------
-- 9. Question Keys Table (Hardened Security: Answer keys & rationales)
-- Server-only access via Admin Client; no client RLS policies
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_keys (
  question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  rationales JSONB NOT NULL,
  misconception_tags JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_rationales_length CHECK (jsonb_array_length(rationales) = 4)
);

-- ------------------------------------------------------------------------------
-- 10. Attempts Table (Deterministic evaluation logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL CHECK (selected_index BETWEEN 0 AND 3),
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER DEFAULT 0 NOT NULL CHECK (response_time_ms >= 0),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_question_attempt UNIQUE (user_id, question_id)
);

-- ==============================================================================
-- Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_learner_topic_user ON public.learner_topic_state(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_topic_last_reviewed ON public.learner_topic_state(last_reviewed_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON public.attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON public.attempts(quiz_id);

-- ==============================================================================
-- Row Level Security (RLS) Enforcement
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learner_topic_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- 1. Topics: Viewable only by authenticated users
DROP POLICY IF EXISTS "Topics are viewable by authenticated users" ON public.topics;
CREATE POLICY "Topics are viewable by authenticated users" ON public.topics
  FOR SELECT TO authenticated USING (true);

-- 2. Profiles: Users manage only their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Learner Topic State: Client SELECT-only (Writes performed securely by server admin client)
DROP POLICY IF EXISTS "Users can view own learner state" ON public.learner_topic_state;
CREATE POLICY "Users can view own learner state" ON public.learner_topic_state
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Style Stats: Client SELECT-only (server writes via admin client)
DROP POLICY IF EXISTS "Users can manage own style stats" ON public.style_stats;
DROP POLICY IF EXISTS "Users can view own style stats" ON public.style_stats;
CREATE POLICY "Users can view own style stats" ON public.style_stats
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Conversations: Users manage own conversations
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
CREATE POLICY "Users can manage own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Messages: Users manage messages in their conversations
DROP POLICY IF EXISTS "Users can view messages of their conversations" ON public.messages;
CREATE POLICY "Users can view messages of their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.messages;
CREATE POLICY "Users can insert messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete messages of their conversations" ON public.messages;
CREATE POLICY "Users can delete messages of their conversations" ON public.messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- 7. Quizzes: Client SELECT-only (server writes via admin client)
DROP POLICY IF EXISTS "Users can manage own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can view own quizzes" ON public.quizzes;
CREATE POLICY "Users can view own quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() = user_id);

-- 8. Questions: Users can view questions of their quizzes
DROP POLICY IF EXISTS "Users can view questions of their quizzes" ON public.questions;
CREATE POLICY "Users can view questions of their quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE quizzes.id = questions.quiz_id
      AND quizzes.user_id = auth.uid()
    )
  );

-- 9. Question Keys: STRICT SECURITY (RLS enabled, zero client policies, server-only)
-- (No client policies defined; only service_role key can read/write question_keys)

-- 10. Attempts: Client SELECT-only (Writes performed securely by server admin client upon grading)
DROP POLICY IF EXISTS "Users can view own attempts" ON public.attempts;
CREATE POLICY "Users can view own attempts" ON public.attempts
  FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- Automatic Profile Creation Trigger on Sign Up (search_path hardened)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
