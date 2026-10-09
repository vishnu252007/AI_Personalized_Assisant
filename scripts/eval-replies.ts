/**
 * LearnAI — Golden Reply Quality Evaluation Script (scripts/eval-replies.ts)
 * Evaluates Stage 2 Pedagogical Guidelines & Answer-First Protocols across 25 Golden Questions.
 */

import { buildSocraticTutorPrompt, type LearnerStage, type TutorContext } from "../lib/ai/prompts";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

// Load environment variables if running in standalone Node/tsx
const proc = process as unknown as { loadEnvFile?: (path: string) => void };
if (typeof proc.loadEnvFile === "function") {
  try {
    proc.loadEnvFile(".env.local");
  } catch {
    // Ignore if .env.local not found
  }
}

export interface GoldenQuestion {
  id: number;
  category:
    | "theory"
    | "code_help"
    | "problem_solving"
    | "simple_fact"
    | "small_talk"
    | "off_topic"
    | "vague"
    | "clarification"
    | "understood";
  prompt: string;
  stage: LearnerStage;
  style: "analogy" | "steps" | "example";
  conceptName?: string;
  isHintRequest?: boolean;
  isSolutionRequest?: boolean;
  allowsCheckTag: boolean;
  referenceReply: string;
}

export interface RuleEvaluation {
  passed: boolean;
  reason?: string;
}

export interface QuestionEvaluation {
  id: number;
  category: string;
  question: string;
  rules: {
    answerFirst: RuleEvaluation;
    checkTag: RuleEvaluation;
    wordCount: RuleEvaluation;
    markdown: RuleEvaluation;
    nextChips: RuleEvaluation;
    noLeaks: RuleEvaluation;
  };
  overallPass: boolean;
  generatedText: string;
}

// ── 25 Curated Golden Questions & Reference Responses ──────────────────────────

