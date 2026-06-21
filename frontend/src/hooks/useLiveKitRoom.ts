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
    // startAudio() removed — it uses Web Audio API AudioContext which gets silently
    // suspended when called after async I/O (fetch + WebSocket break gesture scope).
    // TavusAvatar now explicitly attaches audio tracks to a native <audio> element,
    // which uses the browser's media pipeline and works after any user interaction.
    await room.localParticipant.setMicrophoneEnabled(true);
    setRoomName(room_name);
    return room;
  }, []);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);

  return { room: roomRef.current, connect, disconnect, connected, roomName };
}
