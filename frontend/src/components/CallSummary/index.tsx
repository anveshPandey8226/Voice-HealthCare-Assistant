"use client";

import { FileText, DollarSign, Clock, User, Loader2 } from "lucide-react";
import { AppointmentCard } from "./AppointmentCard";
import type { CallSummaryData } from "@/types";

interface Props {
  summary: CallSummaryData | null;
  loading: boolean;
  error: string | null;
}

export function CallSummary({ summary, loading, error }: Props) {
  if (!loading && !summary && !error) return null;

  return (
    <div className="bg-gray-900/70 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 text-white">
        <FileText className="w-5 h-5 text-brand-400" />
        <h2 className="text-lg font-bold">Call Summary</h2>
        <span className="ml-auto text-xs text-white/40">
          {summary?.timestamp ? new Date(summary.timestamp).toLocaleString() : ""}
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating summary...
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-4">
            {summary.user?.name && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <User className="w-4 h-4" />
                <span className="font-medium text-white">{summary.user.name}</span>
                {summary.user.phone && <span className="text-white/40">· {summary.user.phone}</span>}
              </div>
            )}

            <div>
              <p className="text-xs text-white/40 mb-1 font-medium uppercase tracking-wider">Summary</p>
              <p className="text-sm text-white/80 leading-relaxed">{summary.summary}</p>
            </div>

            {summary.preferences.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-1 font-medium uppercase tracking-wider">Preferences</p>
                <div className="flex flex-wrap gap-2">
                  {summary.preferences.map((p, i) => (
                    <span key={i} className="text-xs bg-brand-900/60 text-brand-300 px-2 py-1 rounded-full">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {summary.appointments.length > 0 && (
              <div>
                <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">Appointments</p>
                <div className="space-y-2">
                  {summary.appointments.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {summary.cost_breakdown?.total !== undefined && (
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                <DollarSign className="w-4 h-4 text-green-400" />
                Cost Breakdown
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: "STT (Deepgram)", value: summary.cost_breakdown.stt },
                  { label: "LLM (Gemini)", value: summary.cost_breakdown.llm },
                  { label: "TTS (Cartesia)", value: summary.cost_breakdown.tts },
                ].map(({ label, value }) =>
                  value !== undefined ? (
                    <div key={label} className="flex justify-between text-white/50">
                      <span>{label}</span>
                      <span>${value.toFixed(4)}</span>
                    </div>
                  ) : null
                )}
                <div className="border-t border-white/10 pt-1.5 flex justify-between text-white font-semibold">
                  <span>Total</span>
                  <span>${summary.cost_breakdown.total?.toFixed(4)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
