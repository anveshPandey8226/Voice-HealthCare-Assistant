"use client";

import clsx from "clsx";
import type { AgentState } from "@/types";

interface Props {
  state: AgentState;
}

export function FallbackAvatar({ state }: Props) {
  const speaking = state === "speaking";
  const listening = state === "listening";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative flex items-center justify-center">
        {speaking && (
          <>
            <span className="absolute inline-flex h-48 w-48 rounded-full bg-brand-500 opacity-20 animate-ping" />
            <span className="absolute inline-flex h-40 w-40 rounded-full bg-brand-500 opacity-10 animate-ping [animation-delay:200ms]" />
          </>
        )}
        <div
          className={clsx(
            "relative z-10 flex items-center justify-center w-36 h-36 rounded-full text-6xl select-none shadow-xl transition-all duration-300",
            speaking ? "bg-brand-600 scale-110" : "bg-brand-500 scale-100",
            listening ? "ring-4 ring-green-400 ring-offset-2" : ""
          )}
        >
          🏥
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-white font-semibold text-lg">Mike</p>
        <p className="text-white/60 text-sm">CareAI Health Assistant</p>
        <div className={clsx("mt-2 px-3 py-1 rounded-full text-xs font-medium", {
          "bg-gray-700 text-gray-300": state === "idle" || state === "connecting",
          "bg-green-800 text-green-200": state === "listening",
          "bg-yellow-800 text-yellow-200": state === "thinking",
          "bg-brand-700 text-brand-200": state === "speaking",
        })}>
          {state === "idle" && "Ready"}
          {state === "connecting" && "Connecting..."}
          {state === "listening" && "Listening..."}
          {state === "thinking" && "Thinking..."}
          {state === "speaking" && "Speaking..."}
        </div>
      </div>

      {speaking && (
        <div className="flex gap-1 items-end h-8">
          {[3, 5, 8, 6, 4, 7, 5, 3].map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-brand-400 rounded-full animate-pulse-slow"
              style={{
                height: `${h * 4}px`,
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
