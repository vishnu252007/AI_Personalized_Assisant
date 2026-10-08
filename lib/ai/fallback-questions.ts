/**
 * Pre-generated fallback question bank.
 * Used when AI providers fail during quiz generation.
 * Covers core topics at various difficulty levels.
 */

import type { QuizQuestionGenerated } from "@/lib/ai/schemas";

export interface FallbackQuestion extends QuizQuestionGenerated {
  topicSlug: string;
}

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
  {
    topicSlug: "arrays-and-hashing",
    questionText: "What is the average time complexity of hash table lookup?",
    difficulty: 1,
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correctIndex: 0,
    rationales: [
      "Correct — hash tables provide O(1) average-case lookup via direct indexing.",
      "O(log n) is typical of balanced BST lookups, not hash tables.",
      "O(n) would be a worst-case scenario with many collisions, not average.",
      "O(n²) is not applicable to single-element lookups."
    ],
    misconceptionTags: [null, "bst-confusion", "worst-case-assumed", "quadratic-confusion"],
  },
  {
    topicSlug: "arrays-and-hashing",
    questionText: "Which approach efficiently finds two numbers that sum to a target in an unsorted array?",
    difficulty: 2,
    options: ["Nested loops", "Hash map", "Binary search on original array", "Sorting then two pointers"],
    correctIndex: 1,
    rationales: [
      "Nested loops work but are O(n²). Not the most efficient.",
      "Correct — a hash map gives O(n) time by checking complements.",
      "Binary search requires sorted input; the array is unsorted.",
      "Sorting + two pointers is O(n log n), not as efficient as the hash approach."
    ],
    misconceptionTags: ["brute-force-only", null, "unsorted-search", "over-sorting"],
  },
  {
    topicSlug: "binary-search",
    questionText: "What is the time complexity of binary search on a sorted array of n elements?",
    difficulty: 1,
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctIndex: 1,
    rationales: [
      "O(1) would mean finding the element immediately, which is not guaranteed.",
      "Correct — binary search halves the search space each step, yielding O(log n).",
      "O(n) is linear search, not binary search.",
      "O(n log n) is typical of efficient sorting algorithms, not searching."
    ],
    misconceptionTags: ["constant-lookup", null, "linear-search-confusion", "sort-confusion"],
  },
  {
    topicSlug: "linked-lists",
    questionText: "What technique detects a cycle in a linked list in O(1) extra space?",
    difficulty: 2,
    options: ["Hash set to track visited nodes", "Floyd's tortoise-and-hare algorithm", "Reversing the list", "Counting nodes"],
    correctIndex: 1,
    rationales: [
      "Hash set works but requires O(n) extra space, not O(1).",
      "Correct — Floyd's algorithm uses two pointers moving at different speeds with O(1) space.",
      "Reversing the list modifies the structure and does not reliably detect cycles.",
      "Counting nodes does not detect cycles — infinite loops may occur."
    ],
    misconceptionTags: ["space-complexity-ignored", null, "destructive-operation", "infinite-loop-risk"],
  },
  {
    topicSlug: "tree-traversals",
    questionText: "In which traversal order is a binary tree visited: left subtree, root, right subtree?",
    difficulty: 2,
    options: ["Pre-order", "In-order", "Post-order", "Level-order"],
    correctIndex: 1,
    rationales: [
      "Pre-order visits root first: root → left → right.",
      "Correct — in-order visits left → root → right.",
      "Post-order visits root last: left → right → root.",
      "Level-order visits nodes level by level (BFS), not in this pattern."
    ],
    misconceptionTags: ["root-first", null, "root-last-confusion", "bfs-confusion"],
  },
  {
    topicSlug: "dynamic-programming-1d",
    questionText: "What is the key property required for a problem to be solvable by dynamic programming?",
    difficulty: 3,
    options: ["Greedy choice property", "Optimal substructure and overlapping subproblems", "Graph connectivity", "Polynomial constraints"],
    correctIndex: 1,
    rationales: [
      "Greedy choice property is for greedy algorithms, not DP.",
      "Correct — DP requires both optimal substructure and overlapping subproblems.",
      "Graph connectivity is a graph theory concept, not a DP prerequisite.",
      "Polynomial constraints don't define DP applicability."
    ],
    misconceptionTags: ["greedy-confusion", null, "graph-misapplication", "unrelated-constraint"],
  },
  {
    topicSlug: "graphs-bfs-dfs",
    questionText: "Which algorithm is best suited for finding the shortest path in an unweighted graph?",
    difficulty: 3,
    options: ["DFS", "BFS", "Dijkstra's", "Bellman-Ford"],
    correctIndex: 1,
    rationales: [
      "DFS does not guarantee shortest paths; it explores deeply first.",
      "Correct — BFS explores by layers, naturally finding shortest paths in unweighted graphs.",
      "Dijkstra's works but is overkill for unweighted graphs. BFS is simpler and optimal.",
      "Bellman-Ford handles negative weights but is unnecessary for unweighted graphs."
    ],
    misconceptionTags: ["dfs-shortest-path", null, "over-engineering", "negative-weight-confusion"],
  },
  {
    topicSlug: "stacks-and-queues",
    questionText: "What happens when you push elements 1, 2, 3 onto a stack and then pop twice?",
    difficulty: 1,
    options: ["You get 1, 2", "You get 3, 2", "You get 2, 3", "You get 1, 3"],
    correctIndex: 1,
    rationales: [
      "Incorrect — stacks are LIFO, so 1 was pushed first and is at the bottom.",
      "Correct — LIFO order means 3 is popped first, then 2.",
      "This reverses the correct order.",
      "This skips 2, which violates LIFO."
    ],
    misconceptionTags: ["fifo-confusion", null, "order-reversal", "skip-element"],
  },
];

/**
 * Returns fallback questions for a given topic slug.
 * Falls back to arrays-and-hashing if no questions match.
 */
export function getFallbackQuestions(
  topicSlug: string,
  count: number
): FallbackQuestion[] {
  let matching = FALLBACK_QUESTIONS.filter((q) => q.topicSlug === topicSlug);
  if (matching.length === 0) {
    matching = FALLBACK_QUESTIONS.filter(
      (q) => q.topicSlug === "arrays-and-hashing"
    );
  }
  // Shuffle and take `count`
  const shuffled = [...matching].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
