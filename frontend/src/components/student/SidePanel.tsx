"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  CheckCircle2,
  BarChart2,
  BookOpen,
  AlertCircle,
  X,
} from "lucide-react";
import type { GraphNode } from "@/components/graph/KnowledgeGraph";
import { COLOR_HEX, confidenceToNodeBorder } from "@/lib/colors";
import { flaskApi, nextApi } from "@/lib/api";
import { formatConceptLabel } from "@/lib/concepts";
import ConceptLearning from "./ConceptLearning";

interface Resource {
  title: string;
  url: string;
  type: string;
  snippet: string;
}

const RESOURCE_LIBRARY: { matches: string[]; resources: Resource[] }[] = [
  {
    matches: ["binary tree", "binary search tree", "bst"],
    resources: [
      { title: "Binary Trees · OpenDSA", url: "https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/BinaryTree.html", type: "article", snippet: "Definitions, properties, recursive structure, and practice." },
      { title: "Trees · Stanford CS106B", url: "https://cs.stanford.edu/people/eroberts/courses/cs106b/handouts/37-Trees.pdf", type: "article", snippet: "Stanford notes with clear tree and binary-search-tree examples." },
      { title: "Binary Search Trees · VisuAlgo", url: "https://visualgo.net/en/bst", type: "interactive", snippet: "Step through search, insertion, and deletion visually." },
    ],
  },
  {
    matches: ["recurrence", "divide and conquer", "sorting", "algorithm", "asymptotic"],
    resources: [
      { title: "Introduction to Algorithms · MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/", type: "course", snippet: "Lectures, notes, and problems for core algorithms topics." },
      { title: "Algorithms · Khan Academy", url: "https://www.khanacademy.org/computing/computer-science/algorithms", type: "course", snippet: "Short explanations and visual practice for common algorithms." },
    ],
  },
];

