"use client";

import { useEffect, useState } from "react";
import { COLOR_HEX } from "@/lib/colors";
import { flaskApi, nextApi } from "@/lib/api";
import { useSocketEvent } from "@/lib/socket";
import { formatConceptLabel } from "@/lib/concepts";

interface PollState {
  pollId: string | null;
  question: string | null;
  conceptLabel: string | null;
  status: "idle" | "preview" | "active" | "closed";
  results: { green: number; yellow: number; orange: number; red: number } | null;
  totalResponses: number;
}
interface PollResponse { id: string; student_id: string; student_name?: string; answer: string; evaluation?: { score?: number; eval_result?: string; feedback?: string } }

interface PollControlsProps {
  lectureId: string | null;
  concepts: { id: string; label: string }[];
  activeConceptId: string | null;
  selectedNodeId?: string | null;
  connectedStudentCount?: number;
  followUpRequest?: { conceptId: string; nonce: number } | null;
  onPollActivated?: (poll: { pollId: string; conceptId: string; conceptLabel: string }) => void;
  onPollClosed?: (poll: { pollId: string; conceptId: string; conceptLabel: string; misconceptionSummary?: string }) => void;
}

export default function PollControls({ lectureId, concepts, activeConceptId, selectedNodeId, connectedStudentCount = 0, followUpRequest, onPollActivated, onPollClosed }: PollControlsProps) {
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
  const [responses, setResponses] = useState<PollResponse[]>([]);
  const [responseRefresh, setResponseRefresh] = useState(0);
  const [showResponses, setShowResponses] = useState(true);
  const [savingGrade, setSavingGrade] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNodeId && concepts.some((c) => c.id === selectedNodeId)) {
      setSelectedConceptId(selectedNodeId);
    } else if (activeConceptId && concepts.some((c) => c.id === activeConceptId)) {
      setSelectedConceptId(activeConceptId);
    } else if (!selectedConceptId && concepts.length > 0) {
      setSelectedConceptId(concepts[0].id);
    }
  }, [activeConceptId, selectedNodeId, concepts, selectedConceptId]);

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
    setResponseRefresh((value) => value + 1);
  });

  useEffect(() => {
    if (!poll.pollId || (poll.status !== "active" && poll.status !== "closed")) {
      setResponses([]);
      return;
    }
    flaskApi.get(`/api/polls/${poll.pollId}/responses`)
      .then((data) => setResponses((data as PollResponse[]) || []))
      .catch(() => setResponses([]));
  }, [poll.pollId, poll.status, responseRefresh]);

  async function saveGrade(response: PollResponse, value: string) {
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 100) return;
    setSavingGrade(response.id);
    try {
      await flaskApi.put(`/api/polls/${poll.pollId}/responses/${response.id}/grade`, { score });
      setResponses((current) => current.map((item) => item.id === response.id ? { ...item, evaluation: { ...(item.evaluation || {}), score } } : item));
    } finally { setSavingGrade(null); }
  }

  function responseList() {
    if (!responses.length) return <p className="mt-2 text-xs italic text-gray-400">No responses yet.</p>;
    if (!showResponses) return null;
    return <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">{responses.map((response) => <div key={response.id} className="rounded-lg bg-white p-2 text-xs"><div className="flex justify-between gap-2"><span className="font-medium text-gray-600">{response.student_name || `Student ${response.student_id.slice(0, 6)}`}</span><div className="flex items-center gap-1"><input aria-label={`Grade for ${response.student_name || response.student_id}`} defaultValue={Math.round(response.evaluation?.score ?? 0)} type="number" min="0" max="100" onBlur={(event) => void saveGrade(response, event.currentTarget.value)} className="w-14 rounded border border-gray-200 px-1.5 py-1 text-right text-xs" /><span className="text-[10px] text-gray-400">%</span></div></div><p className="mt-1 text-gray-500">{response.answer}</p>{savingGrade === response.id && <p className="mt-1 text-[10px] text-blue-500">Saving…</p>}</div>)}</div>;
  }

  function responseHeader() {
    return <div className="mt-3 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Individual responses</p><button type="button" role="switch" aria-checked={showResponses} onClick={() => setShowResponses((visible) => !visible)} className={`relative h-5 w-9 rounded-full transition-colors ${showResponses ? "bg-gray-800" : "bg-gray-200"}`} title={showResponses ? "Hide individual responses" : "Show individual responses"}><span className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-white shadow transition-transform ${showResponses ? "translate-x-4" : "translate-x-0"}`} /></button></div>;
  }

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
          orange: data.distribution.orange || 0,
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
            {responseHeader()}{responseList()}
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
            {responseHeader()}{responseList()}
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
