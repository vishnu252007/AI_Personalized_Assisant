"use client";

import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { ConversationItem } from "@/lib/hooks/use-learn-query";

interface ChatSidebarProps {
  open: boolean;
  conversations: ConversationItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ChatSidebar({
  open,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ChatSidebarProps) {
  return (
    <div
      className={`border-r border-border bg-card/40 backdrop-blur-md transition-all duration-300 flex flex-col ${
        open ? "w-64 sm:w-72" : "w-0 overflow-hidden border-none"
      }`}
    >
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <span className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
          Sessions
        </span>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No previous sessions. Send a message to start!
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium cursor-pointer transition ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{conv.title || "Conversation"}</span>
                </div>
                <button
                  onClick={(e) => onDelete(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition"
                  title="Delete session"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