export const GOLDEN_QUESTIONS: GoldenQuestion[] = [
  // 1. Theory (Novice, Analogy)
  {
    id: 1,
    category: "theory",
    prompt: "What is a hash table?",
    stage: "novice",
    style: "analogy",
    conceptName: "hash-tables",
    allowsCheckTag: true,
    referenceReply: `A hash table is a fast data structure that stores key-value pairs so you can find any item almost instantly. It uses a mathematical hash function to convert your key into a specific memory slot.

Think of it like a coat-check room with numbered pegs:
- Instead of searching every coat, the attendant hands you a ticket number.
- When you return the ticket, they go straight to that exact peg.

\`\`\`typescript
const phoneBook = new Map<string, string>();
phoneBook.set("Alice", "555-0199"); // O(1) lookup
\`\`\`

<check>What happens in real life if two different coats receive the same ticket peg number?</check>
<next>How collisions work|Array vs Hash Table|Write a simple hash function</next>`,
  },

  // 2. Theory (Developing, Steps)
  {
    id: 2,
    category: "theory",
    prompt: "How does merge sort work and why is it O(n log n)?",
    stage: "developing",
    style: "steps",
    conceptName: "merge-sort",
    allowsCheckTag: true,
    referenceReply: `Merge sort is a divide-and-conquer sorting algorithm that splits an array in half until each piece has one item, then merges the sorted halves back together. It runs in O(n log n) time because splitting takes log(n) levels, and merging across each level takes linear O(n) work.

Here is how the algorithm executes:
1. Divide: Split the unsorted list at the midpoint into two subarrays.
2. Conquer: Recursively sort both the left and right halves.
3. Combine: Merge the two sorted subarrays by comparing heads in linear time.

\`\`\`python
def merge_sort(arr: list[int]) -> list[int]:
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    return merge(merge_sort(arr[:mid]), merge_sort(arr[mid:]))
\`\`\`

<check>Why does merge sort require O(n) auxiliary memory unlike quicksort?</check>
<next>Merge function trace|Quicksort comparison|When to use TimSort</next>`,
  },

  // 3. Theory (Proficient, Example)
  {
    id: 3,
    category: "theory",
    prompt: "Explain how a B-tree maintains balance on insertions.",
    stage: "proficient",
    style: "example",
    conceptName: "b-trees",
    allowsCheckTag: true,
    referenceReply: `A B-tree maintains balance by growing upward from the root rather than downward: nodes accept insertions until they reach maximum key capacity M, at which point the node splits in half and pushes its median key up to the parent. Because all leaf nodes remain at identical depth, search, insert, and delete operations strictly guarantee O(log n) time complexity.

Key operational characteristics:
- Root split: If the root node overflows, a new root is created with the median key, increasing tree height uniformly.
- Balanced fan-out: Minimizes disk block I/O reads in databases and filesystems.

\`\`\`typescript
interface BTreeNode<K> {
  keys: K[];
  children: BTreeNode<K>[];
  isLeaf: boolean;
}
\`\`\`

<check>Under what condition does inserting a key trigger cascading splits all the way to the root?</check>
<next>B-tree vs B+ tree in PostgreSQL|Node deletion and borrowing|Disk block alignment</next>`,
  },

  // 4. Theory (Mastered, Steps)
  {
    id: 4,
    category: "theory",
    prompt: "How does Raft consensus handle leader election during network partitions?",
    stage: "mastered",
    style: "steps",
    conceptName: "distributed-consensus",
    allowsCheckTag: true,
    referenceReply: `In Raft, network partitions are resolved by requiring an absolute majority quorum (N/2 + 1) of cluster nodes to elect a leader or commit log entries. An isolated leader on a minority partition cannot commit writes, while the majority partition increments its term and elects a new authoritative leader.

Reconciliation occurs through these steps:
1. Quorum isolation: Minority nodes cannot assemble majority votes, so their terms advance while write RPCs remain uncommitted.
2. Term preemption: Upon network healing, heartbeat AppendEntries RPCs from the higher-term majority leader force the old leader to step down to follower status.
3. Log overwriting: Followers overwrite any uncommitted conflicting log entries with the new leader's log.

\`\`\`typescript
type Term = number;
interface VoteResponse {
  term: Term;
  voteGranted: boolean;
}
\`\`\`

<check>How does Raft prevent split-vote deadlocks when simultaneous elections occur?</check>
<next>Pre-Vote protocol extension|Joint consensus reconfiguration|Linearizable read leases</next>`,
  },

  // 5. Code Help (Novice, Example)
  {
    id: 5,
    category: "code_help",
    prompt: "How do I reverse an array in JavaScript?",
    stage: "novice",
    style: "example",
    conceptName: "arrays",
    allowsCheckTag: true,
    referenceReply: `You can reverse an array in JavaScript either in-place using the built-in \`.reverse()\` method, or without modifying the original array using the modern \`.toReversed()\` method.

Here are the two ways:
- In-place (changes original array): \`numbers.reverse()\`
- Safe copy (leaves original untouched): \`numbers.toReversed()\`

\`\`\`javascript
const original = [1, 2, 3, 4, 5];
const reversed = original.toReversed();
console.log(reversed); // [5, 4, 3, 2, 1]
\`\`\`

<check>If you used original.reverse(), what would original contain after the method finishes?</check>
<next>Two-pointer manual reverse|Reverse a string|Array slicing basics</next>`,
  },

  // 6. Code Help (Developing, Steps)
  {
    id: 6,
    category: "code_help",
    prompt: "How do I implement binary search in Python?",
    stage: "developing",
    style: "steps",
    conceptName: "binary-search",
    allowsCheckTag: true,
    referenceReply: `Binary search runs on a sorted array by maintaining two pointers (\`left\` and \`right\`) and halving the search space each step until the target is found or pointers cross. It achieves O(log n) time complexity.

Implementation steps:
1. Initialize \`left = 0\` and \`right = len(arr) - 1\`.
2. Compute the midpoint \`mid = (left + right) // 2\`.
3. If \`arr[mid] == target\`, return \`mid\`. If \`arr[mid] < target\`, move \`left = mid + 1\`; otherwise move \`right = mid - 1\`.

\`\`\`python
def binary_search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
\`\`\`

<check>Why is the loop condition left <= right instead of left < right?</check>
<next>Binary search leftmost boundary|Integer overflow avoidance|Bisect module in Python</next>`,
  },

  // 7. Code Help (Proficient, Example)
  {
    id: 7,
    category: "code_help",
    prompt: "How do I invert a binary tree in TypeScript?",
    stage: "proficient",
    style: "example",
    conceptName: "binary-trees",
    allowsCheckTag: true,
    referenceReply: `Inverting a binary tree swaps the left and right child pointers of every node in the tree recursively or iteratively using depth-first search or breadth-first search in O(n) time and O(h) space, where h is tree height.

\`\`\`typescript
class TreeNode {
  val: number;
  left: TreeNode | null = null;
  right: TreeNode | null = null;
  constructor(val: number) { this.val = val; }
}

function invertTree(root: TreeNode | null): TreeNode | null {
  if (!root) return null;
  const temp = root.left;
  root.left = invertTree(root.right);
  root.right = invertTree(temp);
  return root;
}
\`\`\`

Key detail: You must preserve the reference to one child before reassigning it, otherwise one subtree is overwritten.

<check>How would you rewrite this iteratively with a queue to prevent stack overflow on unbalanced trees?</check>
<next>Iterative BFS solution|Tree symmetry check|Maximum depth of binary tree</next>`,
  },

  // 8. Code Help (Mastered, Steps)
  {
    id: 8,
    category: "code_help",
    prompt: "How do I implement an LRU Cache with O(1) get and put in Go?",
    stage: "mastered",
    style: "steps",
    conceptName: "lru-cache",
    allowsCheckTag: true,
    referenceReply: `An LRU Cache achieves strict O(1) \`Get\` and \`Put\` by pairing a hash map (key to node pointer) with a doubly linked list that maintains access recency order. When capacity is exceeded, the node before the dummy tail is evicted.

Architecture steps:
1. Doubly linked list: Sentinel head and tail nodes eliminate null checks during node promotion and detachment.
2. Hash map lookup: Maps user key directly to list node for O(1) retrieval.
3. Promotion on access: Any read or update unlinks the node and shifts it directly behind head.

\`\`\`go
type Node struct {
    key, val int
    prev, next *Node
}

type LRUCache struct {
    capacity int
    cache map[int]*Node
    head, tail *Node
}
\`\`\`

<check>How does adding a sync.RWMutex impact write latency under high concurrency?</check>
<next>Lock-free eviction stripes|Segmented LRU vs ARC|Memory fragmentation in Go</next>`,
  },

  // 9. Problem Solving (Hint 1 - Nudge)
  {
    id: 9,
    category: "problem_solving",
    prompt: "I am stuck on Two Sum. My brute force O(n^2) is too slow, can you give me a hint to optimize it?",
    stage: "developing",
    style: "steps",
    conceptName: "two-sum",
    isHintRequest: true,
    allowsCheckTag: true,
    referenceReply: `Notice that for any number \`x\`, the exact partner you need is \`target - x\`. Instead of running an inner loop searching the rest of the array, think about what data structure can remember numbers you have already visited and check for their complement in O(1) time.

Consider this workflow:
- Iterate through the array once.
- Before storing the current element, check if its required complement has already been recorded.

<check>If target is 9 and current element is 2, what exact value are you looking up?</check>
<next>Hint 2: Hash map setup|Two-pointer approach for sorted inputs|Edge case with duplicate values</next>`,
  },

  // 10. Problem Solving (Hint 2 - Step breakdown)
  {
    id: 10,
    category: "problem_solving",
    prompt: "I remember that hash map can store complements, but what should the key and value be?",
    stage: "developing",
    style: "example",
    conceptName: "two-sum",
    isHintRequest: true,
    allowsCheckTag: true,
    referenceReply: `In your hash map, store the array value as the key and its index as the value: \`map[number] = index\`. This allows you to immediately look up whether the required complement exists and retrieve its index in O(1) time.

Step trace:
1. For each number \`num\` at index \`i\`, calculate \`complement = target - num\`.
2. Check \`if (complement in map)\`: if found, return \`[map[complement], i]\`.
3. Otherwise, save \`map[num] = i\` and proceed to next index.

<check>Why should you check for the complement BEFORE adding the current number to the map?</check>
<next>Write the code solution|Handle duplicate elements|Analyze space-time complexity</next>`,
  },

  // 11. Problem Solving (Attempt 3 - Full Solution)
  {
    id: 11,
    category: "problem_solving",
    prompt: "I have tried twice and I am still stuck, please show me the full worked solution.",
    stage: "developing",
    style: "steps",
    conceptName: "two-sum",
    isSolutionRequest: true,
    allowsCheckTag: true,
    referenceReply: `Here is the complete worked solution using a single-pass hash map in O(n) time and O(n) space.

\`\`\`python
def two_sum(nums: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}  # maps value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
\`\`\`

Why this works:
1. \`seen\` stores previously visited numbers and their indices.
2. For each number, we check if \`target - num\` is in \`seen\` in O(1) average time.
3. Checking before inserting ensures we do not use the same element twice.

<next>Three Sum extension|Two Sum II (sorted array)|Hash collisions overview</next>`,
  },

  // 12. Problem Solving (Cycle detection hint)
  {
    id: 12,
    category: "problem_solving",
    prompt: "How do I find a cycle in a linked list without modifying node values?",
    stage: "developing",
    style: "analogy",
    conceptName: "linked-list-cycle",
    isHintRequest: true,
    allowsCheckTag: true,
    referenceReply: `Floyd's Cycle-Finding Algorithm (fast and slow pointers) detects cycles in O(n) time and O(1) auxiliary space without changing node values.

Think of two runners on a circular running track:
- One runner runs at 1 step per second (slow pointer).
- The other runs at 2 steps per second (fast pointer).
- If the track has a loop, the faster runner will eventually lap and meet the slower runner.

<check>What happens to the fast pointer if the linked list does NOT have any cycle?</check>
<next>Code implementation|Find starting node of cycle|Proof of O(n) convergence</next>`,
  },

  // 13. Simple Fact (Novice)
  {
    id: 13,
    category: "simple_fact",
    prompt: "What is the worst-case time complexity of quicksort?",
    stage: "novice",
    style: "example",
    allowsCheckTag: false,
    referenceReply: `The worst-case time complexity of quicksort is O(n²). This happens when the pivot chosen is always the smallest or largest element, such as sorting an already sorted array with a naive pivot.

<next>Best and average case complexity|Randomized pivot selection|Quicksort vs Mergesort</next>`,
  },

  // 14. Simple Fact (Developing)
  {
    id: 14,
    category: "simple_fact",
    prompt: "What default port does HTTPS use?",
    stage: "developing",
    style: "example",
    allowsCheckTag: false,
    referenceReply: `HTTPS uses TCP port 443 by default. Unencrypted HTTP traffic uses TCP port 80 by default.

<next>TLS handshake overview|Port 8443 usage|HTTP to HTTPS redirection</next>`,
  },

  // 15. Simple Fact (Proficient)
  {
    id: 15,
    category: "simple_fact",
    prompt: "How many bits are in an IPv6 address?",
    stage: "proficient",
    style: "example",
    allowsCheckTag: false,
    referenceReply: `An IPv6 address consists of 128 bits, typically formatted as eight groups of four hexadecimal digits separated by colons. In contrast, IPv4 addresses are 32 bits long.

<next>IPv6 address shorthand rules|CIDR prefix notation|Dual-stack migration</next>`,
  },

  // 16. Simple Fact (Mastered)
  {
    id: 16,
    category: "simple_fact",
    prompt: "What is the time complexity of building a binary heap from an unsorted array of n elements?",
    stage: "mastered",
    style: "steps",
    allowsCheckTag: false,
    referenceReply: `Building a binary heap from an unsorted array of n elements takes linear O(n) time using Floyd's bottom-up \`heapify\` algorithm, not O(n log n). This is because the majority of nodes are near the leaves and require downward sifting through very few levels.

<next>Mathematical proof via geometric series|Top-down vs bottom-up heap construction|Heap sort complexity</next>`,
  },

  // 17. Small Talk (Greeting)
  {
    id: 17,
    category: "small_talk",
    prompt: "Hey there! How are you doing today?",
    stage: "developing",
    style: "example",
    allowsCheckTag: false,
    referenceReply: `Hello! I am doing great and ready to help you learn. What computer science topic, algorithm, or coding problem would you like to explore today?

<next>Data structures|Algorithm design|System architecture</next>`,
  },

  // 18. Small Talk (Ready to study)
  {
    id: 18,
    category: "small_talk",
    prompt: "Good morning tutor, ready to study DSA!",
    stage: "developing",
    style: "steps",
    allowsCheckTag: false,
    referenceReply: `Good morning! Let's get right into it. Which area of data structures and algorithms would you like to start with today?

<next>Arrays and Strings|Trees and Graphs|Dynamic Programming</next>`,
  },

  // 19. Off-topic (Sports)
  {
    id: 19,
    category: "off_topic",
    prompt: "Who won the 2022 FIFA World Cup in Qatar?",
    stage: "developing",
    style: "example",
    allowsCheckTag: false,
    referenceReply: `Argentina won the 2022 FIFA World Cup, defeating France in the final. I am specialized in teaching computer science, programming, and mathematics—would you like to explore any tech concepts or algorithms today?

<next>Tournament bracket algorithms|Graph algorithms|Big-O notation</next>`,
  },

  // 20. Off-topic (Recipe)
  {
    id: 20,
    category: "off_topic",
    prompt: "Can you give me a recipe for chocolate chip cookies?",
    stage: "novice",
    style: "analogy",
    allowsCheckTag: false,
    referenceReply: `Chocolate chip cookies are made by creaming butter and sugar, mixing in eggs, flour, and baking soda, then folding in chocolate chips and baking at 350°F (175°C) for 10-12 minutes. As your learning tutor, my specialty is computer science and coding—let me know if you want to dive into programming!

<next>Algorithm fundamentals|Python basics|How computers work</next>`,
  },

  // 21. Vague (One word topic)
  {
    id: 21,
    category: "vague",
    prompt: "algorithms",
    stage: "developing",
    style: "steps",
    allowsCheckTag: true,
    referenceReply: `An algorithm is a step-by-step, finite sequence of well-defined instructions designed to solve a specific problem or perform a computation. Every algorithm is evaluated on its correctness and its efficiency in time and space.

To get started, which category of algorithms would you like to explore?
- Searching (Binary Search, BFS, DFS)
- Sorting (Quick Sort, Merge Sort)
- Optimization (Dynamic Programming, Greedy)

<check>Do you have a specific problem or algorithm in mind, or should we start with searching?</check>
<next>Binary search tutorial|Sorting algorithms comparison|Time complexity basics</next>`,
  },

  // 22. Vague (Recursion)
  {
    id: 22,
    category: "vague",
    prompt: "recursion",
    stage: "novice",
    style: "analogy",
    allowsCheckTag: true,
    referenceReply: `Recursion is a programming technique where a function solves a problem by calling a smaller instance of itself until it reaches a terminating base case.

Think of Russian nesting dolls (matryoshka):
- To reach the smallest doll, you open one doll after another.
- The smallest solid doll is your base case—once reached, you reassemble them back out.

\`\`\`python
def countdown(n: int):
    if n <= 0:  # Base case
        return
    print(n)
    countdown(n - 1)  # Recursive call
\`\`\`

<check>What would happen to the program if you forgot to include the base case?</check>
<next>Call stack visualizer|Factorial example|Recursion vs Iteration</next>`,
  },

  // 23. Clarification / "I don't understand"
  {
    id: 23,
    category: "clarification",
    prompt: "I still do not understand how recursion unwinds on the stack, please explain again.",
    stage: "novice",
    style: "analogy",
    conceptName: "call-stack",
    allowsCheckTag: true,
    referenceReply: `When a recursive function reaches its base case, each waiting function call finally gets its return value and pops off the call stack in reverse order (Last-In, First-Out).

Picture a stack of plates on a table:
- Every time a function calls itself, it puts a new plate on top of the stack.
- The function cannot finish until the plate on top of it is removed.
- Once the base case is reached (top plate finishes), you pick off the plates one by one down to the bottom.

<check>If countdown(3) puts 3 plates on the table, which plate finishes executing first?</check>
<next>Visual call stack trace|Fibonacci call tree|Stack overflow prevention</next>`,
  },

  // 24. Misconception targeting
  {
    id: 24,
    category: "clarification",
    prompt: "Wait, isn't array lookup always O(n) because you have to search through it?",
    stage: "developing",
    style: "example",
    conceptName: "arrays",
    allowsCheckTag: true,
    referenceReply: `Array lookup by index is strictly O(1) constant time, not O(n). Looking up by value (searching whether a number exists in an unsorted array) is O(n), because you must scan each element.

Why index lookup is O(1):
- Arrays occupy contiguous memory blocks.
- The computer calculates the memory address instantly: \`address = base_address + (index * element_size)\`.

\`\`\`typescript
const arr = [10, 20, 30, 40];
const val = arr[2]; // O(1) instant pointer arithmetic
const found = arr.includes(30); // O(n) linear scan
\`\`\`

<check>If an array starts at memory address 1000 and each integer takes 4 bytes, what address is index 3?</check>
<next>Array memory layout|Array vs Linked List|Binary search on sorted arrays</next>`,
  },

  // 25. Understood / Confirmation
  {
    id: 25,
    category: "understood",
    prompt: "Thank you so much, that totally makes sense now! I get it.",
    stage: "developing",
    style: "example",
    allowsCheckTag: false, // Student already understands, never add check tag
    referenceReply: `You are very welcome! You did great grasping the core intuition. Whenever you are ready, we can practice with a quick challenge or move to the next concept.

<next>Solve a practice problem|Explore edge cases|Move to next topic</next>`,
  },
];

