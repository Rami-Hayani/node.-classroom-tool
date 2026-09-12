/**
 * Express route for POST /api/study-groups/chat
 *
 * Moved from Next.js API route to Express to avoid body parsing issues
 * with the custom server.
 */

import { Router, json } from "express";
import { openAIText } from "./openai";

const router = Router();

// Fallback responses if OpenAI is unavailable
const fallbackResponses = [
  "That's a good question! Let me think about that for a sec.",
  "Oh interesting point! Have you looked at the lecture notes on that?",
  "Yeah I struggled with that too. Want to work through an example together?",
  "Good observation! That concept really clicked for me when I drew it out.",
  "I'm not 100% sure either. Should we look it up together?",
  "That makes sense! I think the key is understanding how it relates to the other concepts.",
];

router.post("/api/study-groups/chat", json(), async (req, res) => {
  try {
    const { message, partnerName, concepts, conversationHistory } = req.body;

    if (!message || !partnerName) {
      return res.status(400).json({ error: "message and partnerName required" });
    }

    // Build system prompt
    const systemPrompt = `You are ${partnerName}, a student in a peer study group. You're working together on these concepts: ${(concepts || []).join(", ")}.

IMPORTANT INSTRUCTIONS:
- Keep responses VERY SHORT (1-3 sentences max)
- Be helpful but concise
- Ask clarifying questions when needed
- Share quick insights or examples
- Be friendly and collaborative
- Never write long explanations - this is a chat, not a lecture
- Use casual student language

Examples of good responses:
- "Oh interesting! Have you tried thinking about it geometrically?"
- "Yeah that confused me too. The key is understanding the chain rule first."
- "Wait, can you clarify what you mean by that?"
- "Totally! It's like how momentum keeps things moving even after you stop pushing."`;

    // Format conversation history
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        history.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      }
    }

    // Add current message
    history.push({
      role: "user",
      content: message
    });

    const reply = await openAIText(history.map((message) => `${message.role}: ${message.content}`).join("\n"), { maxTokens: 150, system: systemPrompt });

    res.json({ reply });

  } catch (err) {
    console.error("[chat-route] Error:", err);
    // Return fallback instead of erroring
    const reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    res.json({ reply });
  }
});

export default router;
