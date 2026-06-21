"use client";

import { useCallback, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { useToolEvents } from "@/hooks/useToolEvents";
import { useAgentState } from "@/hooks/useAgentState";
import { useCallSummary } from "@/hooks/useCallSummary";
import { TavusAvatar } from "@/components/Avatar/TavusAvatar";
import { ToolCallFeed } from "@/components/ToolCallFeed";
import { Transcript } from "@/components/Transcript";
import type { TranscriptLine } from "@/components/Transcript";
import { CallSummary } from "@/components/CallSummary";
import { ControlBar } from "./ControlBar";
import type { ToolEvent } from "@/types";

export function CallInterface() {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const roomNameRef = useRef<string | null>(null);

  const { connect, disconnect } = useLiveKitRoom();
  const toolEvents = useToolEvents(room);
  const agentState = useAgentState(room);
  const { summary, loading: summaryLoading, error: summaryError, load: loadSummary, reset: resetSummary } = useCallSummary();

  const handleToolEvent = useCallback((event: ToolEvent) => {
    if (event.tool === "end_conversation" && event.status === "success") {
      const data = event.data as { session_id?: string } | undefined;
      const sid = data?.session_id ?? roomNameRef.current;
      if (sid) loadSummary(sid);
    }
  }, [loadSummary]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    resetSummary();
    setTranscript([]);
    try {
      const r = await connect();
      setRoom(r);
      roomNameRef.current = (r as Room & { name: string }).name ?? null;

      r.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const event = JSON.parse(new TextDecoder().decode(payload));
          if (event.type === "tool_event") handleToolEvent(event);
          if (event.type === "transcript" && event.text) {
            setTranscript(prev => [
              ...prev,
              {
                speaker: event.speaker as "agent" | "user",
                text: event.text as string,
                timestamp: event.timestamp as string,
              },
            ]);
          }
        } catch { /* ignore */ }
      });
    } finally {
      setLoading(false);
    }
  }, [connect, handleToolEvent, resetSummary]);

  const handleEnd = useCallback(async () => {
    await disconnect();
    setRoom(null);
  }, [disconnect]);

  const handleToggleMute = useCallback(async () => {
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  }, [room, muted]);

  const connected = !!room;

  return (
    <div className="flex flex-col gap-4 min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_280px] gap-4 flex-1" style={{ minHeight: 480 }}>
        <div className="bg-gray-900/60 rounded-2xl border border-white/10 p-4 min-h-[400px]">
          <TavusAvatar active={connected} agentState={agentState} room={room} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 min-h-0" style={{ height: 380 }}>
            <Transcript lines={transcript} />
          </div>
          <ControlBar
            connected={connected}
            muted={muted}
            onStart={handleStart}
            onEnd={handleEnd}
            onToggleMute={handleToggleMute}
            loading={loading}
          />
        </div>

        <div style={{ height: 480 }}>
          <ToolCallFeed events={toolEvents} />
        </div>
      </div>

      <CallSummary summary={summary} loading={summaryLoading} error={summaryError} />
    </div>
  );
}
