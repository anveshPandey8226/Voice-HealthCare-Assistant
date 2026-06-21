"use client";

import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import clsx from "clsx";

interface Props {
  connected: boolean;
  muted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  loading: boolean;
}

export function ControlBar({ connected, muted, onStart, onEnd, onToggleMute, loading }: Props) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {!connected ? (
        <button
          onClick={onStart}
          disabled={loading}
          className={clsx(
            "flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all",
            loading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/40 hover:scale-105 active:scale-95"
          )}
        >
          <Phone className="w-5 h-5" />
          {loading ? "Connecting..." : "Start Call"}
        </button>
      ) : (
        <>
          <button
            onClick={onToggleMute}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 rounded-full font-medium transition-all",
              muted
                ? "bg-red-700 text-white hover:bg-red-600"
                : "bg-gray-700 text-white hover:bg-gray-600"
            )}
          >
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {muted ? "Unmute" : "Mute"}
          </button>

          <button
            onClick={onEnd}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/40 transition-all hover:scale-105 active:scale-95"
          >
            <PhoneOff className="w-5 h-5" />
            End Call
          </button>
        </>
      )}
    </div>
  );
}
