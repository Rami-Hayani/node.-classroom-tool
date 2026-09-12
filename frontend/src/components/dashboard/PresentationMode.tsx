"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, FileUp, X } from "lucide-react";
import type { GraphNode } from "@/components/graph/KnowledgeGraph";
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
  onClose: () => void;
}

export default function PresentationMode({ lectureId, deck, slides, availableDecks, concepts, currentSlideIndex, onSlideChange, onDeckSelect, onUploadFile, onClose }: PresentationModeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const slide = slides[currentSlideIndex];
  const concept = slide?.concept_ids?.map((id) => concepts.find((item) => item.id === id)).find(Boolean) || null;
  const mastery = concept?.avgConfidence ?? concept?.confidence ?? 0;
  const isPdf = Boolean(deck && (deck.file_type === "pdf" || deck.filename.toLowerCase().endsWith(".pdf")));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); onSlideChange(Math.max(0, currentSlideIndex - 1)); }
      if (event.key === "ArrowRight") { event.preventDefault(); onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1)); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, onSlideChange, slides.length]);

  return <div className="fixed inset-0 z-50 flex flex-col bg-[#111318] text-white">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17191f] px-5"><div className="flex min-w-0 items-center gap-3"><span className="font-[family-name:var(--font-geist-sans)] text-xl font-medium">node.</span><span className="text-xs text-white/45">Presentation mode</span>{slides.length > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60">{currentSlideIndex + 1} / {slides.length}</span>}</div><div className="flex items-center gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><FileUp size={14} /> Replace deck</button><button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close presentation"><X size={17} /></button><input ref={fileRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onUploadFile(file); }} /></div></header>
    {!slide ? <div className="flex flex-1 items-center justify-center text-sm text-white/50">Upload lecture slides from the dashboard to start presenting.</div> : <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0b0c0f] p-8"><div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden rounded-lg bg-[#f7f5ef] shadow-2xl">{isPdf && deck?.file_url ? <iframe title={`${deck.filename} slide ${slide.slide_number}`} src={`${deck.file_url}?page=${slide.slide_number}#view=FitH`} scrolling="no" className="h-full w-full overflow-hidden border-0 bg-white" /> : <div className="h-full w-full overflow-auto p-[6%] text-[#1e242a]"><div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300" /><p className="mb-7 max-w-4xl text-[clamp(1.5rem,3vw,3.25rem)] font-semibold tracking-tight">{slide.title}</p><p className="max-w-4xl whitespace-pre-wrap text-[clamp(.9rem,1.5vw,1.35rem)] leading-relaxed text-[#4f5963]">{slide.content.replace(slide.title, "").trim()}</p></div>}<button disabled={currentSlideIndex === 0} onClick={() => onSlideChange(currentSlideIndex - 1)} className="absolute bottom-5 left-5 rounded-full bg-black/10 p-2 text-[#65707a] disabled:opacity-20" aria-label="Previous slide"><ChevronLeft size={18} /></button><button disabled={currentSlideIndex >= slides.length - 1} onClick={() => onSlideChange(currentSlideIndex + 1)} className="absolute bottom-5 left-16 rounded-full bg-black/10 p-2 text-[#65707a] disabled:opacity-20" aria-label="Next slide"><ChevronRight size={18} /></button></div><div className="absolute bottom-6 left-6 w-72 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Mapped course concepts</p>{slide.concept_ids.length ? <div className="flex flex-wrap gap-1.5">{slide.concept_ids.map((id) => { const item = concepts.find((node) => node.id === id); return item ? <span key={id} className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/75">{formatConceptLabel(item.label)}</span> : null; })}</div> : <p className="text-xs text-white/45">No mapped concepts</p>}</div><div className="absolute bottom-6 right-6 w-64 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Concept mastery</span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: confidenceToNodeFill(mastery) }} /></div><p className="text-base font-medium text-white/90">{concept ? formatConceptLabel(concept.label) : "No concept detected"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: confidenceToNodeBorder(mastery) }} /></div><p className="mt-2 text-xs text-white/45">{Math.round(mastery * 100)}% class mastery</p></div>{availableDecks.length > 1 && <div className="absolute left-1/2 top-6 flex max-w-[50%] -translate-x-1/2 gap-2 overflow-x-auto rounded-xl border border-white/10 bg-[#1c2028]/95 p-2 shadow-xl backdrop-blur">{availableDecks.map((item) => <button key={item.id} onClick={() => onDeckSelect(item)} className={`max-w-[180px] shrink-0 truncate rounded-lg px-2.5 py-1.5 text-[10px] ${item.id === deck?.id ? "bg-indigo-500 text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}>{item.filename}</button>)}</div>}</main>}
    {!lectureId && <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/25">Start Class when you are ready to send questions to students.</p>}
  </div>;
}
