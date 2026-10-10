import type { UIMessage } from "ai";

export interface ParsedMessage {
  mainText: string;
  checkQuestion: string | null;
  suggestions: string[];
}

export function getMessageText(m: UIMessage): string {
  if (!m.parts || m.parts.length === 0) return "";
  return m.parts
    .map((part) => {
      if (part.type === "text") return part.text;
      return "";
    })
    .join("");
}

export function parseAssistantMessage(text: string): ParsedMessage {
  let cleaned = text;
  let checkQuestion: string | null = null;
  const suggestions: string[] = [];

  // Extract <check>question</check>
  const checkMatch = cleaned.match(/<check>([\s\S]*?)<\/check>/i);
  if (checkMatch) {
    checkQuestion = checkMatch[1].trim();
    cleaned = cleaned.replace(/<check>[\s\S]*?<\/check>/gi, "").trim();
  }

  // Extract <next>opt 1|opt 2|opt 3</next>
  const nextMatch = cleaned.match(/<next>([\s\S]*?)<\/next>/i);
  if (nextMatch) {
    const rawOptions = nextMatch[1].split("|");
    for (const opt of rawOptions) {
      const trimmed = opt.trim();
      if (trimmed) suggestions.push(trimmed);
    }
    cleaned = cleaned.replace(/<next>[\s\S]*?<\/next>/gi, "").trim();
  }

  return {
    mainText: cleaned,
    checkQuestion,
    suggestions,
  };
}
