"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { GraphNode, GraphEdge } from "@/components/graph/KnowledgeGraph";
import SidePanel from "@/components/student/SidePanel";
import StudentTopNav from "@/components/student/StudentTopNav";
import { useSocket, useSocketEvent, useSocketReady } from "@/lib/socket";
import { flaskApi } from "@/lib/api";
import { confidenceToColor } from "@/lib/colors";
import { getAncestors } from "@/lib/graph";
import { useAuth } from "@/lib/auth-context";

const KnowledgeGraph = dynamic(() => import("@/components/graph/KnowledgeGraph"), {
  ssr: false,
});

interface PollData {
  pollId: string;
  question: string;
  conceptLabel: string;
}

export default function StudentView() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const socket = useSocket();
  const socketReady = useSocketReady();
  const { user } = useAuth();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [activeConceptId, setActiveConceptId] = useState<string | null>(null);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [lectureEnded, setLectureEnded] = useState(false);

  // Get courseId from localStorage (reactive — poll until available)
  const [courseId, setCourseId] = useState<string | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("courseId");
    if (stored) { setCourseId(stored); return; }
    // If not set yet (race with navigation), poll briefly
    const interval = setInterval(() => {
      const v = localStorage.getItem("courseId");
      if (v) { setCourseId(v); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Fetch real graph data (with retry on failure)
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    let attempt = 0;

    const fetchGraph = () => {
      flaskApi
        .get(`/api/courses/${courseId}/graph?student_id=${studentId}`)
        .then((data: { nodes: GraphNode[]; edges: { source_id?: string; target_id?: string; source?: string; target?: string }[] }) => {
          if (cancelled) return;
          if (data.nodes && data.nodes.length > 0) {
            setNodes(
              data.nodes.map((n: GraphNode) => ({
                ...n,
                color: n.color || confidenceToColor(n.confidence ?? 0),
              })),
            );
          }
          if (data.edges) {
            setEdges(
              data.edges.map((e) => ({
                source: e.source_id || e.source || "",
                target: e.target_id || e.target || "",
              })),
            );
          }
        })
        .catch(() => {
          if (cancelled) return;
          attempt++;
          if (attempt < 5) {
            setTimeout(fetchGraph, 1500 * attempt);
          }
        });
    };

    fetchGraph();
    return () => { cancelled = true; };
  }, [courseId, studentId]);

  // Poll for the latest live lecture every 5s so enrolled students auto-join
  // the class started directly by their professor.
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
            setLectureEnded(false);
            setLectureId((prev) => {
              if (prev !== live.id) {
                localStorage.setItem("lectureId", live.id);
              }
              return live.id;
            });
          } else {
            const hadLecture = Boolean(lectureId || localStorage.getItem("lectureId"));
            setLectureId(null);
            setLectureEnded(hadLecture);
            localStorage.removeItem("lectureId");
          }
        })
        .catch(() => {
        });
    };

    checkLiveLecture();
    const interval = setInterval(checkLiveLecture, 5000);
    return () => clearInterval(interval);
  }, [courseId]);

  // Join lecture room
  useEffect(() => {
    if (!lectureId) return;
    socket.emit("lecture:join", {
      lectureId,
      role: "student",
      studentId,
    });
  }, [socket, lectureId, studentId, socketReady]);

  // Socket events
  useSocketEvent<{ conceptId: string; label: string }>(
    "lecture:concept-detected",
    useCallback((data) => {
      setActiveConceptId(data.conceptId);
      setTimeout(() => setActiveConceptId(null), 5000);
    }, []),
  );

  useSocketEvent<PollData>(
    "poll:new-question",
    useCallback((data) => {
      setActivePoll(data);
    }, []),
  );

  useSocketEvent<{ studentId: string; conceptId: string; newColor: string; confidence: number }>(
    "mastery:updated",
    useCallback(
      (data) => {
        if (data.studentId !== studentId) return;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === data.conceptId
              ? { ...n, color: data.newColor, confidence: data.confidence }
              : n,
          ),
        );
      },
      [studentId],
    ),
  );

  // Lecture ended
  useSocketEvent<{ lectureId: string }>(
    "lecture:ended",
    useCallback(() => {
      setLectureEnded(true);
      setLectureId(null);
      localStorage.removeItem("lectureId");
    }, []),
  );

  // Toggle selection: click same node = deselect
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
        setHighlightedNodeIds(new Set());
      } else {
        setSelectedNode(node);
        const ancestors = getAncestors(node.id, edges);
        ancestors.add(node.id);
        setHighlightedNodeIds(ancestors);
      }
    },
    [edges, selectedNode?.id],
  );

  const handleDeselectNode = useCallback(() => {
    setSelectedNode(null);
    setHighlightedNodeIds(new Set());
  }, []);

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-800 relative overflow-hidden font-sans">
      <StudentTopNav studentId={studentId} email={user?.email} />
      <div className="relative z-10 flex h-8 items-center justify-center gap-1.5 border-b border-gray-200/80 bg-white/80 text-[11px] text-gray-400">
        <span className={`h-1.5 w-1.5 rounded-full ${lectureEnded ? "bg-gray-400" : "bg-red-500 animate-pulse"}`} />
        {lectureEnded ? "Lecture ended" : lectureId ? "Live lecture" : "Waiting for class"}
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Graph area */}
        <div className="flex-[3] h-full min-w-0 relative">
          {nodes.length > 0 ? (
            <KnowledgeGraph
              nodes={nodes}
              edges={edges}
              activeConceptId={activeConceptId}
              highlightedNodeIds={highlightedNodeIds}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white rounded-xl border border-gray-200">
              <div className="flex flex-col items-center gap-3">
                <p className="font-[family-name:var(--font-instrument-serif)] text-2xl text-gray-300 animate-pulse">Node</p>
                <p className="text-sm text-gray-400">Loading graph...</p>
              </div>
            </div>
          )}

        </div>

        {/* Side panel */}
        <div className="flex-[2] h-full min-w-[320px] max-w-[450px] relative z-10">
          <SidePanel
            activePoll={activePoll}
            studentId={studentId}
            selectedNode={selectedNode}
            onDeselectNode={handleDeselectNode}
            lectureId={lectureId}
            courseId={courseId}
            onStartTutoring={() => router.push(`/student/${studentId}/tutor`)}
            onConceptClick={(conceptId) => {
              const node = nodes.find((n) => n.id === conceptId);
              if (node) handleNodeClick(node);
            }}
          />
        </div>
      </main>
    </div>
  );
}
