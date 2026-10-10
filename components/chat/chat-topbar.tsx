"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Lightbulb,
  ListOrdered,
  Code2,
} from "lucide-react";
import { CURATED_TOPICS } from "@/lib/learner/topics";

interface ChatTopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeStyle: string;
  conversationId?: string;
  activeTopic: string;
  onTopicChange: (topic: string) => void;
}

export function ChatTopbar({
  sidebarOpen,
  onToggleSidebar,
  activeStyle,
  conversationId,
  activeTopic,
  onTopicChange,
}: ChatTopbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 bg-card/20 px-4 py-2.5 backdrop-blur-sm gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-1.5 border border-border bg-card/60 text-muted-foreground hover:text-foreground transition"
          title={sidebarOpen ? "Hide Sessions" : "Show Sessions"}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {activeStyle === "analogy" ? (
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          ) : activeStyle === "steps" ? (
            <ListOrdered className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <Code2 className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span className="capitalize text-[11px] font-semibold">{activeStyle} Mode</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {conversationId && (
          <Link
            href={`/quiz?mode=chat&conversationId=${conversationId}${activeTopic ? `&slug=${activeTopic}` : ""}`}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Quiz me on this</span>
          </Link>
        )}

        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={activeTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Topics (Auto-detect)</option>
            {CURATED_TOPICS.map((t) => (
              <option key={t.slug} value={t.slug}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
