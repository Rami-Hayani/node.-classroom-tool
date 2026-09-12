/**
 * Express route for POST /api/polls/:pollId/respond
 *
 * Moved from Next.js to Express so Socket.IO emits work properly
 */

import { Router, json } from "express";
import { emitToStudent, emitToProfessor } from "./socket-helpers";
import { openAIText } from "./openai";

const router = Router();

function getFlaskUrl(): string {
  return process.env.FLASK_API_URL || "http://localhost:5000";
}

async function flaskGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask GET ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function flaskPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask POST ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function flaskPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getFlaskUrl()}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "1" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flask PUT ${path} failed: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Evaluate response with OpenAI
async function evaluateResponse(
  question: string,
  expectedAnswer: string,
  studentAnswer: string
): Promise<{ eval_result: "correct" | "partial" | "wrong"; feedback: string; reasoning: string }> {
  const prompt = `You are evaluating a student's answer to a poll question in a live lecture.

QUESTION: ${question}

EXPECTED ANSWER: ${expectedAnswer}

STUDENT'S ANSWER: ${studentAnswer}

TASK:
Evaluate whether the student's answer demonstrates understanding of the concept. Return:
- "correct" if they show clear understanding (even if wording differs)
- "partial" if they show some understanding but miss key points
- "wrong" if they misunderstand or give an incorrect answer

Also provide brief feedback (1-2 sentences) for the student.

Return ONLY valid JSON (no markdown):
{ "eval_result": "correct"|"partial"|"wrong", "feedback": "...", "reasoning": "..." }`;

  try {
    let cleaned = (await openAIText(prompt, { maxTokens: 256 })).trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned);
    return {
      eval_result: parsed.eval_result || "partial",
      feedback: parsed.feedback || "Answer recorded.",
      reasoning: parsed.reasoning || ""
    };
  } catch (err) {
    console.error("[poll-respond] Evaluation error:", err);
    return {
      eval_result: "partial",
      feedback: "Your answer has been recorded.",
      reasoning: "Evaluation error"
    };
  }
}

router.post("/api/polls/:pollId/respond", json(), async (req, res) => {
  try {
    const { pollId } = req.params;
    const { studentId, answer } = req.body as { studentId: string; answer: string };

    if (!studentId || !answer) {
      return res.status(400).json({ error: "studentId and answer are required" });
    }

    console.log(`[poll-respond] Student ${studentId} answering poll ${pollId}`);

    // Look up the poll question
    const poll = await flaskGet<{
      id: string;
      question: string;
      expected_answer: string;
      concept_id: string;
      lecture_id: string;
    }>(`/api/polls/${pollId}`);

    // Evaluate the student's answer with OpenAI
    const evaluation = await evaluateResponse(poll.question, poll.expected_answer, answer);
    console.log(`[poll-respond] Evaluation: ${evaluation.eval_result}`);

    // Store the poll response via Flask
    console.log(`[poll-respond] Storing response for poll ${pollId}, student ${studentId}`);
    const storedResponse = await flaskPost(`/api/polls/${pollId}/responses`, {
      student_id: studentId,
      answer,
      evaluation: {
        eval_result: evaluation.eval_result,
        feedback: evaluation.feedback,
        reasoning: evaluation.reasoning,
      },
    });
    console.log(`[poll-respond] Response stored successfully: ${JSON.stringify(storedResponse).slice(0, 100)}`);

    // Update mastery via Flask
    let masteryUpdate = {
      concept_id: poll.concept_id,
      old_color: "gray",
      new_color: "gray",
      confidence: 0,
    };

    try {
      masteryUpdate = await flaskPut(
        `/api/students/${studentId}/mastery/${poll.concept_id}`,
        { eval_result: evaluation.eval_result }
      );
      console.log(`[poll-respond] Mastery updated: ${masteryUpdate.old_color} -> ${masteryUpdate.new_color}`);
    } catch (err) {
      console.error("[poll-respond] Failed to update mastery:", err);
    }

    // Emit mastery:updated to the specific student
    emitToStudent(studentId, "mastery:updated", {
      studentId,
      conceptId: poll.concept_id,
      oldColor: masteryUpdate.old_color,
      newColor: masteryUpdate.new_color,
      confidence: masteryUpdate.confidence,
    });

    // Emit heatmap:updated to the professor
    emitToProfessor(poll.lecture_id, "heatmap:updated", {
      conceptId: poll.concept_id,
    });

    emitToProfessor(poll.lecture_id, "poll:response-received", {
      pollId,
      studentId,
    });

    console.log(`[poll-respond] Success - emitted updates to student and professor`);

    res.json({
      evaluation: {
        eval_result: evaluation.eval_result,
        feedback: evaluation.feedback,
        reasoning: evaluation.reasoning,
      },
      updated: masteryUpdate,
    });

  } catch (err) {
    console.error("[poll-respond] Error:", err);
    res.status(500).json({
      error: "Failed to process response",
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;
