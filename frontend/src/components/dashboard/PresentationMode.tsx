"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileUp, Loader2, Play, X } from "lucide-react";
import type { GraphNode } from "@/components/graph/KnowledgeGraph";
import { nextApi } from "@/lib/api";
import type { LectureDeck, LectureSlide } from "@/lib/api";
import { formatConceptLabel } from "@/lib/concepts";
import { confidenceToNodeBorder, confidenceToNodeFill } from "@/lib/colors";

interface PresentationModeProps {
  lectureId: string | null;
  deck: LectureDeck | null;
  slides: LectureSlide[];
  availableDecks: LectureDeck[];
  concepts: GraphNode[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  onDeckSelect: (deck: LectureDeck) => void;
  onUploadFile: (file: File) => void;
  onRefreshMastery?: () => void | Promise<void>;
  onPollSync?: (poll: { pollId: string; question: string; conceptId: string; conceptLabel: string; status: "preview" | "active" | "closed"; misconceptionSummary?: string; totalResponses?: number; results?: { green: number; yellow: number; orange: number; red: number } | null }) => void;
  onClose: () => void;
}

export default function PresentationMode({ lectureId, deck, slides, availableDecks, concepts, currentSlideIndex, onSlideChange, onDeckSelect, onUploadFile, onRefreshMastery, onPollSync, onClose }: PresentationModeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ pollId: string; question: string; status: "preview" | "active" | "closed" } | null>(null);
  const slide = slides[currentSlideIndex];
  const concept = slide?.concept_ids?.map((id) => concepts.find((item) => item.id === id)).find(Boolean) || null;
  const mastery = concept?.avgConfidence ?? concept?.confidence ?? 0;
  const isPdf = Boolean(deck && (deck.file_type === "pdf" || deck.filename.toLowerCase().endsWith(".pdf")));

