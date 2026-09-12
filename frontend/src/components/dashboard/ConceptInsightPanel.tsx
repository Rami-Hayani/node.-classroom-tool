"use client";

import { useEffect, useState } from "react";
import { flaskApi } from "@/lib/api";
import { formatConceptLabel } from "@/lib/concepts";
import { COLOR_HEX } from "@/lib/colors";

interface ClassStudent { id: string; name: string; confidence: number; color: string }
interface LatestQuestion { id: string; question: string; expected_answer?: string; status?: string }
interface ConceptInsightPanelProps {
  courseId: string | null;
  concept: { id: string; label: string; avgConfidence: number; strugglingCount: number; masteredCount: number; splitClass?: boolean } | null;
  refreshKey?: number;
}

export default function ConceptInsightPanel({ courseId, concept, refreshKey = 0 }: ConceptInsightPanelProps) {
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [latestQuestion, setLatestQuestion] = useState<LatestQuestion | null>(null);

  useEffect(() => {
    if (!courseId || !concept) { setStudents([]); setLatestQuestion(null); return; }
    setLoading(true);
    flaskApi.get(`/api/courses/${courseId}/concepts/${concept.id}/students`)
      .then((data) => setStudents((data as { students: ClassStudent[] }).students || []))
      .catch(() => setStudents([]));
    flaskApi.get(`/api/courses/${courseId}/concepts/${concept.id}/latest-question`)
      .then((data) => {
        const result = data as { question: LatestQuestion | null; responses: QuestionResponse[] };
        setLatestQuestion(result.question || null);
      })
      .catch(() => { setLatestQuestion(null); })
      .finally(() => setLoading(false));
  }, [courseId, concept?.id, refreshKey]);

  if (!concept) {
    return <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200/80 bg-white p-6 text-center text-sm text-gray-400">Click a concept to inspect class understanding.</div>;
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Selected node</p>
          <h2 className="mt-1 text-lg font-medium text-gray-800">{formatConceptLabel(concept.label)}</h2>
        </div>
        <div className="text-right"><div className="text-2xl font-semibold text-gray-800">{Math.round(concept.avgConfidence * 100)}%</div><div className="text-[10px] text-gray-400">class mastery</div></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-red-50 px-2 py-1 text-red-600">{concept.strugglingCount} struggling</span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{concept.masteredCount} mastered</span>
        {concept.splitClass && <span className="rounded-full bg-violet-50 px-2 py-1 font-medium text-violet-700">Split class</span>}
      </div>
      <div className="mt-6">
        <div className="mb-1 flex justify-between text-[10px] text-gray-400"><span>0%</span><span>Student confidence</span><span>100%</span></div>
        <div className="relative h-8 rounded-full bg-gradient-to-r from-red-100 via-amber-100 to-emerald-100">
          {loading ? <div className="absolute inset-0 animate-pulse rounded-full bg-gray-100/60" /> : students.map((student) => (
            <div key={student.id} title={`${student.name}: ${Math.round(student.confidence * 100)}%`} className="group absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-help rounded-full border-2 border-white shadow" style={{ left: `${Math.max(1, Math.min(99, student.confidence * 100))}%`, backgroundColor: COLOR_HEX[student.color] || COLOR_HEX.gray }}>
              <span className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-[10px] text-white group-hover:block">{student.name} · {Math.round(student.confidence * 100)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-400"><span>Struggling</span><span>Developing</span><span>Mastered</span></div>
      </div>
      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Most recent question</p>
        {latestQuestion ? (
          <>
            <p className="mt-2 text-sm font-medium leading-snug text-gray-700">{latestQuestion.question}</p>
          </>
        ) : <p className="mt-2 text-xs italic text-gray-400">No question has been generated for this concept yet.</p>}
      </div>
    </div>
  );
}
