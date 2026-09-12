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
  onPollActivated?: (poll: { pollId: string; conceptId: string; conceptLabel: string }) => void;
  onRefreshMastery?: () => void | Promise<void>;
  onClose: () => void;
}

export default function PresentationMode({ lectureId, deck, slides, availableDecks, concepts, currentSlideIndex, onSlideChange, onDeckSelect, onUploadFile, onPollActivated, onRefreshMastery, onClose }: PresentationModeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [poll, setPoll] = useState<{ pollId: string; question: string; conceptLabel: string; status: "preview" | "active" | "closed" } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const slide = slides[currentSlideIndex];
  const mappedConcepts = slide?.concept_ids?.map((id) => concepts.find((item) => item.id === id)).filter(Boolean) as GraphNode[] || [];
  const concept = mappedConcepts.find((item) => item.id === selectedConceptId) || mappedConcepts[0] || null;
  const mastery = concept?.avgConfidence ?? concept?.confidence ?? 0;
  const isPdf = Boolean(deck && (deck.file_type === "pdf" || deck.filename.toLowerCase().endsWith(".pdf")));

  useEffect(() => {
    setSelectedConceptId(slide?.concept_ids?.[0] || "");
    setPoll(null);
    setPollError(null);
  }, [currentSlideIndex, slide?.concept_ids]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); onSlideChange(Math.max(0, currentSlideIndex - 1)); }
      if (event.key === "ArrowRight") { event.preventDefault(); onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1)); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, onSlideChange, slides.length]);

  useEffect(() => {
    if (poll?.status !== "active" || !onRefreshMastery) return;
    void onRefreshMastery();
    const interval = window.setInterval(() => void onRefreshMastery(), 10000);
    return () => window.clearInterval(interval);
  }, [onRefreshMastery, poll?.status]);

  async function generateQuestion() {
    if (!lectureId || !slide || !concept || generating) return;
    setGenerating(true);
    setPollError(null);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureId}/poll/generate`, {
        conceptId: concept.id,
        slideTitle: slide.title,
        slideText: slide.content,
      });
      setPoll({ pollId: data.pollId, question: data.question, conceptLabel: data.conceptLabel, status: "preview" });
    } catch (error) {
      setPollError(error instanceof Error ? error.message : "Could not generate a question");
    } finally { setGenerating(false); }
  }

  async function activatePoll() {
    if (!lectureId || !poll) return;
    try {
      await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/activate`, {});
      setPoll({ ...poll, status: "active" });
      onPollActivated?.({ pollId: poll.pollId, conceptId: concept?.id || "", conceptLabel: poll.conceptLabel });
    } catch (error) { setPollError(error instanceof Error ? error.message : "Could not send the question"); }
  }

  async function closePoll() {
    if (!lectureId || !poll) return;
    try {
      await nextApi.post(`/api/lectures/${lectureId}/poll/${poll.pollId}/close`, {});
      setPoll({ ...poll, status: "closed" });
      await onRefreshMastery?.();
    } catch (error) { setPollError(error instanceof Error ? error.message : "Could not close the poll"); }
  }

  return <div className="fixed inset-0 z-50 flex flex-col bg-[#111318] text-white">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17191f] px-5"><div className="flex min-w-0 items-center gap-3"><span className="font-[family-name:var(--font-geist-sans)] text-xl font-medium">node.</span><span className="text-xs text-white/45">Presentation mode</span>{slides.length > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60">{currentSlideIndex + 1} / {slides.length}</span>}</div><div className="flex items-center gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><FileUp size={14} /> Replace deck</button><button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close presentation"><X size={17} /></button><input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadFile(file); }} /></div></header>
    {!lectureId && <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/25">Start Class when you are ready to send questions to students.</p>}
  </div>;
}
