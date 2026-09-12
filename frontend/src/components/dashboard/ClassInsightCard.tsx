"use client";

interface RootCause { label: string; weak_overlap: number; struggling_responders: number; ratio: number; concept_id: string }
interface ClassInsightCardProps {
  rootCause: RootCause | null;
  misconception?: string;
  onAskDiagnostic: () => void;
  splitClass?: boolean;
}

export default function ClassInsightCard({ rootCause, misconception, onAskDiagnostic, splitClass }: ClassInsightCardProps) {
  if (!rootCause && !misconception && !splitClass) return null;
  return <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
    <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Class insight</p>{splitClass && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700">Split class</span>}</div>
    {rootCause && <>
      <h3 className="mt-2 text-base font-semibold text-gray-800">Likely prerequisite gap: {rootCause.label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-600">{rootCause.weak_overlap} of {rootCause.struggling_responders} struggling responders also show weak mastery in {rootCause.label}.</p>
      <button onClick={onAskDiagnostic} className="mt-4 rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700">Ask Diagnostic Follow-Up</button>
    </>}
    {misconception && <div className="mt-4 border-t border-amber-200 pt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Most common misconception</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{misconception}</p></div>}
    {splitClass && <p className="mt-3 text-xs text-violet-700">Use peer instruction instead of reteaching the whole class.</p>}
  </div>;
}
