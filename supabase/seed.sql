-- ==============================================================================
-- LearnAI — Seed Data (supabase/seed.sql)
-- Curriculum: Computer Science & AI Fundamentals
-- ==============================================================================

INSERT INTO public.topics (slug, name, description, domain, difficulty_level)
VALUES
  (
    'arrays-and-hashing',
    'Arrays & Hashing',
    'Core data structure fundamentals: contiguous memory, hash tables, key-value lookup, frequency maps, and collision resolution.',
    'Computer Science',
    1
  ),
  (
    'two-pointers-sliding-window',
    'Two Pointers & Sliding Window',
    'Two-index optimization patterns: converging pointers, fast/slow runners, fixed-length windows, and dynamic subarray intervals.',
    'Computer Science',
    2
  ),
  (
    'binary-trees-and-graphs',
    'Binary Trees & Graphs',
    'Hierarchical & networked structures: DFS, BFS, tree traversal orders (in/pre/post), recursion, cycle detection, and adjacency lists.',
    'Computer Science',
    3
  ),
  (
    'dynamic-programming',
    'Dynamic Programming',
    'Optimization via overlapping subproblems: optimal substructure, top-down memoization, bottom-up tabulation, and state transition equations.',
    'Computer Science',
    4
  ),
  (
    'neural-networks-gradient-descent',
    'Neural Networks & Gradient Descent',
    'Foundations of deep learning: perceptrons, activation functions, loss landscapes, backpropagation, chain rule, and learning rates.',
    'Artificial Intelligence',
    3
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  domain = EXCLUDED.domain,
  difficulty_level = EXCLUDED.difficulty_level;