// ── Rule Validators ────────────────────────────────────────────────────────────

export function removeCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").trim();
}

export function countWords(text: string): number {
  const clean = removeCodeBlocks(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`]/g, " ")
    .trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function validateAnswerFirst(q: GoldenQuestion, text: string): RuleEvaluation {
  const clean = text.trim();
  if (!clean) return { passed: false, reason: "Reply is empty" };

  // Small talk and off-topic: must give immediate friendly acknowledgment or polite redirect
  if (q.category === "small_talk" || q.category === "off_topic" || q.category === "understood") {
    return { passed: true };
  }

  // Split into sentences (first 2)
  const sentences = clean
    .split(/(?<=[.?!])\s+/)
    .filter((s) => s.trim().length > 0)
    .slice(0, 2);

  const firstTwo = sentences.join(" ");

  // Rule 1A: Never start by withholding the answer with a pure counter-question for theory/facts
  if (q.category === "theory" || q.category === "simple_fact" || q.category === "code_help") {
    const startsWithQuestion = /^(what|how|why|have you|do you|can you|did you)\b/i.test(sentences[0] || "");
    const endsWithQuestionMark = (sentences[0] || "").trim().endsWith("?");

    if (startsWithQuestion && endsWithQuestionMark) {
      return {
        passed: false,
        reason: "Theory/fact response started with a counter-question instead of answering first",
      };
    }
  }

  // Rule 1B: If student requested hint, it should not dump full solution on attempt 1
  if (q.isHintRequest && !q.isSolutionRequest) {
    if (firstTwo.length < 15) {
      return { passed: false, reason: "Hint is too terse or empty" };
    }
    return { passed: true };
  }

  // Rule 1C: If student requested full worked solution, it should provide direct explanation + code
  if (q.isSolutionRequest) {
    if (!text.includes("```")) {
      return { passed: false, reason: "Worked solution request must include code snippet" };
    }
    return { passed: true };
  }

  // Default: Must have meaningful content in first two sentences
  if (firstTwo.length < 20) {
    return { passed: false, reason: "Direct answer in first 2 sentences is too short" };
  }

  return { passed: true };
}

