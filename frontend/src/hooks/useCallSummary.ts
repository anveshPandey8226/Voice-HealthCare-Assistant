"use client";

import { useCallback, useState } from "react";
import { fetchSummary } from "@/lib/api";
import type { CallSummaryData } from "@/types";

export function useCallSummary() {
  const [summary, setSummary] = useState<CallSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    const MAX_ATTEMPTS = 20;
    const DELAY_MS = 500;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        const data = await fetchSummary(sessionId);
        setSummary(data);
        setLoading(false);
        return;
      } catch {
        if (i < MAX_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }
    }

    setError("Summary not available. Please try again.");
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    setSummary(null);
    setError(null);
    setLoading(false);
  }, []);

  return { summary, loading, error, load, reset };
}
