"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import { Brain, Sparkles, Square, AlertCircle, Volume2, VolumeX } from "lucide-react";
import {
  getMessageText,
  parseAssistantMessage,
} from "./chat-helpers";
import {
  FormattedMessageContent,
  ConceptCheckCard,
  FeedbackBar,
} from "./chat-bubble";

interface ChatThreadProps {
  messages: UIMessage[];
  isLoading: boolean;
  error?: Error;
  stop: () => void;
  onSendMessage: (text: string) => void;
  conversationId?: string;
  activeTopic?: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatThread({
  messages,
  isLoading,
  error,
  stop,
  onSendMessage,
  conversationId,
  activeTopic,
  messagesEndRef,
}: ChatThreadProps) {
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);

  const toggleSpeak = (id: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 300));
    utterance.onend = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-4 max-w-lg mx-auto">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Brain className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg text-foreground">Adaptive Socratic Tutor</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask any technical question. I will provide direct intuitive explanations, code traces, and verify your comprehension with targeted checks.
          </p>
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
                  >
                    {speakingId === m.id ? (
                      <><VolumeX className="h-3.5 w-3.5 text-amber-500 animate-pulse" /><span>Stop</span></>
                    ) : (
                      <><Volume2 className="h-3.5 w-3.5" /><span>Read aloud</span></>
                    )}
                  </button>
                </div>

                <FormattedMessageContent content={mainText} />
                {checkQuestion && (
                  <ConceptCheckCard
                    question={checkQuestion}
                    conversationId={conversationId}
                    conceptSlug={activeTopic}
                  />
                )}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSendMessage(sug)}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition"
                      >
                        {sug} &rarr;
                      </button>
                    ))}
                  </div>
                )}
                <FeedbackBar conversationId={conversationId} conceptSlug={activeTopic} />
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
            <span>Formulating explanation...</span>
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
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error.message || "Failed to generate tutor response."}</span>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
