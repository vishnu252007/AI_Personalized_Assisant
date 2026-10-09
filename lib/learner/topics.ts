/**
 * LearnAI — Curated Topics and Canonicalization (lib/learner/topics.ts)
 * Follows Blueprint v2 Section 3.5.
 *
 * Topic resolution is strict: either the raw input is a listed slug, or it maps
 * to "other". No fuzzy/keyword matching — the analyzer LLM is responsible for
 * producing a valid slug from the curated list provided in the system prompt.
 */

export interface TopicDefinition {
  slug: string;
  name: string;
  subject: string;
  difficultyLevel: number;
}

export const CURATED_TOPICS: TopicDefinition[] = [
  { slug: "arrays-and-hashing", name: "Arrays & Hashing", subject: "Computer Science", difficultyLevel: 1 },
  { slug: "two-pointers", name: "Two Pointers", subject: "Computer Science", difficultyLevel: 2 },
  { slug: "sliding-window", name: "Sliding Window", subject: "Computer Science", difficultyLevel: 2 },
  { slug: "stacks-and-queues", name: "Stacks & Queues", subject: "Computer Science", difficultyLevel: 2 },
  { slug: "binary-search", name: "Binary Search", subject: "Computer Science", difficultyLevel: 2 },
  { slug: "linked-lists", name: "Linked Lists", subject: "Computer Science", difficultyLevel: 2 },
  { slug: "tree-traversals", name: "Tree Traversals (DFS/BFS)", subject: "Computer Science", difficultyLevel: 3 },
  { slug: "binary-search-trees", name: "Binary Search Trees", subject: "Computer Science", difficultyLevel: 3 },
  { slug: "heap-priority-queue", name: "Heaps & Priority Queues", subject: "Computer Science", difficultyLevel: 3 },
  { slug: "backtracking", name: "Backtracking & Recursion", subject: "Computer Science", difficultyLevel: 3 },
  { slug: "graphs-bfs-dfs", name: "Graph Algorithms (BFS & DFS)", subject: "Computer Science", difficultyLevel: 4 },
  { slug: "dynamic-programming-1d", name: "1-D Dynamic Programming", subject: "Computer Science", difficultyLevel: 4 },
  { slug: "dynamic-programming-2d", name: "2-D Dynamic Programming", subject: "Computer Science", difficultyLevel: 5 },
  { slug: "trie-prefix-tree", name: "Tries & Prefix Trees", subject: "Computer Science", difficultyLevel: 3 },
];

export const CURATED_TOPIC_SLUGS = CURATED_TOPICS.map((t) => t.slug) as readonly string[];

/**
 * Strict slug canonicalization: listed slug → slug, or sanitized open slug if allowOpenTopics is true.
 */
export function canonicalizeTopicSlug(rawInput: string, allowOpenTopics: boolean = false): string {
  if (!rawInput || typeof rawInput !== "string") {
    return "other";
  }

  const normalized = rawInput
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const match = CURATED_TOPICS.find((t) => t.slug === normalized);
  if (match) {
    return match.slug;
  }

  if (allowOpenTopics && normalized.length > 0) {
    return normalized.slice(0, 40);
  }

  return "other";
}

/**
 * Retrieves topic metadata by its unique slug.
 */
export function getTopicBySlug(slug: string): TopicDefinition | undefined {
  return CURATED_TOPICS.find((t) => t.slug === slug);
}
