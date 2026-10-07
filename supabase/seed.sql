-- ==============================================================================
-- LearnAI — Seed Data (supabase/seed.sql)
-- Curriculum: Expanded Computer Science & Algorithms (14 Fine-Grained Topics)
-- ==============================================================================

INSERT INTO public.topics (slug, name, description, subject, domain, difficulty_level)
VALUES
  (
    'arrays-and-hashing',
    'Arrays & Hashing',
    'Core data structure fundamentals: contiguous memory, hash tables, key-value lookup, frequency maps, and collision resolution.',
    'Computer Science',
    'Computer Science',
    1
  ),
  (
    'two-pointers',
    'Two Pointers',
    'Two-index coordination patterns: converging boundaries, sorted pair search, palindrome verification, and partition schemes.',
    'Computer Science',
    'Computer Science',
    2
  ),
  (
    'sliding-window',
    'Sliding Window',
    'Contiguous subarray optimization: fixed-size rolling windows, dynamic expanding/contracting intervals, and substring frequency tracking.',
    'Computer Science',
    'Computer Science',
    2
  ),
  (
    'stacks-and-queues',
    'Stacks & Queues',
    'LIFO and FIFO linear structures: monotonic stacks, bracket validation, recursive call simulations, and double-ended queues.',
    'Computer Science',
    'Computer Science',
    2
  ),
  (
    'binary-search',
    'Binary Search',
    'Logarithmic search principles: interval halving, rotated sorted array search, upper/lower bounds, and binary search on answer space.',
    'Computer Science',
    'Computer Science',
    2
  ),
  (
    'linked-lists',
    'Linked Lists',
    'Non-contiguous node chains: fast/slow pointer cycle detection, in-place list reversal, dummy nodes, and merge routines.',
    'Computer Science',
    'Computer Science',
    2
  ),
  (
    'tree-traversals',
    'Tree Traversals (DFS/BFS)',
    'Hierarchical traversal orders: pre-order, in-order, post-order DFS recursion, and queue-driven level-order BFS explorations.',
    'Computer Science',
    'Computer Science',
    3
  ),
  (
    'binary-search-trees',
    'Binary Search Trees',
    'Ordered tree invariant properties: valid BST validation, lowest common ancestor, node insertion, deletion, and in-order predecessor/successor.',
    'Computer Science',
    'Computer Science',
    3
  ),
  (
    'heap-priority-queue',
    'Heaps & Priority Queues',
    'Complete binary trees and priority extraction: min-heaps, max-heaps, top-K frequent elements, and median tracking in data streams.',
    'Computer Science',
    'Computer Science',
    3
  ),
  (
    'backtracking',
    'Backtracking & Recursion',
    'Exhaustive state-space tree traversal: decision trees, subsets, permutations, combination sums, constraint satisfaction, and pruning.',
    'Computer Science',
    'Computer Science',
    3
  ),
  (
    'graphs-bfs-dfs',
    'Graph Algorithms (BFS & DFS)',
    'Networked relationships: adjacency lists, connected components, cycle detection in directed/undirected graphs, and topological sorting.',
    'Computer Science',
    'Computer Science',
    4
  ),
  (
    'dynamic-programming-1d',
    '1-D Dynamic Programming',
    'Linear recurrence relations: overlapping subproblems, memoization, bottom-up state arrays, space optimization, and fibonacci-style transitions.',
    'Computer Science',
    'Computer Science',
    4
  ),
  (
    'dynamic-programming-2d',
    '2-D Dynamic Programming',
    'Multi-dimensional state spaces: grid traversals, longest common subsequence, edit distance, 0/1 knapsack, and partition optimization.',
    'Computer Science',
    'Computer Science',
    5
  ),
  (
    'trie-prefix-tree',
    'Tries & Prefix Trees',
    'N-ary retrieval trees: string prefix matching, character path transitions, autocomplete dictionaries, and wildcard pattern searching.',
    'Computer Science',
    'Computer Science',
    3
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  subject = EXCLUDED.subject,
  domain = EXCLUDED.domain,
  difficulty_level = EXCLUDED.difficulty_level;
