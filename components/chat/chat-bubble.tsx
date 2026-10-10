"use client";

import * as React from "react";
import { Copy, Check, HelpCircle, ThumbsUp, ThumbsDown } from "lucide-react";

export function CodeSnippetBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/80 bg-slate-950 text-slate-100 overflow-hidden my-2 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span className="capitalize">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition px-1.5 py-0.5 rounded hover:bg-slate-800"
          title="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function FormattedMessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const firstLine = lines[0]?.trim() || "";
          const hasLang = !firstLine.includes(" ") && firstLine.length > 0;
          const language = hasLang ? firstLine : "code";
          const codeBody = hasLang ? lines.slice(1).join("\n") : lines.join("\n");

          return <CodeSnippetBlock key={index} code={codeBody} language={language} />;
        }

        return (
          <div key={index} className="whitespace-pre-wrap font-sans">
            {part}
          </div>
        );
      })}
    </div>
  );
}

export function ConceptCheckCard({
  question,
  conversationId,
  conceptSlug,
}: {
  question: string;
  conversationId?: string;
  conceptSlug?: string;
}) {
  const [answer, setAnswer] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{
    evaluation: "correct" | "partial" | "wrong";
    feedback: string;
    misconceptionTag?: string | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: question,
          studentAnswer: answer.trim(),
          conversationId,
          conceptSlug,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch {
      // Ignored
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs space-y-2.5">
      <div className="flex items-center gap-1.5 font-semibold text-amber-500">
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Concept Check</span>
      </div>
      <p className="text-foreground/90 font-medium">{question}</p>

      {result ? (
        <div
          className={`rounded-lg p-2.5 space-y-1 text-xs border ${
            result.evaluation === "correct"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : result.evaluation === "partial"
              ? "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400"
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold capitalize">
            <span>
              {result.evaluation === "correct"
                ? "✓ Correct Understanding"
                : result.evaluation === "partial"
                ? "◐ Partially Correct"
                : "✗ Needs Clarification"}
            </span>
            {result.misconceptionTag && (
              <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono lowercase">
                tag: {result.misconceptionTag}
              </span>
            )}
          </div>
          <p className="text-foreground/80 leading-relaxed">{result.feedback}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitting}
            placeholder="Type your answer to verify your reasoning..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!answer.trim() || submitting}
            className="rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 transition disabled:opacity-50"
          >
            {submitting ? "Checking..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}

export function FeedbackBar({
  conversationId,
  conceptSlug,
}: {
  conversationId?: string;
  conceptSlug?: string;
}) {
  const [given, setGiven] = React.useState<string | null>(null);

  const sendFeedback = async (type: string) => {
    setGiven(type);
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, conceptSlug, type }),
      });
    } catch {
      // Ignored
    }
  };

  if (given) {
    return (
      <div className="text-[11px] text-muted-foreground italic pt-1">
        ✓ Feedback recorded ({given.replace("_", " ")})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
      <span className="text-[10px] uppercase font-semibold text-muted-foreground/80 mr-1">
        Feedback:
      </span>
      <button
        onClick={() => sendFeedback("thumbs_up")}
        className="p-1 hover:text-emerald-500 rounded hover:bg-accent transition"
        title="Helpful explanation"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => sendFeedback("thumbs_down")}
        className="p-1 hover:text-rose-500 rounded hover:bg-accent transition"
        title="Unhelpful"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}