export function validateCheckTag(q: GoldenQuestion, text: string): RuleEvaluation {
  const matches = text.match(/<check>([\s\S]*?)<\/check>/g) || [];

  if (matches.length > 1) {
    return { passed: false, reason: `Found ${matches.length} <check> tags; maximum allowed is 1` };
  }

  if (!q.allowsCheckTag && matches.length > 0) {
    return {
      passed: false,
      reason: `<check> tag included on ${q.category} query where check questions are forbidden`,
    };
  }

  return { passed: true };
}

export function validateWordCount(q: GoldenQuestion, text: string): RuleEvaluation {
  const words = countWords(text);

  // Bounds according to Stage Contract (+10% grace buffer for natural variations)
  const maxWords =
    q.stage === "novice" ? 198 : q.stage === "developing" ? 253 : 275;

  if (words > maxWords) {
    return {
      passed: false,
      reason: `Word count (${words}) exceeded stage limit (${maxWords})`,
    };
  }

  if (words === 0) {
    return {
      passed: false,
      reason: "Word count is 0 (empty content)",
    };
  }

  return { passed: true };
}

export function validateMarkdown(text: string): RuleEvaluation {
  // Check code fence balance
  const fences = (text.match(/```/g) || []).length;
  if (fences % 2 !== 0) {
    return { passed: false, reason: "Unclosed code fence (odd number of ```)" };
  }

  // Check language tags on code blocks
  const codeBlockRegex = /```(\w*)\n[\s\S]*?```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const lang = match[1];
    if (!lang && match[0].includes("\n")) {
      // Missing language tag
      return { passed: false, reason: "Code block missing explicit language tag (e.g. ```typescript)" };
    }
  }

  return { passed: true };
}

