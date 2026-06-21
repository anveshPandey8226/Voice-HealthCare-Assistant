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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!room) return;

    const onSubscribed = (
      track: RemoteTrack,
      _pub: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      console.log("[TavusAvatar] track subscribed:", track.kind, "from:", participant.identity);
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        setHasVideo(true);
      }
      if (track.kind === Track.Kind.Audio && audioRef.current) {
        console.log("[TavusAvatar] attaching audio track from:", participant.identity);
        track.attach(audioRef.current);
      }
    };

    const onUnsubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Video) { track.detach(); setHasVideo(false); }
      if (track.kind === Track.Kind.Audio) { track.detach(); }
    };

    // Check already-subscribed tracks (Tavus may have joined before this effect runs)
    for (const participant of Array.from(room.remoteParticipants.values()) as RemoteParticipant[]) {
      for (const pub of Array.from(participant.trackPublications.values()) as RemoteTrackPublication[]) {
        if (pub.track?.kind === Track.Kind.Video && videoRef.current) {
          pub.track.attach(videoRef.current);
          setHasVideo(true);
        }
        if (pub.track?.kind === Track.Kind.Audio && audioRef.current) {
          pub.track.attach(audioRef.current);
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
      {/*
        Hidden audio element. Bypasses LiveKit's AudioManager (Web Audio API / AudioContext)
        which gets suspended when startAudio() is called outside user-gesture scope.
        Native <audio> srcObject playback works after any user page interaction.
      */}
      <audio ref={audioRef} autoPlay playsInline />
      {/* FallbackAvatar overlaid on top with z-10; removed once Tavus video arrives */}
      {(!active || !hasVideo) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          <FallbackAvatar state={active ? agentState : "idle"} />
        </div>
      )}
    </div>
  );
}