  useEffect(() => {
    setQuestion(null);
    setPollError(null);
  }, [currentSlideIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); onSlideChange(Math.max(0, currentSlideIndex - 1)); }
      if (event.key === "ArrowRight") { event.preventDefault(); onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1)); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, onSlideChange, slides.length]);

  async function generateQuestion() {
    if (!lectureId || !slide || !concept || generating) return;
    setGenerating(true);
    setPollError(null);
    try {
      const result = await nextApi.post(`/api/lectures/${lectureId}/poll/generate`, {
        conceptId: concept.id,
        slideTitle: slide.title,
        slideText: slide.content,
      });
      const nextQuestion = { pollId: result.pollId, question: result.question, status: "preview" as const };
      setQuestion(nextQuestion);
      onPollSync?.({ ...nextQuestion, conceptId: concept.id, conceptLabel: concept.label });
    } catch (error) {
      setPollError(error instanceof Error ? error.message : "Could not generate a question");
    } finally { setGenerating(false); }
  }

  async function sendQuestion() {
    if (!lectureId || !question) return;
    try {
      await nextApi.post(`/api/lectures/${lectureId}/poll/${question.pollId}/activate`, {});
      setQuestion({ ...question, status: "active" });
      onPollSync?.({ ...question, conceptId: concept?.id || "", conceptLabel: concept?.label || "", status: "active" });
    } catch (error) { setPollError(error instanceof Error ? error.message : "Could not send the question"); }
  }

  async function closePoll() {
    if (!lectureId || !question) return;
    try {
      const result = await nextApi.post(`/api/lectures/${lectureId}/poll/${question.pollId}/close`, {});
      setQuestion({ ...question, status: "closed" });
      onPollSync?.({
        ...question,
        conceptId: concept?.id || "",
        conceptLabel: concept?.label || "",
        status: "closed",
        misconceptionSummary: result.misconceptionSummary,
        totalResponses: result.totalResponses || 0,
        results: result.distribution ? {
          green: result.distribution.green || 0,
          yellow: result.distribution.yellow || 0,
          orange: result.distribution.orange || 0,
          red: result.distribution.red || 0,
        } : null,
      });
      await onRefreshMastery?.();
    } catch (error) { setPollError(error instanceof Error ? error.message : "Could not close the poll"); }
  }

  return <div className="fixed inset-0 z-50 flex flex-col bg-[#111318] text-white">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17191f] px-5"><div className="flex min-w-0 items-center gap-3"><span className="font-[family-name:var(--font-geist-sans)] text-xl font-medium">node.</span><span className="text-xs text-white/45">Presentation mode</span>{slides.length > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60">{currentSlideIndex + 1} / {slides.length}</span>}</div><div className="flex items-center gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><FileUp size={14} /> Replace deck</button><button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close presentation"><X size={17} /></button><input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadFile(file); }} /></div></header>
    {!slide ? <div className="flex flex-1 items-center justify-center text-sm text-white/50">Upload lecture slides from the dashboard to start presenting.</div> : <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0b0c0f] p-8"><div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden rounded-lg bg-[#f7f5ef] shadow-2xl">{isPdf && deck?.file_url ? <iframe title={`${deck.filename} slide ${slide.slide_number}`} src={`${deck.file_url}?page=${slide.slide_number}#view=FitH`} scrolling="no" className="h-full w-full overflow-hidden border-0 bg-white" /> : <div className="h-full w-full overflow-auto p-[6%] text-[#1e242a]"><div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300" /><p className="mb-7 max-w-4xl text-[clamp(1.5rem,3vw,3.25rem)] font-semibold tracking-tight">{slide.title}</p><p className="max-w-4xl whitespace-pre-wrap text-[clamp(.9rem,1.5vw,1.35rem)] leading-relaxed text-[#4f5963]">{slide.content.replace(slide.title, "").trim()}</p></div>}<button disabled={currentSlideIndex === 0} onClick={() => onSlideChange(currentSlideIndex - 1)} className="absolute bottom-5 left-5 rounded-full bg-black/10 p-2 text-[#65707a] disabled:opacity-20" aria-label="Previous slide"><ChevronLeft size={18} /></button><button disabled={currentSlideIndex >= slides.length - 1} onClick={() => onSlideChange(currentSlideIndex + 1)} className="absolute bottom-5 left-16 rounded-full bg-black/10 p-2 text-[#65707a] disabled:opacity-20" aria-label="Next slide"><ChevronRight size={18} /></button></div><div className="absolute bottom-6 left-6 w-80 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Slide topic</p><p className="text-sm font-medium text-white/90">{concept ? formatConceptLabel(concept.label) : "No mapped concept"}</p>{question ? <div className="mt-3"><p className="text-xs leading-relaxed text-white/85">{question.question}</p>{question.status === "preview" ? <div className="mt-3 flex gap-2"><button onClick={() => void sendQuestion()} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#20232a]">Send to Students</button><button onClick={() => setQuestion(null)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">Discard</button></div> : question.status === "active" ? <button onClick={() => void closePoll()} className="mt-3 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600">Close Poll</button> : <p className="mt-2 text-[10px] text-white/45">Poll closed · mastery refreshed</p>}</div> : <button onClick={() => void generateQuestion()} disabled={generating || !lectureId || !concept} className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#20232a] disabled:opacity-40">{generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{generating ? "Generating…" : "Generate question"}</button>}{pollError && <p className="mt-2 text-[10px] text-red-300">{pollError}</p>}</div><div className="absolute bottom-6 right-6 w-64 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Concept mastery</span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: confidenceToNodeFill(mastery) }} /></div><p className="text-base font-medium text-white/90">{concept ? formatConceptLabel(concept.label) : "No concept detected"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: confidenceToNodeBorder(mastery) }} /></div><p className="mt-2 text-xs text-white/45">{Math.round(mastery * 100)}% class mastery</p></div></main>}
    {!lectureId && <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/25">Start Class when you are ready to send questions to students.</p>}
  </div>;
}