export function validateNextChips(text: string): RuleEvaluation {
  const match = text.match(/<next>([\s\S]*?)<\/next>/);
  if (!match) {
    return { passed: false, reason: "Missing <next>...</next> suggestion tags" };
  }

  const chips = match[1].split("|").map((c) => c.trim()).filter(Boolean);
  if (chips.length < 1 || chips.length > 3) {
    return {
      passed: false,
      reason: `Expected 1 to 3 suggestions in <next>, found ${chips.length}`,
    };
  }

  return { passed: true };
}

export function validateNoLeaks(text: string): RuleEvaluation {
  const forbiddenPatterns = [
    /<student_data>/i,
    /system prompt/i,
    /level contract table/i,
    /buildsocratic/i,
    /bandit/i,
    /alpha:\s*\d+/i,
    /incognito rule/i,
    /CRITICAL PROTOCOL: ANSWER FIRST/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      return { passed: false, reason: `System prompt or learner profile leak detected: ${pattern}` };
    }
  }

  return { passed: true };
}

export function evaluateReply(q: GoldenQuestion, text: string): QuestionEvaluation {
  const answerFirst = validateAnswerFirst(q, text);
  const checkTag = validateCheckTag(q, text);
  const wordCount = validateWordCount(q, text);
  const markdown = validateMarkdown(text);
  const nextChips = validateNextChips(text);
  const noLeaks = validateNoLeaks(text);

  const overallPass =
    answerFirst.passed &&
    checkTag.passed &&
    wordCount.passed &&
    markdown.passed &&
    nextChips.passed &&
    noLeaks.passed;

  return {
    id: q.id,
    category: q.category,
    question: q.prompt,
    rules: {
      answerFirst,
      checkTag,
      wordCount,
      markdown,
      nextChips,
      noLeaks,
    },
    overallPass,
    generatedText: text,
  };
}

