import type { CallSummaryData, TokenResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchToken(roomName?: string, identity?: string): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_name: roomName, identity }),
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSummary(sessionId: string): Promise<CallSummaryData> {
  const res = await fetch(`${API_URL}/api/summary/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Summary not ready: ${res.status}`);
  return res.json();
}

export async function createTavusConversation(): Promise<{ conversation_id: string; conversation_url: string }> {
  const res = await fetch(`${API_URL}/api/tavus/conversation`, { method: "POST" });
  if (!res.ok) throw new Error(`Tavus failed: ${res.status}`);
  return res.json();
}
