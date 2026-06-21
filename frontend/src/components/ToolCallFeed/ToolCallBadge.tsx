"use client";

import clsx from "clsx";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { ToolEvent } from "@/types";

const TOOL_LABELS: Record<string, string> = {
  identify_user: "Identify Patient",
  fetch_slots: "Fetch Slots",
  book_appointment: "Book Appointment",
  retrieve_appointments: "Get Appointments",
  cancel_appointment: "Cancel Appointment",
  modify_appointment: "Modify Appointment",
  end_conversation: "End Conversation",
};

interface Props {
  event: ToolEvent;
}

export function ToolCallBadge({ event }: Props) {
  const label = TOOL_LABELS[event.tool] ?? event.tool;

  return (
    <div
      className={clsx(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm border transition-all",
        {
          "bg-yellow-950/50 border-yellow-700/40 text-yellow-200": event.status === "calling",
          "bg-green-950/50 border-green-700/40 text-green-200": event.status === "success",
          "bg-red-950/50 border-red-700/40 text-red-200": event.status === "error",
        }
      )}
    >
      <div className="mt-0.5 shrink-0">
        {event.status === "calling" && <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />}
        {event.status === "success" && <CheckCircle className="w-4 h-4 text-green-400" />}
        {event.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-none mb-0.5">{label}</p>
        <p className="text-xs opacity-70 truncate">{event.message}</p>
      </div>
    </div>
  );
}
