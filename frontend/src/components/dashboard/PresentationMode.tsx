"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileUp, Loader2, Play, Sparkles, X } from "lucide-react";
import { nextApi } from "@/lib/api";
import { formatConceptLabel } from "@/lib/concepts";
import { confidenceToNodeBorder, confidenceToNodeFill } from "@/lib/colors";

export interface PresentationSlide { index?: number; title: string; text: string; }
export interface PresentationConcept { id: string; label: string; description?: string; avgConfidence?: number; confidence?: number; color?: string; }

interface PresentationModeProps {
  lectureID: string | null;
  slides: PresentationSlide[];
  concepts: PresentationConcept[];
  nodemapData: PresentationConcept[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  onClose: () => void;
  onSlidesLoaded: (slides: PresentationSlide[]) => void;
}

export default function PresentationMode({ lectureID, slides, concepts, nodemapData, currentSlideIndex, onSlideChange, onClose, onSlidesLoaded }: PresentationModeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const slide = slides[currentSlideIndex];
  const concept = useMemo(() => {
    if (!slide) return null;
    const content = `${slide.title} ${slide.text}`.toLowerCase();
    return [...nodemapData, ...concepts].find((item) => content.includes(item.label.toLowerCase())) || nodemapData[0] || concepts[0] || null;
  }, [concepts, nodemapData, slide]);
  const mastery = concept ? (concept.avgConfidence ?? concept.confidence ?? 0) : 0;

  useEffect(() => { setQuestion(null); }, [currentSlideIndex]);

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pptx")) { setQuestionError("Please choose a .pptx PowerPoint file."); return; }
    setLoading(true); setQuestionError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const token = localStorage.getItem("token");
      const result = await fetch(`${process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000"}/api/presentations/extract`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!result.ok) throw new Error((await result.json()).error || "Could not read PowerPoint");
      const data = await result.json() as { slides: PresentationSlide[] };
      onSlidesLoaded(data.slides); onSlideChange(0);
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "Could not read PowerPoint"); }
    finally { setLoading(false); }
  }

  async function generateQuestion() {
    if (!lectureID || !slide || generating) return;
    setGenerating(true); setQuestionError(null);
    try {
      const data = await nextApi.post(`/api/lectures/${lectureID}/poll/generate`, { conceptId: concept?.id, slideTitle: slide.title, slideText: slide.text });
      setQuestion(data.question);
    } catch (error) { setQuestionError(error instanceof Error ? error.message : "Could not generate a question"); }
    finally { setGenerating(false); }
  }

  return <div className="fixed inset-0 z-50 flex flex-col bg-[#111318] text-white">
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#17191f] px-5">
      <div className="flex items-center gap-3"><span className="font-[family-name:var(--font-instrument-serif)] text-xl">node.</span><span className="text-xs text-white/45">Presentation mode</span>{slides.length > 0 && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/60">{currentSlideIndex + 1} / {slides.length}</span>}</div>
      <div className="flex items-center gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><FileUp size={14} /> Replace deck</button><button onClick={onClose} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close presentation"><X size={17} /></button><input ref={fileRef} type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} /></div>
    </header>
    {loading ? <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-white/50" /></div> : !slide ? <div className="flex flex-1 items-center justify-center"><button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/20 px-16 py-14 text-white/60 hover:border-white/40 hover:text-white"><FileUp size={32} /><span className="text-sm">Upload a PowerPoint to start presenting</span><span className="text-xs text-white/35">.pptx files only</span></button></div> : <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0b0c0f] p-8">
      <div className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-lg bg-[#f7f5ef] p-[6%] text-[#1e242a] shadow-2xl"><div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300" /><p className="mb-7 max-w-4xl text-[clamp(1.5rem,3vw,3.25rem)] font-semibold tracking-tight">{slide.title}</p><p className="max-w-4xl whitespace-pre-wrap text-[clamp(.9rem,1.5vw,1.35rem)] leading-relaxed text-[#4f5963]">{slide.text.replace(slide.title, "").trim()}</p><div className="absolute bottom-5 right-7 text-xs text-[#9aa0a5]">node. live lecture</div>
        <button disabled={currentSlideIndex === 0} onClick={() => onSlideChange(currentSlideIndex - 1)} className="absolute bottom-5 left-5 rounded-full bg-black/5 p-2 text-[#65707a] disabled:opacity-20"><ChevronLeft size={18} /></button><button disabled={currentSlideIndex >= slides.length - 1} onClick={() => onSlideChange(currentSlideIndex + 1)} className="absolute bottom-5 left-16 rounded-full bg-black/5 p-2 text-[#65707a] disabled:opacity-20"><ChevronRight size={18} /></button>
      </div>
      <div className="absolute bottom-6 left-6 w-72 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Live check-in</span><Sparkles size={14} className="text-violet-300" /></div>{question ? <p className="text-sm leading-relaxed text-white/85">{question}</p> : <><p className="text-xs leading-relaxed text-white/45">Generate a question from this slide for your class.</p><button onClick={() => void generateQuestion()} disabled={generating || !lectureID} className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#20232a] disabled:opacity-40">{generating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{generating ? "Generating…" : "Generate question"}</button></>}</div>
      <div className="absolute bottom-6 right-6 w-64 rounded-xl border border-white/10 bg-[#1c2028]/95 p-4 shadow-xl backdrop-blur"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/45">Concept mastery</span><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: confidenceToNodeFill(mastery) }} /></div><p className="text-base font-medium text-white/90">{concept ? formatConceptLabel(concept.label) : "No concept detected"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: confidenceToNodeBorder(mastery) }} /></div><p className="mt-2 text-xs text-white/45">{Math.round(mastery * 100)}% class mastery · synced to this slide</p></div>
      {questionError && <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-red-300">{questionError}</p>}
    </main>}
  </div>;
}
