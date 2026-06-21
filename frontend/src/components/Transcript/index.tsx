"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import clsx from "clsx";

export interface TranscriptLine {
  speaker: "agent" | "user";
  text: string;
  timestamp: string;
}

interface Props {
  lines: TranscriptLine[];
  streamingLine?: string | null;
}

export function Transcript({ lines, streamingLine }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, streamingLine]);

  return (
    <div className="flex flex-col h-full bg-gray-900/50 rounded-2xl border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <MessageSquare className="w-4 h-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-white/80">Transcript</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {lines.length === 0 && !streamingLine ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm text-center gap-2">
            <MessageSquare className="w-8 h-8 opacity-30" />
            <p>Conversation transcript will appear here</p>
          </div>
        ) : (
          <>
            {lines.map((line, i) => (
              <div
                key={i}
                className={clsx("flex gap-3", line.speaker === "agent" ? "flex-row" : "flex-row-reverse")}
              >
                <div className={clsx(
                  "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                  line.speaker === "agent" ? "bg-brand-600 text-white" : "bg-gray-600 text-white"
                )}>
                  {line.speaker === "agent" ? "P" : "U"}
                </div>
                <div className={clsx(
                  "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                  line.speaker === "agent"
                    ? "bg-brand-900/60 text-brand-100 rounded-tl-sm"
                    : "bg-gray-700/60 text-gray-100 rounded-tr-sm"
                )}>
                  {line.text}
                </div>
              </div>
            ))}

            {/* Live streaming bubble — shown while agent is speaking */}
            {streamingLine && (
              <div className="flex gap-3 flex-row">
                <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-brand-600 text-white">
                  P
                </div>
                <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tl-sm text-sm bg-brand-900/60 text-brand-100">
                  {streamingLine}
                  {/* Blinking cursor */}
                  <span className="inline-block w-0.5 h-3.5 bg-brand-300/80 ml-0.5 align-middle animate-pulse" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
