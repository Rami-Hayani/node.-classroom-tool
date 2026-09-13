"use client";

import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { type HeatmapConcept } from "@/components/dashboard/ConceptHeatmap";
import KnowledgeGraph, { type GraphNode, type GraphEdge } from "@/components/graph/KnowledgeGraph";
import ConceptInsightPanel from "@/components/dashboard/ConceptInsightPanel";
import ClassInsightCard from "@/components/dashboard/ClassInsightCard";
import PollControls from "@/components/dashboard/PollControls";
import InterventionPanel from "@/components/dashboard/InterventionPanel";
import LectureDeckViewer from "@/components/dashboard/LectureDeckViewer";
import PresentationMode from "@/components/dashboard/PresentationMode";
import { useSocket, useSocketEvent, useSocketReady } from "@/lib/socket";
import { flaskApi, nextApi, type LectureDeck, type LectureSlide } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatConceptLabel } from "@/lib/concepts";
import { getAncestors } from "@/lib/graph";


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
  const [deck, setDeck] = useState<LectureDeck | null>(null);
  const [availableDecks, setAvailableDecks] = useState<LectureDeck[]>([]);
  const [slides, setSlides] = useState<LectureSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [manualConceptSelection, setManualConceptSelection] = useState(false);
  const [responseRefresh, setResponseRefresh] = useState(0);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationPoll, setPresentationPoll] = useState<{ pollId: string; question: string; conceptId: string; conceptLabel: string; status: "preview" | "active" | "closed"; misconceptionSummary?: string; totalResponses?: number; results?: { green: number; yellow: number; orange: number; red: number } | null } | null>(null);

  const socket = useSocket();
  const socketReady = useSocketReady();

  const ensureJoinCode = useCallback(async (id: string, existingCode?: string) => {
    if (existingCode) {
      setJoinCode(existingCode);
      return;
    }
    setJoinCodeLoading(true);
    try {
      // Fetch the course first so older/stale auth context data can still show
      // the persisted course code. Generate one only if it truly is missing.
      const course = await flaskApi.get(`/api/courses/${id}`) as { join_code?: string };
      if (course.join_code) {
        setJoinCode(course.join_code);
        return;
      }
      const generated = await flaskApi.post(`/api/courses/${id}/join-code`, {}) as { join_code?: string };
      setJoinCode(generated.join_code || null);
    } catch {
      setJoinCode(null);
    } finally {
      setJoinCodeLoading(false);
    }
  }, []);

  // Load course ID from auth context, then localStorage, then API
  useEffect(() => {
    if (authCourses.length > 0) {
      const stored = localStorage.getItem("courseId");
      const selected = authCourses.find((course) => course.id === stored) || authCourses[0];
      setCourseId(selected.id);
      void ensureJoinCode(selected.id, selected.join_code);
      localStorage.setItem("courseId", selected.id);
      return;
    }
    const stored = localStorage.getItem("courseId");
    if (stored && !stored.startsWith("demo-")) {
      // Validate stale local storage before committing to it. A previous
      // course/session can otherwise leave the dashboard stuck on an invalid
      // ID with an "Unavailable" join code.
      flaskApi.get(`/api/courses/${stored}`)
        .then((course: { id: string; join_code?: string }) => {
          setCourseId(course.id);
          void ensureJoinCode(course.id, course.join_code);
        })
        .catch(() => {
          localStorage.removeItem("courseId");
          flaskApi.get("/api/courses")
            .then((courses: { id: string; join_code?: string }[]) => {
              const first = courses[0];
              if (!first) return;
              setCourseId(first.id);
              void ensureJoinCode(first.id, first.join_code);
              localStorage.setItem("courseId", first.id);
            })
            .catch(() => {});
        });
      return;
    }
    flaskApi
      .get("/api/courses")
      .then((courses: { id: string; join_code?: string }[]) => {
        if (courses.length > 0) {
          setCourseId(courses[0].id);
          void ensureJoinCode(courses[0].id, courses[0].join_code);
          localStorage.setItem("courseId", courses[0].id);
        }
      })
      .catch(() => {});
  }, [authCourses, ensureJoinCode]);

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

  // Load the newest deck for the selected course, if one exists.
  useEffect(() => {
    if (!courseId) return;
    setDeckLoading(true);
    flaskApi.listDecks(courseId)
      .then((result) => {
        setAvailableDecks(result.decks || []);
        const newest = result.decks?.[0] || null;
        setDeck(newest);
        return newest ? flaskApi.getDeckSlides(newest.id) : null;
      })
      .then((result) => {
        if (result) setSlides(result.slides || []);
        else setSlides([]);
        setCurrentSlideIndex(0);
      })
      .catch(() => { setDeck(null); setSlides([]); })
      .finally(() => setDeckLoading(false));
  }, [courseId]);

  async function uploadDeckFile(file: File) {
    if (!file || !courseId) return;
    if (!/\.(pptx|pdf)$/i.test(file.name)) { setDeckError("Please choose a .pptx or .pdf lecture slide file."); return; }
    setDeckLoading(true);
    setDeckError(null);
    try {
      const result = await flaskApi.uploadDeck(courseId, file) as { deck: LectureDeck; slides: LectureSlide[]; warning?: string };
      setDeck(result.deck);
      setAvailableDecks((previous) => [result.deck, ...previous.filter((item) => item.id !== result.deck.id)]);
      setSlides(result.slides || []);
      setCurrentSlideIndex(0);
      if (result.warning) setDeckError(result.warning);
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : "Could not upload PowerPoint.");
    } finally { setDeckLoading(false); }
  }

  function handleDeckUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadDeckFile(file);
  }

  function handlePresentationUpload(file: File) {
    void uploadDeckFile(file);
  }

  async function handleDeckSelect(selectedDeck: LectureDeck) {
    setDeckLoading(true);
    setDeckError(null);
    try {
      const result = await flaskApi.getDeckSlides(selectedDeck.id);
      setDeck(selectedDeck);
      setSlides(result.slides || []);
      setCurrentSlideIndex(0);
    } catch {
      setDeckError("Could not load that lecture deck.");
    } finally {
      setDeckLoading(false);
    }
  }

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

  useSocketEvent<{ pollId: string; studentId: string }>(
    "poll:response-received",
    useCallback(() => {
      setResponseRefresh((value) => value + 1);
      if (!courseId) return;
      flaskApi
        .get(`/api/courses/${courseId}/graph`)
        .then((data: { nodes: GraphNode[] }) => setGraphNodes(data.nodes || []))
        .catch(() => {});
    }, [courseId]),
  );

  const classNodes = useMemo(() => graphNodes.map((node) => {
    // The node map is driven directly by poll responses returned by the graph
    // endpoint. Heatmap data is only used by the heatmap view.
    return { ...node, avgConfidence: node.avgConfidence ?? 0 };
  }), [graphNodes]);
  const selectedConcept = classNodes.find((node) => node.id === selectedConceptId) || null;
  const currentSlide = slides[currentSlideIndex];
  const slideConceptId = currentSlide?.concept_ids?.[0] || null;
  useEffect(() => {
    if (lectureId && slideConceptId && !manualConceptSelection) setSelectedConceptId(slideConceptId);
  }, [lectureId, slideConceptId, manualConceptSelection]);
  const weakPrerequisiteIds = useMemo(() => {
    if (!activeConceptId) return new Set<string>();
    const weak = new Set<string>();
    for (const edge of graphEdges) {
      if (edge.target === activeConceptId) {
        const source = classNodes.find((node) => node.id === edge.source);
        if (source && (source.avgConfidence ?? 0) < 0.5) weak.add(source.id);
      }
    }
    return weak;
  }, [activeConceptId, graphEdges, classNodes]);
  const splitConceptIds = useMemo(() => new Set(classNodes.filter((node) => node.splitClass).map((node) => node.id)), [classNodes]);
  const strugglingConceptIds = classNodes.filter((node) => (node.avgConfidence ?? 0) > 0 && (node.avgConfidence ?? 0) < 0.5).map((node) => node.id);

  function handleCourseChange(nextCourseId: string) {
    const selected = authCourses.find((course) => course.id === nextCourseId);
    if (!selected) return;
    setCourseId(selected.id);
    void ensureJoinCode(selected.id, selected.join_code);
    setLectureId(null);
    setManualConceptSelection(false);
    setActiveConceptId(null);
    setSelectedConceptId(null);
    setDiagnostic(null);
    setMisconception(undefined);
    localStorage.setItem("courseId", selected.id);
    localStorage.removeItem("lectureId");
  }

  return (
    <div className="flex h-screen flex-col bg-black relative overflow-hidden">

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between bg-black px-5 h-14 text-white">
        <div className="flex items-center gap-4">
          <h1 className="font-[family-name:var(--font-geist-sans)] font-medium text-xl text-white tracking-tight">
            node.
          </h1>
          {authCourses.length > 0 && (
            <select value={courseId || authCourses[0].id} onChange={(event) => handleCourseChange(event.target.value)} className="max-w-[220px] rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm outline-none">
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
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-400/15 border border-indigo-300/30 hover:bg-indigo-400/25 transition-colors disabled:cursor-wait disabled:opacity-70"
              title="Click to copy the student join code"
            >
              <span className="text-[10px] font-semibold text-indigo-200 uppercase tracking-wider">Join code</span>
              <span className="text-xs font-bold text-white tracking-widest font-mono">
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
              className="bg-white text-black hover:bg-gray-200 transition-all duration-200"
            >
              {classStarting ? "Starting..." : "Start Class"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPresentationOpen(true)}
            className="border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            {slides.length ? "Resume Presentation" : "Start Presentation"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEndClass}
            disabled={!lectureId || classEnding}
            className="text-white/55 hover:bg-white/10 hover:text-white"
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
              className="text-white/55 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </Button>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border-[3px] border-black bg-white shadow-[0_12px_30px_rgba(22,42,55,0.12)] sm:mx-5 sm:mb-5">
      <div className="flex h-9 shrink-0 items-center justify-center gap-1.5 border-b border-gray-200/80 bg-white text-[11px] text-gray-400">
        <span className={`h-1.5 w-1.5 rounded-full ${lectureId ? "bg-red-500 animate-pulse" : "bg-gray-400"}`} />
        {lectureId ? "Live lecture" : "Waiting for class"}
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-white p-3">
        {!lectureId && <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Today&apos;s lecture</p><p className="mt-1 text-sm text-gray-600">Upload today&apos;s lecture slides.</p>{deck && <p className="mt-2 text-xs text-gray-500">Selected deck: <span className="font-semibold text-indigo-700">{deck.filename}</span> · {slides.length} slides</p>}{deckError && <p className="mt-2 text-xs text-amber-600">{deckError}</p>}</div><label className={`cursor-pointer rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 ${deckLoading ? "pointer-events-none opacity-50" : ""}`}>{deckLoading ? "Reading slides…" : "Upload Slides"}<input type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" className="hidden" onChange={handleDeckUpload} /></label></div>{availableDecks.length > 0 && <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Past lecture slides · choose one to preview</p><div className="mt-2 flex flex-wrap gap-2">{availableDecks.map((item) => { const selected = deck?.id === item.id; return <button key={item.id} type="button" onClick={() => handleDeckSelect(item)} className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected ? "border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50"}`}><span className="flex items-center gap-2"><span className="block max-w-[240px] truncate font-medium">{item.filename}</span>{selected && <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">Selected</span>}</span><span className="mt-0.5 block text-[10px] text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Uploaded lecture"}</span></button>; })}</div></div>}</section>}
        {lectureId && deck && slides.length > 0 && <div className="hidden" aria-hidden="true"><LectureDeckViewer deck={deck} slides={slides} currentSlideIndex={currentSlideIndex} onSlideChange={setCurrentSlideIndex} concepts={classNodes} /></div>}
        <div className="flex min-h-[440px] min-w-0 flex-1 gap-3">
        <section className="flex min-h-0 min-w-0 flex-[4] flex-col rounded-2xl border border-gray-200/80 bg-white p-3">
            <div className="px-2 pb-2"><h2 className="text-sm font-semibold text-gray-800">Class Understanding Map</h2><p className="text-xs text-gray-400">Mastery is shown directly on the prerequisite graph. Click a concept for student-level evidence.</p></div>
            <div className="min-h-0 flex-1"><KnowledgeGraph nodes={classNodes} edges={graphEdges} mode="student" activeConceptId={activeConceptId} focusNodeId={selectedConceptId} highlightedNodeIds={highlightedNodeIds} weakPrerequisiteIds={weakPrerequisiteIds} splitConceptIds={splitConceptIds} onNodeClick={(node) => { setManualConceptSelection(true); setSelectedConceptId(node.id); const ancestors = getAncestors(node.id, graphEdges); ancestors.add(node.id); setHighlightedNodeIds(ancestors); }} /></div>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-[3] flex-col gap-3 overflow-y-auto"><ConceptInsightPanel courseId={courseId} concept={selectedConcept} refreshKey={responseRefresh} /><ClassInsightCard rootCause={diagnostic?.root_cause || null} misconception={misconception} splitClass={Boolean(selectedConcept?.splitClass)} onAskDiagnostic={() => { if (diagnostic?.root_cause) { setActiveConceptId(diagnostic.root_cause.concept_id); setFollowUpRequest({ conceptId: diagnostic.root_cause.concept_id, nonce: Date.now() }); } }} /><InterventionPanel lectureId={lectureId} conceptIds={strugglingConceptIds.slice(0, 5)} triggerVersion={interventionTrigger} /></aside>
        <aside className="min-h-0 min-w-0 flex-[3] overflow-y-auto"><PollControls lectureId={lectureId} concepts={classNodes.map((c) => ({ id: c.id, label: formatConceptLabel(c.label) }))} activeConceptId={activeConceptId} selectedNodeId={selectedConceptId} connectedStudentCount={connectedStudentCount} followUpRequest={followUpRequest} externalPoll={presentationPoll} onConceptSelected={(conceptId) => {
          setManualConceptSelection(true);
          setActiveConceptId(conceptId);
          setSelectedConceptId(conceptId);
          const ancestors = getAncestors(conceptId, graphEdges);
          ancestors.add(conceptId);
          setHighlightedNodeIds(ancestors);
        }} onGradeSaved={async () => {
          setResponseRefresh((value) => value + 1);
          if (!courseId) return;
          const [graph, heatmap] = await Promise.all([
            flaskApi.get(`/api/courses/${courseId}/graph`),
            flaskApi.get(`/api/courses/${courseId}/heatmap`),
          ]) as [{ nodes: GraphNode[] }, { concepts: HeatmapConcept[]; total_students: number }];
          setGraphNodes(graph.nodes || []);
          setHeatmapData(heatmap.concepts || []);
          setTotalStudents(heatmap.total_students || 0);
        }} onPollActivated={(poll) => { setPresentationPoll(null); setManualConceptSelection(true); setActiveConceptId(poll.conceptId); setSelectedConceptId(poll.conceptId); }} onPollClosed={(poll) => { setPresentationPoll(null); setActiveConceptId(poll.conceptId); setSelectedConceptId(poll.conceptId); setMisconception(poll.misconceptionSummary); setInterventionTrigger((value) => value + 1); nextApi.get(`/api/polls/${poll.pollId}/diagnostic`).then((data) => setDiagnostic(data)).catch(() => setDiagnostic(null)); }} /></aside>
        </div>
      </div>
      </div>

      {presentationOpen && (
        <PresentationMode
          lectureId={lectureId}
          deck={deck}
          slides={slides}
          availableDecks={availableDecks}
          concepts={classNodes}
          currentSlideIndex={currentSlideIndex}
          onSlideChange={setCurrentSlideIndex}
          onDeckSelect={handleDeckSelect}
          onUploadFile={handlePresentationUpload}
          onRefreshMastery={async () => {
            if (!courseId) return;
            const data = await flaskApi.get(`/api/courses/${courseId}/graph`) as { nodes: GraphNode[] };
            setGraphNodes(data.nodes || []);
          }}
          onPollSync={(poll) => {
            setPresentationPoll(poll);
            setActiveConceptId(poll.conceptId);
            setSelectedConceptId(poll.conceptId);
            if (poll.status === "closed") {
              setMisconception(poll.misconceptionSummary);
              setInterventionTrigger((value) => value + 1);
              nextApi.get(`/api/polls/${poll.pollId}/diagnostic`).then((data) => setDiagnostic(data)).catch(() => setDiagnostic(null));
            }
          }}
          onClose={() => setPresentationOpen(false)}
        />
      )}

    </div>
  );
}
