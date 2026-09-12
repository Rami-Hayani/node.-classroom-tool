"use client";

import { useEffect, useState } from "react";
import { COLOR_HEX } from "@/lib/colors";
import { nextApi } from "@/lib/api";
import { useSocketEvent } from "@/lib/socket";
import { formatConceptLabel } from "@/lib/concepts";

interface PollState {
  pollId: string | null;
  question: string | null;
  conceptLabel: string | null;
  status: "idle" | "preview" | "active" | "closed";
  results: { green: number; yellow: number; red: number } | null;
  totalResponses: number;
}

interface PollControlsProps {
  lectureId: string | null;
  concepts: { id: string; label: string }[];
  activeConceptId: string | null;
  connectedStudentCount?: number;
  followUpRequest?: { conceptId: string; nonce: number } | null;
  onPollActivated?: (poll: { pollId: string; conceptId: string; conceptLabel: string }) => void;
  onPollClosed?: (poll: { pollId: string; conceptId: string; conceptLabel: string; misconceptionSummary?: string }) => void;
}

export default function PollControls({ lectureId, concepts, activeConceptId, connectedStudentCount = 0, followUpRequest, onPollActivated, onPollClosed }: PollControlsProps) {
  const [poll, setPoll] = useState<PollState>({
    pollId: null,
    question: null,
    conceptLabel: null,
    status: "idle",
    results: null,
    totalResponses: 0,
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState("");

  useEffect(() => {
    if (activeConceptId && concepts.some((c) => c.id === activeConceptId)) {
      setSelectedConceptId(activeConceptId);
    } else if (!selectedConceptId && concepts.length > 0) {
      setSelectedConceptId(concepts[0].id);
    }
  }, [activeConceptId, concepts, selectedConceptId]);

  useEffect(() => {
    if (!followUpRequest || !lectureId || poll.status !== "idle") return;
    setSelectedConceptId(followUpRequest.conceptId);
    void generateForConcept(followUpRequest.conceptId);
    // The nonce intentionally makes repeated follow-ups possible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpRequest?.nonce]);

  useSocketEvent<{ pollId: string }>("poll:response-received", (data) => {
    setPoll((current) => current.pollId === data.pollId
      ? { ...current, totalResponses: current.totalResponses + 1 }
      : current);
  });

  async function generateForConcept(conceptId: string) {
    if (!lectureId) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/poll/generate`, {
        conceptId: conceptId || undefined,
      });
      setPoll({
        pollId: data.pollId,
        question: data.question,
        conceptLabel: data.conceptLabel,
        status: "preview",
        results: null,
        totalResponses: 0,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate question";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    await generateForConcept(selectedConceptId);
  }

  async function handleActivate() {
    if (!lectureId || !poll.pollId) return;
    try {
      await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/activate`, {});
      setPoll((p) => ({ ...p, status: "active" }));
      if (poll.conceptLabel) {
        onPollActivated?.({ pollId: poll.pollId, conceptId: selectedConceptId, conceptLabel: poll.conceptLabel });
      }
    } catch (err) {
      console.error("Failed to activate poll:", err);
    }
  }

  async function handleClose() {
    if (!lectureId || !poll.pollId) return;
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/close`, {});
      setPoll((p) => ({
        ...p,
        status: "closed",
        results: data.distribution ? {
          green: data.distribution.green || 0,
          yellow: data.distribution.yellow || 0,
          red: data.distribution.red || 0,
        } : null,
        totalResponses: data.totalResponses || 0,
      }));
      if (poll.conceptLabel) {
        onPollClosed?.({ pollId: poll.pollId, conceptId: selectedConceptId, conceptLabel: poll.conceptLabel, misconceptionSummary: data.misconceptionSummary });
      }
    } catch (err) {
      console.error("Failed to close poll:", err);
    }
  }

  function handleReset() {
    setPoll({
      pollId: null,
      question: null,
      conceptLabel: null,
      status: "idle",
      results: null,
      totalResponses: 0,
    });
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 p-5">
      <h3 className="text-sm font-medium text-gray-800 tracking-tight mb-3">
        Poll Controls
      </h3>
      <div className="space-y-3">
        {poll.status === "idle" && (
          <>
            <label className="block text-xs text-gray-500">
              Concept
              <select
                value={selectedConceptId}
                onChange={(event) => setSelectedConceptId(event.target.value)}
                disabled={!lectureId || concepts.length === 0 || generating}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                {concepts.length === 0 && <option value="">No course concepts found</option>}
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>{formatConceptLabel(concept.label)}</option>
                ))}
              </select>
            </label>
            <button
              onClick={handleGenerate}
              disabled={!lectureId || !selectedConceptId || generating}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? "Generating..." : "Generate Question"}
            </button>
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
          </>
        )}

        {poll.status === "preview" && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{poll.conceptLabel}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{poll.question}</p>
            <div className="flex gap-2">
              <button
                onClick={handleActivate}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200"
              >
                Send to Students
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {poll.status === "active" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{poll.question}</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-500">Responses: {poll.totalResponses} / {connectedStudentCount}</span>
            </div>
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all duration-200"
            >
              Close Poll
            </button>
          </div>
        )}

        {poll.status === "closed" && poll.results && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Results ({poll.totalResponses} responses)
            </p>
            <div className="flex h-5 w-full overflow-hidden rounded-lg bg-gray-100">
              {(["green", "yellow", "red"] as const).map((color) => {
                const total = poll.results!.green + poll.results!.yellow + poll.results!.red;
                const pct = total > 0 ? (poll.results![color] / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={color}
                    className="h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color === "yellow" ? "#f59e0b" : COLOR_HEX[color] }}
                  />
                );
              })}
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
            >
              New Question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
