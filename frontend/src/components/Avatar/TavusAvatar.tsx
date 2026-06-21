"use client";
import { useEffect, useRef, useState } from "react";
import type { RemoteTrack, RemoteTrackPublication, RemoteParticipant, Room } from "livekit-client";
import { RoomEvent, Track } from "livekit-client";
import { FallbackAvatar } from "./FallbackAvatar";
import type { AgentState } from "@/types";

interface Props {
  active: boolean;
  agentState: AgentState;
  room: Room | null;
}

export function TavusAvatar({ active, agentState, room }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!room) return;

    const onSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      _participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        setHasVideo(true);
      }
    };

    const onUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) {
        track.detach();
        setHasVideo(false);
      }
    };

    // Check already-published tracks — videoRef.current is valid here because
    // the <video> element is always mounted (not conditionally removed from the DOM).
    for (const participant of Array.from(room.remoteParticipants.values()) as RemoteParticipant[]) {
      for (const pub of Array.from(participant.trackPublications.values()) as RemoteTrackPublication[]) {
        if (pub.track?.kind === Track.Kind.Video && videoRef.current) {
          pub.track.attach(videoRef.current);
          setHasVideo(true);
        }
      }
    }

    room.on(RoomEvent.TrackSubscribed, onSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, onSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onUnsubscribed);
    };
  }, [room]);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden bg-gray-900"
      style={{ minHeight: 380 }}
    >
      {/* Always display:block so adaptiveStream's IntersectionObserver sees a visible element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* FallbackAvatar overlaid on top with z-10; removed once Tavus video arrives */}
      {(!active || !hasVideo) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          <FallbackAvatar state={active ? agentState : "idle"} />
        </div>
      )}
    </div>
  );
}
