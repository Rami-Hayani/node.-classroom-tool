"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type HeatmapConcept } from "@/components/dashboard/ConceptHeatmap";
import ConceptHeatmap from "@/components/dashboard/ConceptHeatmap";
import KnowledgeGraph, { type GraphNode, type GraphEdge } from "@/components/graph/KnowledgeGraph";
import ConceptInsightPanel from "@/components/dashboard/ConceptInsightPanel";
import ClassInsightCard from "@/components/dashboard/ClassInsightCard";
import PollControls from "@/components/dashboard/PollControls";
import InterventionPanel from "@/components/dashboard/InterventionPanel";
import { useSocket, useSocketEvent, useSocketReady } from "@/lib/socket";
import { flaskApi, nextApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatConceptLabel } from "@/lib/concepts";


export default function ProfessorDashboard() {
  const router = useRouter();
  const { user, profile, role, courses: authCourses, signOut } = useAuth();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapConcept[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [classStarting, setClassStarting] = useState(false);
  const [classEnding, setClassEnding] = useState(false);
  const [connectedStudentCount, setConnectedStudentCount] = useState(0);
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<{ concept_id: string; responders: number; struggling_responders: number; root_cause: { concept_id: string; label: string; weak_overlap: number; struggling_responders: number; ratio: number } | null } | null>(null);
  const [misconception, setMisconception] = useState<string | undefined>();
  const [followUpRequest, setFollowUpRequest] = useState<{ conceptId: string; nonce: number } | null>(null);
  const [interventionTrigger, setInterventionTrigger] = useState(0);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const socket = useSocket();
  const socketReady = useSocketReady();

  // Load course ID from auth context, then localStorage, then API
  useEffect(() => {
    if (authCourses.length > 0) {
      const stored = localStorage.getItem("courseId");
      const selected = authCourses.find((course) => course.id === stored) || authCourses[0];
      setCourseId(selected.id);
      setJoinCode(selected.join_code || null);
      if (!selected.join_code) {
        setJoinCodeLoading(true);
        flaskApi.post(`/api/courses/${selected.id}/join-code`, {})
          .then((course: { join_code?: string }) => setJoinCode(course.join_code || null))
          .catch(() => setJoinCode(null))
          .finally(() => setJoinCodeLoading(false));
      }
      localStorage.setItem("courseId", selected.id);
      return;
    }
    const stored = localStorage.getItem("courseId");
    if (stored && !stored.startsWith("demo-")) {
      setCourseId(stored);
      return;
    }
    flaskApi
      .get("/api/courses")
      .then((courses: { id: string; join_code?: string }[]) => {
        if (courses.length > 0) {
          setCourseId(courses[0].id);
          setJoinCode(courses[0].join_code || null);
          localStorage.setItem("courseId", courses[0].id);
          if (!courses[0].join_code) {
            setJoinCodeLoading(true);
            flaskApi.post(`/api/courses/${courses[0].id}/join-code`, {})
              .then((course: { join_code?: string }) => setJoinCode(course.join_code || null))
              .catch(() => setJoinCode(null))
              .finally(() => setJoinCodeLoading(false));
          }
        }
      })
      .catch(() => {});
  }, [authCourses]);

  // Fetch heatmap data
  useEffect(() => {
    if (!courseId) return;
    flaskApi
      .get(`/api/courses/${courseId}/heatmap`)
      .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
        if (data.concepts) setHeatmapData(data.concepts);
        if (data.total_students) setTotalStudents(data.total_students);
      })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    flaskApi.get(`/api/courses/${courseId}/graph`)
      .then((data) => data as { nodes: GraphNode[]; edges: (GraphEdge & { source_id?: string; target_id?: string })[] })
      .then((data) => {
        setGraphNodes(data.nodes || []);
        // Flask returns source_id/target_id; normalize once for the graph renderer.
        setGraphEdges((data.edges || []).map((edge) => ({
          source: edge.source || edge.source_id || "",
          target: edge.target || edge.target_id || "",
        })).filter((edge) => edge.source && edge.target));
      })
      .catch(() => {});
  }, [courseId]);

  // Poll for the latest live lecture every 5s so this dashboard stays in sync.
  useEffect(() => {
    if (!courseId) return;

    const checkLiveLecture = () => {
      flaskApi
        .get(`/api/courses/${courseId}/lectures`)
        .then((lectures: { id: string; status: string; started_at?: string }[]) => {
          const liveLectures = lectures.filter((l) => l.status === "live");
          liveLectures.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
          const live = liveLectures[0];
          if (live) {
            setLectureId((prev) => {
              if (prev !== live.id) {
                localStorage.setItem("lectureId", live.id);
              }
              return live.id;
            });
          }
        })
        .catch(() => {});
    };

    checkLiveLecture();
    const interval = setInterval(checkLiveLecture, 5000);
    return () => clearInterval(interval);
  }, [courseId]);

  // Join lecture room as professor
  useEffect(() => {
    if (lectureId) {
      socket.emit("lecture:join", { lectureId, role: "professor" });
    }
  }, [socket, lectureId, socketReady]);

  async function handleStartClass() {
    if (!courseId || classStarting) return;
    setClassStarting(true);
    try {
      const data = await nextApi.post("/api/lectures", {
        courseId,
        title: `Live Class — ${new Date().toLocaleString()}`,
      });
      setLectureId(data.id);
      localStorage.setItem("lectureId", data.id);
    } catch (err) {
      console.error("Failed to start class:", err);
    } finally {
      setClassStarting(false);
    }
  }

  async function handleEndClass() {
    if (!lectureId || classEnding) return;
    setClassEnding(true);
    try {
      await nextApi.put(`/api/lectures/${lectureId}`, {
        status: "ended",
        ended_at: new Date().toISOString(),
      });
      setLectureId(null);
      setConnectedStudentCount(0);
      localStorage.removeItem("lectureId");
    } catch (err) {
      console.error("Failed to end class:", err);
    } finally {
      setClassEnding(false);
    }
  }

  useSocketEvent<{ count: number }>(
    "lecture:presence",
    useCallback((data) => setConnectedStudentCount(data.count), []),
  );

  // Socket: poll:closed
  useSocketEvent<{ pollId: string; results: unknown }>(
    "poll:closed",
    useCallback(() => {
      // PollControls handles its own state; refresh the class map.
      if (courseId) {
        flaskApi
          .get(`/api/courses/${courseId}/heatmap`)
          .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
            if (data.concepts) setHeatmapData(data.concepts);
            setInterventionTrigger((value) => value + 1);
          })
          .catch(() => {});
      }
    }, [courseId]),
  );

  // Socket: heatmap:updated — re-fetch from Flask
  useSocketEvent<{ conceptId: string }>(
    "heatmap:updated",
    useCallback(() => {
      if (!courseId) return;
      flaskApi
        .get(`/api/courses/${courseId}/heatmap`)
        .then((data: { concepts: HeatmapConcept[]; total_students: number }) => {
          if (data.concepts) setHeatmapData(data.concepts);
        })
        .catch(() => {});
    }, [courseId]),
  );

  const classNodes = useMemo(() => graphNodes.map((node) => {
    const heat = heatmapData.find((item) => item.id === node.id);
    return { ...node, avgConfidence: heat?.avg_confidence ?? 0, distribution: heat?.distribution, strugglingCount: heat?.struggling_count ?? 0, masteredCount: heat?.mastered_count ?? 0, splitClass: heat?.split_class ?? false };
  }), [graphNodes, heatmapData]);
  const selectedConcept = classNodes.find((node) => node.id === selectedConceptId) || null;
  const weakPrerequisiteIds = useMemo(() => {
    if (!activeConceptId) return new Set<string>();
    const weak = new Set<string>();
    for (const edge of graphEdges) {
      if (edge.target === activeConceptId) {
        const source = classNodes.find((node) => node.id === edge.source);
        if (source && (source.avgConfidence ?? 0) < 0.55) weak.add(source.id);
      }
    }
    return weak;
  }, [activeConceptId, graphEdges, classNodes]);
  const splitConceptIds = useMemo(() => new Set(classNodes.filter((node) => node.splitClass).map((node) => node.id)), [classNodes]);
  const strugglingConceptIds = classNodes.filter((node) => (node.avgConfidence ?? 0) < 0.55).map((node) => node.id);

  function handleCourseChange(nextCourseId: string) {
    const selected = authCourses.find((course) => course.id === nextCourseId);
    if (!selected) return;
    setCourseId(selected.id);
    setJoinCode(selected.join_code || null);
    if (!selected.join_code) {
      setJoinCodeLoading(true);
      flaskApi.post(`/api/courses/${selected.id}/join-code`, {})
        .then((course: { join_code?: string }) => setJoinCode(course.join_code || null))
        .catch(() => setJoinCode(null))
        .finally(() => setJoinCodeLoading(false));
    }
    setLectureId(null);
    setActiveConceptId(null);
    setSelectedConceptId(null);
    setDiagnostic(null);
    setMisconception(undefined);
    localStorage.setItem("courseId", selected.id);
    localStorage.removeItem("lectureId");
  }

  return (
    <div className="flex h-screen flex-col bg-[#fafafa] relative overflow-hidden">

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-200/80 px-5 h-14">
        <div className="flex items-center gap-4">
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-xl text-gray-800 tracking-tight">
            prereq
          </h1>
          <span className="text-sm text-gray-400 font-light">Live Class Understanding Map</span>
          {authCourses.length > 0 && (
            <select value={courseId || authCourses[0].id} onChange={(event) => handleCourseChange(event.target.value)} className="max-w-[220px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm">
              {authCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          )}
          {lectureId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Live</span>
            </div>
          )}
          {lectureId && (
            <span className="text-xs text-gray-500">{connectedStudentCount} students connected</span>
          )}
          {courseId && (
            <button
              onClick={() => {
                if (!joinCode) return;
                navigator.clipboard.writeText(joinCode);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              disabled={!joinCode}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:cursor-wait disabled:opacity-70"
              title="Click to copy the student join code"
            >
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Join code</span>
              <span className="text-xs font-bold text-indigo-800 tracking-widest font-mono">
                {codeCopied ? "Copied!" : joinCode || (joinCodeLoading ? "Loading…" : "Unavailable")}
              </span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!lectureId && (
            <Button
              size="sm"
              onClick={handleStartClass}
              disabled={!courseId || classStarting}
              className="bg-gray-800 text-white hover:bg-gray-700 transition-all duration-200"
            >
              {classStarting ? "Starting..." : "Start Class"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEndClass}
            disabled={!lectureId || classEnding}
            className="text-gray-400 hover:text-gray-600"
            title="End Class"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            {classEnding ? "Ending..." : "End Class"}
          </Button>
          {user && (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              Sign out
            </Button>
          )}
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="flex min-h-[440px] flex-1 gap-3">
          <section className="flex min-w-0 flex-[7] flex-col rounded-2xl border border-gray-200/80 bg-white p-3">
            <div className="flex items-center justify-between px-2 pb-2"><div><h2 className="text-sm font-semibold text-gray-800">{showHeatmap ? "Class Mastery Heatmap" : "Class Understanding Map"}</h2><p className="text-xs text-gray-400">{showHeatmap ? "Compare aggregate mastery across concepts and categories." : "Mastery is shown on the prerequisite graph. Click a concept for student-level evidence."}</p></div><div className="flex items-center gap-3 text-[10px] text-gray-400"><button onClick={() => setShowHeatmap((value) => !value)} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-medium text-gray-600 hover:bg-gray-50">{showHeatmap ? "View prerequisite graph" : "View mastery heatmap"}</button>{!showHeatmap && <><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />struggling</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />developing</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />mastered</span></>}</div></div>
            <div className="min-h-0 flex-1">{showHeatmap ? <ConceptHeatmap concepts={heatmapData} totalStudents={totalStudents} activeConceptId={activeConceptId} /> : <KnowledgeGraph nodes={classNodes} edges={graphEdges} mode="professor" activeConceptId={activeConceptId} weakPrerequisiteIds={weakPrerequisiteIds} splitConceptIds={splitConceptIds} onNodeClick={(node) => { setSelectedConceptId(node.id); setActiveConceptId(node.id); }} />}</div>
          </section>
          <aside className="flex w-[30%] min-w-[280px] flex-col gap-3"><ConceptInsightPanel courseId={courseId} concept={selectedConcept} /><ClassInsightCard rootCause={diagnostic?.root_cause || null} misconception={misconception} splitClass={Boolean(selectedConcept?.splitClass)} onAskDiagnostic={() => { if (diagnostic?.root_cause) { setActiveConceptId(diagnostic.root_cause.concept_id); setFollowUpRequest({ conceptId: diagnostic.root_cause.concept_id, nonce: Date.now() }); } }} /></aside>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <PollControls lectureId={lectureId} concepts={classNodes.map((c) => ({ id: c.id, label: formatConceptLabel(c.label) }))} activeConceptId={activeConceptId} connectedStudentCount={connectedStudentCount} followUpRequest={followUpRequest} onPollActivated={(poll) => { setActiveConceptId(poll.conceptId); setSelectedConceptId(poll.conceptId); }} onPollClosed={(poll) => { setActiveConceptId(poll.conceptId); setSelectedConceptId(poll.conceptId); setMisconception(poll.misconceptionSummary); setInterventionTrigger((value) => value + 1); nextApi.get(`/api/polls/${poll.pollId}/diagnostic`).then((data) => setDiagnostic(data)).catch(() => setDiagnostic(null)); }} />
          <InterventionPanel lectureId={lectureId} conceptIds={strugglingConceptIds.slice(0, 5)} triggerVersion={interventionTrigger} />
        </div>
      </div>

    </div>
  );
}
