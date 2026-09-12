"use client";

import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { GraphNode } from "@/components/graph/KnowledgeGraph";
import type { LectureDeck, LectureSlide } from "@/lib/api";
import { formatConceptLabel } from "@/lib/concepts";

interface LectureDeckViewerProps {
  deck: LectureDeck;
  slides: LectureSlide[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  concepts: GraphNode[];
}

export default function LectureDeckViewer({ deck, slides, currentSlideIndex, onSlideChange, concepts }: LectureDeckViewerProps) {
  const slide = slides[currentSlideIndex];
  if (!slide) return null;
  const labels = slide.concept_ids.map((id) => concepts.find((concept) => concept.id === id)?.label).filter(Boolean) as string[];
  const isPdf = deck.file_type === "pdf" || deck.filename.toLowerCase().endsWith(".pdf");

  return <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2"><FileText size={16} className="shrink-0 text-indigo-500" /><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Today&apos;s lecture</p><span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Selected deck</span></div><p className="truncate text-sm font-medium text-gray-700">{deck.filename}</p></div></div>
      <span className="shrink-0 text-xs text-gray-400">Slide {currentSlideIndex + 1} / {slides.length}</span>
    </div>
    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
      {isPdf && deck.file_url ? <iframe title={`${deck.filename} slide ${slide.slide_number}`} src={`${deck.file_url}?page=${slide.slide_number}#view=FitH`} scrolling="no" className="h-[560px] w-full overflow-hidden rounded-lg border border-gray-200 bg-white" /> : <><h3 className="text-xl font-semibold text-gray-800">{slide.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">{slide.content || "No extractable text on this slide."}</p>{isPdf && <p className="mt-3 text-xs text-amber-600">The original PDF is not available for this older upload. Upload it again to view the page itself.</p>}</>}
      <div className="mt-4 border-t border-gray-200 pt-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Node concepts</p>{labels.length ? <div className="mt-2 flex flex-wrap gap-1.5">{labels.map((label) => <span key={label} className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{formatConceptLabel(label)}</span>)}</div> : <p className="mt-2 text-xs italic text-gray-400">No mapped concepts</p>}</div>
    </div>
    <div className="mt-3 flex items-center justify-between"><button type="button" onClick={() => onSlideChange(Math.max(0, currentSlideIndex - 1))} disabled={currentSlideIndex === 0} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={15} /> Previous</button><button type="button" onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1))} disabled={currentSlideIndex === slides.length - 1} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30">Next <ChevronRight size={15} /></button></div>
  </section>;
}