function resourcesForConcept(label: string): Resource[] {
  const normalized = label.toLowerCase().replace(/[_-]+/g, " ");
  return RESOURCE_LIBRARY.find((group) => group.matches.some((match) => normalized.includes(match)))?.resources || [
    { title: "Algorithms · MIT OpenCourseWare", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/", type: "course", snippet: "A reliable starting point for data structures and algorithms." },
    { title: "OpenDSA Data Structures", url: "https://opendsa-server.cs.vt.edu/ODSA/Books/Everything/html/", type: "interactive", snippet: "Interactive explanations and exercises across core structures." },
  ];
}

interface SidePanelProps {
  activePoll: { pollId: string; question: string; conceptLabel: string } | null;
  studentId: string;
  selectedNode: GraphNode | null;
  onDeselectNode: () => void;
  lectureId: string | null;
  courseId: string | null;
  onStartTutoring?: () => void;
  onConceptClick?: (conceptId: string) => void;
}

export default function SidePanel({
  activePoll,
  studentId,
  selectedNode,
  onDeselectNode,
  lectureId,
  courseId,
  onStartTutoring,
  onConceptClick,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<"poll" | "concept">("poll");

  // Poll state
  const [pollAnswer, setPollAnswer] = useState("");
  const [pollSubmitted, setPollSubmitted] = useState(false);
  const [pollFeedback, setPollFeedback] = useState<string | null>(null);
  const [pollScore, setPollScore] = useState<number | null>(null);
  const [pollLoading, setPollLoading] = useState(false);

  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Concept learning dialog state
  const [learningOpen, setLearningOpen] = useState(false);

  // Reset poll state when poll changes
  useEffect(() => {
    setPollAnswer("");
    setPollSubmitted(false);
    setPollFeedback(null);
    setPollScore(null);
  }, [activePoll?.pollId]);

  // Auto-switch to concept tab when a node is selected
  useEffect(() => {
    if (selectedNode) {
      if (activeTab !== "concept") {
        // Return to the live poll after closing concept details.
      }
      setActiveTab("concept");
    } else if (activeTab === "concept") {
      setActiveTab("poll");
    }
  }, [selectedNode?.id]);

  // Fetch node detail data when selectedNode changes
  useEffect(() => {
    if (!selectedNode) {
      setResources([]);
      return;
    }

    if ((selectedNode.confidence ?? 0) === 0) {
      setResources(resourcesForConcept(selectedNode.label));
      return;
    }

    setLoadingResources(true);
    setResources(resourcesForConcept(selectedNode.label));
    setLoadingResources(false);
  }, [selectedNode?.id, selectedNode?.label]);

  // Poll submit handler
  async function handlePollSubmit() {
    if (!activePoll || !pollAnswer.trim()) return;
    setPollLoading(true);
    try {
      const res = await nextApi.post(`/api/polls/${activePoll.pollId}/respond`, {
        studentId,
        answer: pollAnswer.trim(),
      });
      setPollFeedback(res.evaluation?.feedback || "Answer submitted.");
      setPollScore(typeof res.evaluation?.score === "number" ? res.evaluation.score : null);
      setPollSubmitted(true);
    } catch {
      setPollFeedback("Failed to submit. Please try again.");
    } finally {
      setPollLoading(false);
    }
  }

  // Node detail content
  const renderNodeContent = () => {
    if (!selectedNode) return null;

    const confidence = selectedNode.confidence ?? 0;
    const colorHex = confidenceToNodeBorder(confidence);
    const confidencePct = Math.round(confidence * 100);
    const isStruggling = confidence > 0 && confidence < 0.7;
    const isMastered = confidence >= 0.7;

    return (
      <motion.div
        key="node-detail"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="h-full"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 truncate">{formatConceptLabel(selectedNode.label)}</h2>
            {selectedNode.category && (
              <span className="inline-flex items-center mt-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 rounded-full">
                {selectedNode.category}
              </span>
            )}
          </div>
          <button
            onClick={onDeselectNode}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0 ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Confidence summary */}
        <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Current understanding</span>
            <span className="text-xs font-semibold" style={{ color: colorHex }}>
              {confidencePct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${confidencePct}%`, backgroundColor: colorHex }}
            />
          </div>
        </div>

        {selectedNode.description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{selectedNode.description}</p>
        )}

        {isMastered && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-green-700 font-medium text-sm">Concept Mastered</h3>
                <p className="text-gray-500 text-xs mt-1">
                  Great job! You&apos;ve demonstrated strong understanding.
                </p>
              </div>
            </div>
          </div>
        )}

        {confidence === 0 && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-400 italic">
              This concept hasn&apos;t been covered yet in lecture.
            </p>
          </div>
        )}

        {isStruggling && (
          <div className="space-y-5">
            <div
              className={`p-4 rounded-xl border ${
                confidence < 0.4
                  ? "bg-orange-50 border-orange-200"
                  : confidence < 0.55
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-lime-50 border-lime-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={`shrink-0 mt-0.5 ${
                    confidence < 0.4 ? "text-orange-500" : confidence < 0.55 ? "text-yellow-500" : "text-lime-500"
                  }`}
                  size={20}
                />
                <div>
                  <h3
                    className={`font-medium text-sm ${
                      confidence < 0.4 ? "text-orange-700" : confidence < 0.55 ? "text-yellow-700" : "text-lime-700"
                    }`}
                  >
                    {confidence < 0.4 ? "Developing" : confidence < 0.55 ? "Building" : "On Track"}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">Build this skill with a short explanation and one worked example.</p>
                </div>
              </div>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-[10px] font-medium text-gray-700 uppercase tracking-wider mb-2">
                Recommended Resources
              </h4>
              {loadingResources ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : resources.length > 0 ? (
                <div className="space-y-2">
                  {resources.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors shrink-0">
                        {r.type === "video" ? (
                          <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-current border-b-[4px] border-b-transparent ml-0.5" />
                        ) : (
                          <BookOpen size={14} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{r.title}</p>
                        {r.snippet && <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{r.snippet}</p>}
                      </div>
                      <span className="text-[10px] font-medium text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">Open ↗</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No resources found.</p>
              )}
            </div>

            {/* Learning buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLearningOpen(true)}
                className="py-3 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center gap-2 transition-all text-sm font-medium"
              >
                <BookOpen size={16} />
                <span>Learn</span>
              </button>
              <button
                onClick={() => {
                  setLearningOpen(true);
                  // The dialog will handle switching to quiz mode via its internal tabs
                }}
                className="py-3 px-4 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center gap-2 transition-all text-sm font-medium"
              >
                <BarChart2 size={16} />
                <span>Quiz</span>
              </button>
            </div>

          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200/80 rounded-xl overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-gray-200/80">
        <button
          onClick={() => setActiveTab("poll")}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
            activeTab === "poll" ? "text-gray-800" : "text-gray-400 hover:text-gray-500"
          }`}
        >
          <BarChart2 size={15} />
          <span>Live Poll</span>
          {activeTab === "poll" && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800" />
          )}
        </button>
        {selectedNode && (
          <div className="flex-1 relative flex items-center">
            <button
              onClick={() => setActiveTab("concept")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "concept" ? "text-gray-800" : "text-gray-400 hover:text-gray-500"
              }`}
            >
              <BookOpen size={15} />
              <span className="truncate max-w-[80px]">{formatConceptLabel(selectedNode.label)}</span>
            </button>
            <span
              role="button"
              tabIndex={0}
              onClick={onDeselectNode}
              onKeyDown={(e) => { if (e.key === "Enter") onDeselectNode(); }}
              className="absolute right-1.5 p-0.5 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </span>
            {activeTab === "concept" && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === "concept" && selectedNode ? (
            renderNodeContent()
          ) : activeTab === "poll" ? (
            <motion.div
              key="poll"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col"
            >
              {activePoll ? (
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                    Current Question
                  </span>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 rounded-full">
                      {formatConceptLabel(activePoll.conceptLabel)}
                    </span>
                  </div>
                  <h3 className="text-base text-gray-800 font-medium mb-4 leading-snug">
                    {activePoll.question}
                  </h3>

                  {!pollSubmitted ? (
                    <div className="space-y-3">
                      <textarea
                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300/50 focus:border-gray-300 resize-none h-32 text-sm"
                        placeholder="Type your answer here..."
                        value={pollAnswer}
                        onChange={(e) => setPollAnswer(e.target.value)}
                      />
                      <button
                        onClick={handlePollSubmit}
                        disabled={pollLoading || !pollAnswer.trim()}
                        className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                          pollAnswer.trim()
                            ? "bg-gray-800 hover:bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Send size={14} />
                        <span>{pollLoading ? "Submitting..." : "Submit Answer"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        Answer submitted!
                      </div>
                      {pollFeedback && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-600 italic">{pollFeedback}</p>
                        </div>
                      )}
                      {pollScore !== null && (
                        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <span className="text-gray-500">AI grade</span>
                          <span className="font-semibold text-gray-700">{Math.round(pollScore)}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mb-3">
                    <BarChart2 className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">No active poll</p>
                  <p className="text-xs text-gray-400 mt-1">
                    A poll will appear here when the professor starts one
                  </p>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Concept Learning Dialog */}
      {selectedNode && (
        <ConceptLearning
          conceptId={selectedNode.id}
          conceptLabel={formatConceptLabel(selectedNode.label)}
          studentId={studentId}
          isOpen={learningOpen}
          onClose={() => setLearningOpen(false)}
          onConfidenceUpdate={(oldColor, newColor, confidence) => {
            // Update the node color in the graph
            if (selectedNode) {
              selectedNode.color = newColor;
              selectedNode.confidence = confidence;
            }
          }}
        />
      )}
    </div>
  );
}
