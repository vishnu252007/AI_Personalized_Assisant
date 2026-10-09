"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Brain,
  Send,
  Sparkles,
  Plus,
  Trash2,
  Lightbulb,
  ListOrdered,
  Code2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { CURATED_TOPICS } from "@/lib/learner/topics";

interface ConversationItem {
  id: string;
  title: string;
  topic_id: string | null;
  updated_at: string;
}

function getMessageText(m: UIMessage): string {
  if (!m.parts || m.parts.length === 0) return "";
  return m.parts
    .map((part) => {
      if (part.type === "text") return part.text;
      return "";
    })
    .join("");
}

function ChatContent() {
  const searchParams = useSearchParams();
  const initialTopicSlug = searchParams.get("topic") || "";

  const [activeTopic, setActiveTopic] = React.useState<string>(initialTopicSlug);
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(undefined);
  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeStyle, setActiveStyle] = React.useState<string>("analogy");
  const [input, setInput] = React.useState("");

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const convIdRef = React.useRef(activeConversationId);
  convIdRef.current = activeConversationId;
  const topicRef = React.useRef(activeTopic);
  topicRef.current = activeTopic;

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.conversations || []);
      }
    } catch {
      // Ignored if unauthenticated
    }
  }, []);

  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        conversationId: convIdRef.current,
        topicSlug: topicRef.current || undefined,
      }),
      fetch: async (inputRequest, init) => {
        const response = await fetch(inputRequest, init);
        const styleUsed = response.headers.get("x-style-used");
        if (styleUsed) {
          setActiveStyle(styleUsed);
        }
        const newConvId = response.headers.get("x-conversation-id");
        if (newConvId && !convIdRef.current) {
          setActiveConversationId(newConvId);
          loadConversations();
        }
        return response;
      },
    });
  }, [loadConversations]);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    error,
  } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages(json.messages);
        }
      }
    } catch (err) {
      console.error("[Chat] Failed to load conversation history:", err);
    }
  };

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStartNewSession = () => {
    setActiveConversationId(undefined);
    setMessages([]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          handleStartNewSession();
        }
      }
    } catch {
      // Ignored
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const quickPrompts = [
    "Could you give me an analogy for this?",
    "Can we break this down into first principles?",
    "Show me a concrete edge case with small numbers.",
    "Test my understanding with a Socratic question.",
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Sidebar - Conversation History */}
      <div
        className={`border-r border-border bg-card/40 backdrop-blur-md transition-all duration-300 flex flex-col ${
          sidebarOpen ? "w-64 sm:w-72" : "w-0 overflow-hidden border-none"
        }`}
      >
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <span className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">
            Sessions
          </span>
          <button
            onClick={handleStartNewSession}
            className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No previous sessions. Send a message to start!
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
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
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
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

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Chat Bar: Toggle Sidebar, Active Style Badge, Topic Selector */}
        <div className="flex items-center justify-between border-b border-border/60 bg-card/20 px-4 py-2.5 backdrop-blur-sm gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 border border-border bg-card/60 text-muted-foreground hover:text-foreground transition"
              title={sidebarOpen ? "Hide Sessions" : "Show Sessions"}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {/* Active Pedagogical Style Pill */}
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

          {/* Topic Focus Dropdown */}
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={activeTopic}
              onChange={(e) => setActiveTopic(e.target.value)}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Topics (Auto-detect)</option>
              {CURATED_TOPICS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-5 max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-lg text-foreground">Socratic Dialogue Tutor</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  I will not give you the answers directly. Instead, tell me what algorithm or data structure
                  you are thinking through, and I will help you reason through it step by step.
                </p>
              </div>

              {/* Suggested starter questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      sendMessage({ text: prompt });
                    }}
                    className="text-left rounded-xl border border-border/80 bg-card/40 p-3 text-xs text-muted-foreground hover:text-foreground hover:bg-card/90 transition shadow-sm"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isAssistant = m.role === "assistant";
              const textContent = getMessageText(m);
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-3xl ${
                    isAssistant ? "mr-auto" : "ml-auto justify-end"
                  }`}
                >
                  {isAssistant && (
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                      <Brain className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isAssistant
                        ? "border border-border/70 bg-card/80 text-foreground shadow-sm backdrop-blur-md whitespace-pre-wrap font-sans"
                        : "bg-primary text-primary-foreground shadow-md max-w-md whitespace-pre-wrap"
                    }`}
                  >
                    {textContent}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
                <Brain className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                <span>Formulating Socratic counter-question...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2 shadow-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  {error.message || "Failed to generate tutor response. Please try again."}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 border-t border-border bg-card/40 backdrop-blur-md">
          <form onSubmit={handleFormSubmit} className="mx-auto max-w-3xl flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Explain your approach, ask a question, or describe a bug..."
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-inner"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-muted-foreground text-sm">
          Loading Socratic dialogue session...
        </div>
      }
    >
      <ChatContent />
    </React.Suspense>
  );
}
