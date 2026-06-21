"use client";

import { Zap } from "lucide-react";
import { ToolCallBadge } from "./ToolCallBadge";
import type { ToolEvent } from "@/types";

interface Props {
  events: ToolEvent[];
}

export function ToolCallFeed({ events }: Props) {
  return (
    <div className="flex flex-col h-full bg-gray-900/50 rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-white/80">Agent Actions</h3>
        {events.length > 0 && (
          <span className="ml-auto text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
            {events.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm text-center gap-2">
            <Zap className="w-8 h-8 opacity-30" />
            <p>Tool calls will appear here during the conversation</p>
          </div>
        ) : (
          events.map((event, i) => <ToolCallBadge key={`${event.tool}-${event.timestamp}-${i}`} event={event} />)
        )}
      </div>
    </div>
  );
}
