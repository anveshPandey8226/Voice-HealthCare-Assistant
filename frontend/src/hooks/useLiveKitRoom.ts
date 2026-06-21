"use client";

import { useCallback, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { fetchToken } from "@/lib/api";

export function useLiveKitRoom() {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);

  const connect = useCallback(async () => {
    const { token, room_name, livekit_url } = await fetchToken();
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => setConnected(true));
    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      roomRef.current = null;
    });

    await room.connect(livekit_url, token);
    await room.startAudio();                                // unlock remote audio playback
    await room.localParticipant.setMicrophoneEnabled(true);
    setRoomName(room_name);
    return room;
  }, []);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);

  return { room: roomRef.current, connect, disconnect, connected, roomName };
}
