/**
 * Understanding Check — sidecar Haiku call after each tutoring message to detect mastery.
 *
 * Model: OpenAI chat model
 * Called after every student message in the tutoring flow.
 */

import { openAIText } from "@/lib/openai";

export function buildUnderstandingCheckPrompt(
  studentMessage: string,
  targetConcepts: { label: string; description: string }[]
): string {
  const conceptList = targetConcepts
    .map((c) => `- ${c.label}: ${c.description}`)
    .join("\n");

  return `You are evaluating whether a student has demonstrated understanding of a concept during a tutoring session.

TARGET CONCEPTS THE STUDENT IS WORKING ON:
${conceptList}

STUDENT'S LATEST MESSAGE:
"${studentMessage}"

TASK:
Did the student demonstrate clear understanding of any of the target concepts in this message? Only say true if the student shows genuine comprehension — not just repeating words, but explaining the concept correctly in their own way.

Return ONLY valid JSON (no markdown, no explanation):
{ "understood": true/false, "concept_label": "label of the concept understood or empty string" }`;
}

export function parseUnderstandingCheckResponse(
  response: string
): { understood: boolean; concept_label: string } {
  try {
    const parsed = JSON.parse(response);
    return {
      understood: Boolean(parsed.understood),
      concept_label: parsed.concept_label || "",
    };
  } catch {
    console.error(
      "Failed to parse understanding check response:",
      response
    );
    return { understood: false, concept_label: "" };
  }
}

export async function checkUnderstanding(
  studentMessage: string,
  targetConcepts: { label: string; description: string }[]
): Promise<{ understood: boolean; concept_label: string }> {
  if (targetConcepts.length === 0) {
    return { understood: false, concept_label: "" };
  }

  const prompt = buildUnderstandingCheckPrompt(
    studentMessage,
    targetConcepts
  );

  return parseUnderstandingCheckResponse(await openAIText(prompt, { maxTokens: 128 }));
}
