import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/ai/provider";
import { z } from "zod";
import { CURATED_TOPICS } from "./topics";

const conceptExtractionSchema = z.object({
  conceptName: z.string().min(1).max(60),
  conceptSlug: z.string().min(1).max(40),
  difficulty: z.number().int().min(1).max(5).default(2),
  misconceptions: z.array(z.string()).default([]),
});

/**
 * Normalizes any string into a clean, sanitized slug matching /^[a-z0-9-]{1,40}$/
 */
export function toConceptSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return slug || "general-concept";
}

export interface ExtractedConcept {
  conceptName: string;
  conceptSlug: string;
  difficulty: number;
  misconceptions: string[];
}

/**
 * Extracts the primary concept discussed in recent conversation turns.
 */
export async function extractConceptFromConversation(
  turns: { role: string; content: string }[],
  subject: string = "Computer Science"
): Promise<ExtractedConcept> {
  const recentTurns = turns.slice(-6);
  const userContent = recentTurns
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");

  // Quick fallback check against curated topics
  const lowerContent = userContent.toLowerCase();
  for (const topic of CURATED_TOPICS) {
    if (lowerContent.includes(topic.slug) || lowerContent.includes(topic.name.toLowerCase())) {
      return {
        conceptName: topic.name,
        conceptSlug: topic.slug,
        difficulty: topic.difficultyLevel,
        misconceptions: [],
      };
    }
  }

  // Use AI Provider to extract open concept
  try {
    const provider = getProvider();
    const prompt = `Analyze this conversation snippet and extract the primary technical concept being learned.
Subject: ${subject}

Conversation:
${userContent}

Identify:
1. conceptName: Short, proper display name (e.g. "Next.js App Router", "B-Tree Indexing", "Binary Search Tree").
2. conceptSlug: Clean hyphenated slug (e.g. "nextjs-app-router", "b-tree-indexing", "binary-search-tree").
3. difficulty: Integer 1 (fundamental) to 5 (expert).
4. misconceptions: Array of any confusing points or errors the student exhibited.`;

    const result = await provider.generateStructured(
      prompt,
      conceptExtractionSchema,
      "You are a computer science curriculum analyzer. Extract clean concept entities."
    );

    return {
      conceptName: result.conceptName,
      conceptSlug: toConceptSlug(result.conceptSlug),
      difficulty: result.difficulty,
      misconceptions: result.misconceptions.map(toConceptSlug),
    };
  } catch {
    // Graceful fallback from recent user message text
    const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
    const rawText = lastUserTurn?.content?.slice(0, 30) || "Computer Science";
    const slug = toConceptSlug(rawText);
    return {
      conceptName: rawText.trim() || "Computer Science",
      conceptSlug: slug,
      difficulty: 2,
      misconceptions: [],
    };
  }
}

export interface EnsureTopicResult {
  id: string;
  slug: string;
  name: string;
  difficultyLevel: number;
}

/**
 * Ensures a topic exists in public.topics, creating it dynamically if not present.
 */
export async function ensureTopicExists(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    name: string;
    slug?: string;
    subject?: string;
    domain?: string;
    difficultyLevel?: number;
  }
): Promise<EnsureTopicResult> {
  const cleanSlug = toConceptSlug(params.slug || params.name);

  // 1. Check if topic already exists
  const { data: existing } = await admin
    .from("topics")
    .select("id, slug, name, difficulty_level")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      name: existing.name,
      difficultyLevel: existing.difficulty_level || 2,
    };
  }

  // 2. Insert new open concept dynamically
  const newTopic = {
    slug: cleanSlug,
    name: params.name.slice(0, 80),
    description: `Dynamic concept node for ${params.name}`,
    subject: params.subject || "Computer Science",
    domain: params.domain || "Computer Science",
    difficulty_level: params.difficultyLevel || 2,
  };

  const { data: inserted, error } = await admin
    .from("topics")
    .insert(newTopic)
    .select("id, slug, name, difficulty_level")
    .single();

  if (error || !inserted) {
    // If concurrent insert occurred, fetch it
    const { data: retry } = await admin
      .from("topics")
      .select("id, slug, name, difficulty_level")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (retry) {
      return {
        id: retry.id,
        slug: retry.slug,
        name: retry.name,
        difficultyLevel: retry.difficulty_level || 2,
      };
    }

    throw new Error(`Failed to ensure topic exists: ${error?.message || "Unknown error"}`);
  }

  return {
    id: inserted.id,
    slug: inserted.slug,
    name: inserted.name,
    difficultyLevel: inserted.difficulty_level || 2,
  };
}
