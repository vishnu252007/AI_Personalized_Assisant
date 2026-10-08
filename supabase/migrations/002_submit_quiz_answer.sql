-- ==============================================================================
-- LearnAI — Migration 002: Atomic Quiz Answer Evaluation with Row Locks
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_user_id UUID,
  p_quiz_id UUID,
  p_question_id UUID,
  p_chosen_index INTEGER,
  p_time_ms INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_question public.questions%ROWTYPE;
  v_key public.question_keys%ROWTYPE;
  v_state public.learner_topic_state%ROWTYPE;
  v_style_stat public.style_stats%ROWTYPE;
  v_is_correct BOOLEAN;
  v_chosen_explanation TEXT;
  v_correct_explanation TEXT;
  v_topic_id UUID;
  v_tag TEXT;
  v_misconceptions JSONB;
  v_new_mastery NUMERIC(4, 3);
  v_new_half_life NUMERIC(6, 2);
  v_style_to_credit TEXT;
  v_reward INTEGER;
BEGIN
  -- 1. Row-lock quiz for update and verify ownership and status
  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUIZ_NOT_FOUND';
  END IF;

  IF v_quiz.status <> 'in_progress' THEN
    RAISE EXCEPTION 'QUIZ_INACTIVE';
  END IF;

  -- 2. Verify question belongs to this quiz
  SELECT * INTO v_question
  FROM public.questions
  WHERE id = p_question_id AND quiz_id = p_quiz_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUESTION_NOT_FOUND';
  END IF;

  -- 3. Check for duplicate attempt
  IF EXISTS (
    SELECT 1 FROM public.attempts
    WHERE user_id = p_user_id AND question_id = p_question_id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SUBMISSION';
  END IF;

  -- 4. Fetch question key
  SELECT * INTO v_key
  FROM public.question_keys
  WHERE question_id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KEY_NOT_FOUND';
  END IF;

  -- 5. Evaluate correctness
  v_is_correct := (p_chosen_index = v_key.correct_index);
  v_chosen_explanation := COALESCE(v_key.rationales->>p_chosen_index, 'No explanation provided.');
  v_correct_explanation := COALESCE(v_key.rationales->>v_key.correct_index, 'No explanation provided.');
  v_topic_id := COALESCE(v_question.topic_id, v_quiz.topic_id);

  -- 6. Insert attempt
  INSERT INTO public.attempts (
    quiz_id,
    question_id,
    user_id,
    selected_index,
    is_correct,
    response_time_ms
  ) VALUES (
    p_quiz_id,
    p_question_id,
    p_user_id,
    p_chosen_index,
    v_is_correct,
    p_time_ms
  );

  -- 7. Update quiz score if correct
  IF v_is_correct THEN
    UPDATE public.quizzes
    SET score = score + 1
    WHERE id = p_quiz_id;
  END IF;

  -- 8. Lock and update learner_topic_state
  IF v_topic_id IS NOT NULL THEN
    SELECT * INTO v_state
    FROM public.learner_topic_state
    WHERE user_id = p_user_id AND topic_id = v_topic_id
    FOR UPDATE;

    IF FOUND THEN
      v_misconceptions := v_state.misconceptions;
      IF NOT v_is_correct THEN
        v_tag := v_key.misconception_tags->>p_chosen_index;
        IF v_tag IS NOT NULL AND v_tag <> '' THEN
          v_misconceptions := jsonb_set(
            v_misconceptions,
            ARRAY[v_tag],
            to_jsonb(COALESCE((v_misconceptions->>v_tag)::INTEGER, 0) + 1)
          );
        END IF;
      END IF;

      -- Simple bounded update
      v_new_mastery := CASE
        WHEN v_is_correct THEN LEAST(1.000, v_state.mastery_score + 0.05)
        ELSE GREATEST(0.000, v_state.mastery_score - 0.05)
      END;

      v_new_half_life := CASE
        WHEN v_is_correct THEN LEAST(365.00, v_state.half_life_days * 1.5)
        ELSE GREATEST(0.50, v_state.half_life_days * 0.5)
      END;

      UPDATE public.learner_topic_state
      SET
        mastery_score = v_new_mastery,
        half_life_days = v_new_half_life,
        attempts_count = v_state.attempts_count + 1,
        last_reviewed_at = timezone('utc'::text, now()),
        misconceptions = v_misconceptions
      WHERE id = v_state.id;
    ELSE
      v_misconceptions := '{}'::jsonb;
      IF NOT v_is_correct THEN
        v_tag := v_key.misconception_tags->>p_chosen_index;
        IF v_tag IS NOT NULL AND v_tag <> '' THEN
          v_misconceptions := jsonb_build_object(v_tag, 1);
        END IF;
      END IF;

      INSERT INTO public.learner_topic_state (
        user_id,
        topic_id,
        mastery_score,
        half_life_days,
        attempts_count,
        last_reviewed_at,
        misconceptions
      ) VALUES (
        p_user_id,
        v_topic_id,
        CASE WHEN v_is_correct THEN 0.550 ELSE 0.450 END,
        CASE WHEN v_is_correct THEN 3.00 ELSE 1.00 END,
        1,
        timezone('utc'::text, now()),
        v_misconceptions
      );
    END IF;

    -- 9. Credit style
    v_reward := CASE WHEN v_is_correct THEN 1 ELSE 0 END;
    SELECT style INTO v_style_to_credit
    FROM public.style_stats
    WHERE user_id = p_user_id
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_style_to_credit IS NULL THEN
      v_style_to_credit := 'analogy';
    END IF;

    INSERT INTO public.style_stats (user_id, style, alpha, beta)
    VALUES (
      p_user_id,
      v_style_to_credit,
      CASE WHEN v_reward = 1 THEN 2.0 ELSE 1.0 END,
      CASE WHEN v_reward = 0 THEN 2.0 ELSE 1.0 END
    )
    ON CONFLICT (user_id, style) DO UPDATE
    SET
      alpha = CASE WHEN v_reward = 1 THEN public.style_stats.alpha + 1.0 ELSE public.style_stats.alpha END,
      beta  = CASE WHEN v_reward = 0 THEN public.style_stats.beta + 1.0 ELSE public.style_stats.beta END,
      updated_at = timezone('utc'::text, now());
  END IF;

  RETURN jsonb_build_object(
    'correct', v_is_correct,
    'correctIndex', v_key.correct_index,
    'chosenExplanation', v_chosen_explanation,
    'correctExplanation', v_correct_explanation
  );
END;
$$;
