"use client";

import { Send, Mic, MicOff } from "lucide-react";

interface ChatInputProps {
  input: string;
  onChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  isListening: boolean;
  onToggleVoice: () => void;
}

export function ChatInput({
  input,
  onChange,
  onSubmit,
  isLoading,
  isListening,
  onToggleVoice,
}: ChatInputProps) {
  return (
    <div className="p-4 border-t border-border bg-card/40 backdrop-blur-md">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl flex gap-2 items-center">
        <button
          type="button"
          onClick={onToggleVoice}
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            isListening
              ? "Listening... Speak your question"
              : "Explain your approach, ask a question, or describe a bug..."
          }
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
  );
}
