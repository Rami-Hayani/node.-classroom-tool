"use client";

import { useCallback, useEffect, useState } from "react";
import { nextApi } from "@/lib/api";

interface Suggestion {
  conceptId: string;
  conceptLabel: string;
  suggestion: string;
}

interface InterventionPanelProps { lectureId: string | null; conceptIds: string[]; triggerVersion?: number; }

export default function InterventionPanel({
  lectureId,
  conceptIds,
  triggerVersion = 0,
}: InterventionPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
      if (!lectureId || conceptIds.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        const data = await nextApi.post(`/api/lectures/${lectureId}/interventions`, { conceptIds }) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions || []);
      } catch (err) { setError(err instanceof Error ? err.message : "Could not generate a recommendation"); }
      finally { setLoading(false); }
    }, [lectureId, conceptIds]);

  useEffect(() => { if (triggerVersion > 0) void fetchSuggestions(); }, [triggerVersion, fetchSuggestions]);

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 p-5">
      <h3 className="text-sm font-medium text-gray-800">Recommended next move</h3>
      <button onClick={() => void fetchSuggestions()} disabled={!lectureId || conceptIds.length === 0 || loading} className="mt-3 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40">{loading ? "Thinking..." : "Teaching Suggestion"}</button>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {suggestions.length === 0 && !loading && !error && <p className="mt-3 text-xs text-gray-400">Close a poll or select a struggling concept to get an actionable teaching move.</p>}
      <div className="mt-3 space-y-2">{suggestions.map((s) => <div key={`${s.conceptId}-${s.suggestion}`} className="p-3 rounded-xl bg-gray-50 border border-gray-100"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.conceptLabel}</p><p className="mt-1 text-sm text-gray-700 leading-relaxed">{s.suggestion}</p></div>)}</div>
    </div>
  );
}
