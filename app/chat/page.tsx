"use client";

import * as React from "react";
import Link from "next/link";
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
  HelpCircle,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  Square,
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

interface ParsedMessage {
  mainText: string;
  checkQuestion: string | null;
  suggestions: string[];
}

function parseAssistantMessage(text: string): ParsedMessage {
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

/**
 * Renders text with formatted code blocks and copy buttons
 */
function FormattedMessageContent({ content }: { content: string }) {
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

function CodeSnippetBlock({ code, language }: { code: string; language: string }) {
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

/**
 * Interactive Concept Check Card
 */
function ConceptCheckCard({
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

/**
 * Feedback Bar for Assistant Explanations
 */
function FeedbackBar({
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
      <span className="text-border">|</span>
      <button
        onClick={() => sendFeedback("too_easy")}
        className="px-1.5 py-0.5 rounded border border-border hover:bg-accent transition text-[10px]"
      >
        Too easy
      </button>
      <button
        onClick={() => sendFeedback("too_hard")}
        className="px-1.5 py-0.5 rounded border border-border hover:bg-accent transition text-[10px]"
      >
        Too hard
      </button>
      <button
        onClick={() => sendFeedback("unclear")}
        className="px-1.5 py-0.5 rounded border border-border hover:bg-accent transition text-[10px]"
      >
        Unclear
      </button>
    </div>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const initialTopicSlug = searchParams.get("topic") || "";
  const initialPrompt = searchParams.get("prompt") || "";

  const [activeTopic, setActiveTopic] = React.useState<string>(initialTopicSlug);
  const [activeConversationId, setActiveConversationId] = React.useState<string | undefined>(undefined);
  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeStyle, setActiveStyle] = React.useState<string>("analogy");
  const [input, setInput] = React.useState(initialPrompt);

  React.useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
    }
  }, [initialPrompt]);

  // Speech Recognition & Text to Speech state
  const [isListening, setIsListening] = React.useState(false);
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);

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
    stop,
  } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Voice Input (Web Speech Recognition API)
  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Text to Speech (Web Speech Synthesis API)
  const toggleSpeak = (id: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 300));
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

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

  const handleSuggestionClick = async (suggestion: string) => {
    if (isLoading) return;
    await sendMessage({ text: suggestion });
  };

  const quickPrompts = [
    "Could you give me an analogy for how hash maps resolve collisions?",
    "Explain binary search using first principles.",
    "Walk me through a concrete edge case for two pointers with duplicates.",
    "What is the difference between BFS and DFS with an example?",
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
        {/* Top Chat Bar: Toggle Sidebar, Active Style Badge, Quiz me on this, Topic Selector */}
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

          <div className="flex items-center gap-2">
            {/* "Quiz me on this" Button */}
            {activeConversationId && (
              <Link
                href={`/quiz?mode=chat&conversationId=${activeConversationId}${
                  activeTopic ? `&slug=${activeTopic}` : ""
                }`}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Quiz me on this</span>
              </Link>
            )}

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
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-5 max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-lg text-foreground">Adaptive Tutor</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Ask any technical concept or question. I explain directly first with concrete examples,
                  then check your understanding with focused questions.
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
              const rawText = getMessageText(m);

              if (!isAssistant) {
                return (
                  <div key={m.id} className="flex gap-3 max-w-3xl ml-auto justify-end">
                    <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-primary text-primary-foreground shadow-md max-w-md whitespace-pre-wrap">
                      {rawText}
                    </div>
                  </div>
                );
              }

              const { mainText, checkQuestion, suggestions } = parseAssistantMessage(rawText);

              return (
                <div key={m.id} className="flex gap-3 max-w-3xl mr-auto">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                    <Brain className="h-4 w-4" />
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-card/80 text-foreground p-4 text-sm leading-relaxed shadow-sm backdrop-blur-md w-full space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-[11px] text-primary">Tutor Response</span>
                      <button
                        onClick={() => toggleSpeak(m.id, mainText)}
                        className="flex items-center gap-1 hover:text-foreground transition text-[11px]"
                        title={speakingId === m.id ? "Stop voice" : "Read aloud"}
                      >
                        {speakingId === m.id ? (
                          <>
                            <VolumeX className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5" />
                            <span>Read aloud</span>
                          </>
                        )}
                      </button>
                    </div>

                    <FormattedMessageContent content={mainText} />

                    {/* Styled Concept Check Card */}
                    {checkQuestion && (
                      <ConceptCheckCard
                        question={checkQuestion}
                        conversationId={activeConversationId}
                        conceptSlug={activeTopic || undefined}
                      />
                    )}

                    {/* Clickable Next Chips */}
                    {suggestions.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">
                          Follow-up Topics:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.map((sug, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSuggestionClick(sug)}
                              className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition flex items-center gap-1"
                            >
                              <span>{sug}</span>
                              <span className="opacity-60">→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback Bar */}
                    <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <FeedbackBar
                        conversationId={activeConversationId}
                        conceptSlug={activeTopic || undefined}
                      />

                      {/* Inline Quiz Prompt */}
                      {activeConversationId && (
                        <Link
                          href={`/quiz?mode=chat&conversationId=${activeConversationId}${
                            activeTopic ? `&slug=${activeTopic}` : ""
                          }`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Take 3-question quiz on this →</span>
                        </Link>
                      )}
                    </div>
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
              <div className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground flex items-center gap-3">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                <span>Formulating explanation and concept check...</span>
                <button
                  onClick={() => stop()}
                  className="flex items-center gap-1 rounded bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-destructive/20 transition ml-2"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>Stop</span>
                </button>
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

        {/* Chat Input Bar with Voice Input */}
        <div className="p-4 border-t border-border bg-card/40 backdrop-blur-md">
          <form onSubmit={handleFormSubmit} className="mx-auto max-w-3xl flex gap-2 items-center">
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              className={`rounded-xl p-3 border transition ${
                isListening
                  ? "border-rose-500 bg-rose-500/20 text-rose-500 animate-pulse"
                  : "border-border bg-card/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening... Speak your question" : "Explain your approach, ask a question, or describe a bug..."}
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
          Loading adaptive tutor session...
        </div>
      }
    >
      <ChatContent />
    </React.Suspense>
  );
}
