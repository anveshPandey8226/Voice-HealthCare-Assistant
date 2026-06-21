"use client";

import { useEffect, useState } from "react";
import { Room, RoomEvent, Participant } from "livekit-client";
import type { AgentState } from "@/types";

export function useAgentState(room: Room | null): AgentState {
  const [state, setState] = useState<AgentState>("idle");

  useEffect(() => {
    if (!room) {
      setState("idle");
      return;
    }

    setState("connecting");

    // Stay in "connecting" until the Tavus avatar specifically joins.
    // Audio doesn't start until Tavus publishes its video track (~6-7 s).
    const onParticipantConnected = (participant: Participant) => {
      if ((participant as { identity?: string }).identity === "tavus-avatar-agent") {
        setState("listening");
      }
    };
    const onParticipantDisconnected = () => setState("idle");

    const onActiveSpeakersChanged = (speakers: Participant[]) => {
      setState(prev => {
        if (prev === "idle" || prev === "connecting") return prev;
        return speakers.some(p => !p.isLocal) ? "speaking" : "listening";
      });
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);
    };
  }, [room]);

  return state;
}
