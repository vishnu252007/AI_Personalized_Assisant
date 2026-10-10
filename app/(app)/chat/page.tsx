"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useConversationsQuery, useConversationDetailQuery } from "@/lib/hooks/use-learn-query";
import { useQueryClient } from "@tanstack/react-query";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatTopbar } from "@/components/chat/chat-topbar";
import { ChatThread } from "@/components/chat/chat-thread";
import { ChatInput } from "@/components/chat/chat-input";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const conversationIdFromUrl = searchParams.get("c") || undefined;
  const [activeTopic, setActiveTopic] = React.useState(searchParams.get("topic") || "");
  const [activeStyle, setActiveStyle] = React.useState<string>("analogy");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [input, setInput] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);

  const { data: conversations = [], refetch: refetchConversations } = useConversationsQuery();
  const { data: conversationDetail } = useConversationDetailQuery(conversationIdFromUrl);

  const convIdRef = React.useRef(conversationIdFromUrl);
  convIdRef.current = conversationIdFromUrl;

  const transport = React.useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ conversationId: convIdRef.current, topicSlug: activeTopic || undefined }),
      fetch: async (inputRequest, init) => {
        const response = await fetch(inputRequest, init);
        const styleUsed = response.headers.get("x-style-used");
        if (styleUsed) setActiveStyle(styleUsed);
        const newConvId = response.headers.get("x-conversation-id");
        if (newConvId && convIdRef.current !== newConvId) {
          router.replace(`/chat?c=${newConvId}`);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
        return response;
      },
    });
  }, [activeTopic, router, queryClient]);

  const { messages, sendMessage, status, setMessages, error, stop } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (conversationDetail?.messages && conversationDetail.messages.length > 0) {
      setMessages(conversationDetail.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text", text: m.content }],
      })));
    } else if (!conversationIdFromUrl) {
      setMessages([]);
    }
  }, [conversationDetail, conversationIdFromUrl, setMessages]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations?id=${id}`, { method: "DELETE" });
      refetchConversations();
      if (conversationIdFromUrl === id) { router.replace("/chat"); setMessages([]); }
    } catch {}
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      <ChatSidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={conversationIdFromUrl}
        onSelect={(id) => router.replace(`/chat?c=${id}`)}
        onNew={() => { router.replace("/chat"); setMessages([]); }}
        onDelete={handleDeleteConversation}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatTopbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeStyle={activeStyle}
          conversationId={conversationIdFromUrl}
          activeTopic={activeTopic}
          onTopicChange={setActiveTopic}
        />
        <ChatThread
          messages={messages}
          isLoading={isLoading}
          error={error}
          stop={stop}
          onSendMessage={(text) => sendMessage({ text })}
          conversationId={conversationIdFromUrl}
          activeTopic={activeTopic}
          messagesEndRef={messagesEndRef}
        />
        <ChatInput
          input={input}
          onChange={setInput}
          onSubmit={handleFormSubmit}
          isLoading={isLoading}
          isListening={isListening}
          onToggleVoice={() => setIsListening(!isListening)}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center text-xs text-muted-foreground">Loading chat...</div>}>
      <ChatContent />
    </React.Suspense>
  );
}
