"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import type { ToolEvent } from "@/types";

export function useToolEvents(room: Room | null) {
  const [events, setEvents] = useState<ToolEvent[]>([]);

  useEffect(() => {
    if (!room) return;

    const handler = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const event = JSON.parse(text) as ToolEvent;
        if (event.type === "tool_event") {
          setEvents((prev) => [event, ...prev].slice(0, 50));
        }
      } catch {
        // ignore malformed messages
      }
    };

    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room]);

  return events;
}
