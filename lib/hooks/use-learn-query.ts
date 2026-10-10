"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardResponse, PlanResponse, InsightsResponse } from "@/lib/learner/overview";
import { getQueryClient } from "@/components/query-provider";

export interface OverviewData {
  dashboard: DashboardResponse;
  plan: PlanResponse;
  insights: InsightsResponse;
}

export interface ConversationItem {
  id: string;
  title: string;
  topic_id: string | null;
  updated_at: string;
}

export interface ConversationDetail {
  conversation: ConversationItem;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    style?: string;
    created_at: string;
  }>;
}

/* =========================================================================
   Fetcher functions
   ========================================================================= */

export async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch("/api/overview");
  if (!res.ok) {
    throw new Error(`Failed to fetch overview: ${res.status}`);
  }
  return res.json();
}

export async function fetchConversations(): Promise<ConversationItem[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) {
    throw new Error(`Failed to fetch conversations: ${res.status}`);
  }
  const json = await res.json();
  return json.conversations || [];
}

export async function fetchConversationDetail(
  conversationId: string
): Promise<ConversationDetail> {
  const res = await fetch(`/api/conversations/${conversationId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation ${conversationId}: ${res.status}`);
  }
  return res.json();
}

export async function fetchProfileInsights(): Promise<InsightsResponse> {
  const res = await fetch("/api/profile/insights");
  if (!res.ok) {
    throw new Error(`Failed to fetch profile insights: ${res.status}`);
  }
  return res.json();
}

/* =========================================================================
   Query Hooks
   ========================================================================= */

export function useOverviewQuery() {
  return useQuery<OverviewData>({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });
}

export function useConversationsQuery() {
  return useQuery<ConversationItem[]>({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });
}

export function useConversationDetailQuery(conversationId: string | null | undefined) {
  return useQuery<ConversationDetail>({
    queryKey: ["conversation", conversationId],
    queryFn: () => fetchConversationDetail(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useProfileInsightsQuery() {
  return useQuery<InsightsResponse>({
    queryKey: ["profile-insights"],
    queryFn: fetchProfileInsights,
  });
}

/* =========================================================================
   Prefetch Utilities
   ========================================================================= */

export async function prefetchOverviewData() {
  const queryClient = getQueryClient();
  return queryClient.prefetchQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });
}

export async function prefetchConversationsData() {
  const queryClient = getQueryClient();
  return queryClient.prefetchQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });
}

export async function prefetchConversationMessages(conversationId: string) {
  const queryClient = getQueryClient();
  return queryClient.prefetchQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => fetchConversationDetail(conversationId),
  });
}

export async function prefetchTabData(tabHref: string) {
  const queryClient = getQueryClient();
  if (tabHref === "/dashboard" || tabHref === "/progress" || tabHref.startsWith("/dashboard#")) {
    await queryClient.prefetchQuery({
      queryKey: ["overview"],
      queryFn: fetchOverview,
    });
  } else if (tabHref === "/chat" || tabHref.startsWith("/chat")) {
    await queryClient.prefetchQuery({
      queryKey: ["conversations"],
      queryFn: fetchConversations,
    });
  } else if (tabHref === "/settings" || tabHref.startsWith("/settings")) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["profile-insights"],
        queryFn: fetchProfileInsights,
      }),
      queryClient.prefetchQuery({
        queryKey: ["overview"],
        queryFn: fetchOverview,
      }),
    ]);
  }
}
