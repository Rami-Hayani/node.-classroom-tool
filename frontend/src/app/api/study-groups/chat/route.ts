import { NextRequest, NextResponse } from "next/server";
import { openAIText } from "@/lib/openai";

/**
 * POST /api/study-groups/chat
 *
 * Chat endpoint for study group partners.
 * Uses OpenAI to simulate partner responses with short, concise messages.
 */
export async function POST(request: NextRequest) {
  let body;

  try {
    body = await request.json();
  } catch (parseError) {
    console.error("[study-groups/chat] JSON parse error:", parseError);
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { message, partnerName, concepts, conversationHistory } = body;

  if (!message || !partnerName) {
    return NextResponse.json(
      { error: "message and partnerName required" },
      { status: 400 }
    );
  }

  // Fallback responses if OpenAI is unavailable
  const fallbackResponses = [
    "hmm let me think about that",
    "oh yeah i remember that part",
    "wait can you explain that again?",
    "yeah that one confused me too lol",
    "ohhh okay that makes sense",
    "try drawing it out maybe?",
    "yeah i think so",
    "hmm not sure, wanna look it up?",
  ];

  try {
    // Build conversation context for OpenAI
    const systemPrompt = `You're ${partnerName}, texting with a study partner about: ${(concepts || []).join(", ")}

TEXT LIKE A REAL STUDENT:
- Super short (1-2 sentences)
- Casual, friendly
- Use "yeah", "oh", "wait", "hmm", "lol" etc.
- Ask quick questions
- No formal language or long explanations

Examples:
- "oh wait do you mean the derivative?"
- "yeah that one tripped me up too lol"
- "hmm try drawing it out maybe?"
- "ohhh that makes sense now"
- "wait can you explain that part again"`;

    // Format conversation history
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content
        });
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const reply = await openAIText(messages.map((m) => `${m.role}: ${m.content}`).join("\n"), { maxTokens: 80, system: systemPrompt });

    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[study-groups/chat] Error:", err);
    // Return a fallback response instead of erroring
    const reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return NextResponse.json({ reply });
  }
}
