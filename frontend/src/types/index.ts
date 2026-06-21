export type ToolStatus = "calling" | "success" | "error";

export interface ToolEvent {
  type: "tool_event";
  tool: string;
  status: ToolStatus;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface Appointment {
  id: number;
  user_phone: string;
  date: string;
  time: string;
  doctor: string;
  notes?: string | null;
  status: "confirmed" | "cancelled" | "modified";
}

export interface CallSummaryData {
  session_id: string;
  user: { name?: string | null; phone?: string | null };
  summary: string;
  appointments: Appointment[];
  intent: string;
  preferences: string[];
  cost_breakdown: {
    stt?: number;
    llm?: number;
    tts?: number;
    total?: number;
  };
  timestamp: string;
}

export type AgentState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface TokenResponse {
  token: string;
  room_name: string;
  identity: string;
  livekit_url: string;
}
