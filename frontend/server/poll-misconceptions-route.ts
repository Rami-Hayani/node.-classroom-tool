import { Router, json } from "express";
import { openAIText } from "./openai";

const router = Router();
function flaskUrl() { return process.env.FLASK_API_URL || "http://localhost:5000"; }

router.post("/api/polls/:pollId/misconceptions", json(), async (req, res) => {
  try {
    const pollId = req.params.pollId;
    const pollResponse = await fetch(`${flaskUrl()}/api/polls/${pollId}`);
    const poll = await pollResponse.json() as { question: string };
    const responsesResponse = await fetch(`${flaskUrl()}/api/polls/${pollId}/responses`);
    const responses = await responsesResponse.json() as { answer: string; evaluation?: { eval_result?: string; reasoning?: string; feedback?: string } }[];
    const evidence = responses.filter((response) => ["wrong", "partial", "incorrect"].includes(response.evaluation?.eval_result || ""));
    if (evidence.length < 3) return res.json({ misconceptions: [], message: "No dominant misconception detected." });
    const compact = evidence.map((item, index) => `${index + 1}. Answer: ${item.answer}\nReasoning: ${item.evaluation?.reasoning || item.evaluation?.feedback || ""}`).join("\n");
    const text = await openAIText(`Cluster only recurring misconceptions supported by these partial/wrong answers. Be conservative; if there is no recurring pattern, return an empty array.\nQUESTION: ${poll.question}\nEVIDENCE:\n${compact}\nReturn JSON only: {"misconceptions":[{"label":"short label","count":1,"summary":"evidence-based summary"}]}. Limit to 3.`, { maxTokens: 500 });
    const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
    res.json({ misconceptions: Array.isArray(parsed.misconceptions) ? parsed.misconceptions.slice(0, 3) : [], message: "" });
  } catch (error) {
    console.error("[misconceptions]", error);
    res.json({ misconceptions: [], message: "No dominant misconception detected." });
  }
});

export default router;