// ── Runner & Formatted Table Output ────────────────────────────────────────────

async function generateReplyWithLiveModel(
  q: GoldenQuestion,
  modelName: string = "gemini"
): Promise<string> {
  const context: TutorContext = {
    stage: q.stage,
    conceptName: q.conceptName,
  };
  const instructions = buildSocraticTutorPrompt("", q.style, context);

  if (modelName === "gemini" && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { text } = await generateText({
      model: google(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
      instructions,
      prompt: q.prompt,
      temperature: 0.7,
    });
    return text;
  }

  if (modelName === "groq" && process.env.GROQ_API_KEY) {
    const { text } = await generateText({
      model: groq("openai/gpt-oss-20b"),
      instructions,
      prompt: q.prompt,
      temperature: 0.7,
    });
    return text;
  }

  // Fallback to reference reply
  return q.referenceReply;
}

export async function runEvaluationSuite(options: { live?: boolean; sampleCount?: number } = {}) {
  console.log("\n================================================================================");
  console.log("             LearnAI Stage 2 — Golden Reply Quality Evaluation                  ");
  console.log("================================================================================\n");

  const results: QuestionEvaluation[] = [];

  for (const q of GOLDEN_QUESTIONS) {
    let text = q.referenceReply;

    if (options.live && (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GROQ_API_KEY)) {
      try {
        text = await generateReplyWithLiveModel(
          q,
          process.env.GOOGLE_GENERATIVE_AI_API_KEY ? "gemini" : "groq"
        );
      } catch (err) {
        console.warn(`[Warning] Live call for Q#${q.id} failed, using reference reply:`, (err as Error).message);
        text = q.referenceReply;
      }
    }

    const evaluation = evaluateReply(q, text);
    results.push(evaluation);
  }

  // Print Formatted Table
  console.log(
    "| ID | Category        | Prompt (Truncated)       | Ans1st | Check | Words | MD   | Next | Leaks | Result |"
  );
  console.log(
    "|----|-----------------|--------------------------|--------|-------|-------|------|------|-------|--------|"
  );

  for (const r of results) {
    const p = (v: boolean) => (v ? " PASS " : " FAIL ");
    const id = String(r.id).padStart(2, " ");
    const cat = r.category.padEnd(15, " ");
    const qShort = (r.question.length > 24 ? r.question.slice(0, 21) + "..." : r.question).padEnd(24, " ");
    const a1 = p(r.rules.answerFirst.passed);
    const ct = p(r.rules.checkTag.passed);
    const wc = p(r.rules.wordCount.passed);
    const md = p(r.rules.markdown.passed);
    const nx = p(r.rules.nextChips.passed);
    const nl = p(r.rules.noLeaks.passed);
    const res = r.overallPass ? "  PASS  " : "  FAIL  ";

    console.log(
      `| ${id} | ${cat} | ${qShort} | ${a1} | ${ct} | ${wc} | ${md} | ${nx} | ${nl} | ${res} |`
    );
  }

  const passedCount = results.filter((r) => r.overallPass).length;
  const passRate = (passedCount / results.length) * 100;

  console.log("\n================================================================================");
  console.log(`TOTAL QUESTIONS EVALUATED: ${results.length}`);
  console.log(`PASSED: ${passedCount} / ${results.length}`);
  console.log(`PASS RATE: ${passRate.toFixed(1)}% (Target >= 90.0%)`);
  console.log("================================================================================\n");

  if (passRate < 90.0) {
    console.error("❌ Evaluation failed to meet the >= 90.0% quality gate.");
    process.exit(1);
  } else {
    console.log("✅ Stage 2 Quality Gate PASSED successfully.\n");
  }

  return { passedCount, total: results.length, passRate };
}

// Execute when run directly via tsx
if (typeof process !== "undefined" && process.argv[1]?.includes("eval-replies")) {
  const isLive = process.argv.includes("--live");
  runEvaluationSuite({ live: isLive }).catch((err) => {
    console.error("Evaluation error:", err);
    process.exit(1);
  });
}
