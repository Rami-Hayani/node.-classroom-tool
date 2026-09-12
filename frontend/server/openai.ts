export async function openAIText(prompt: string, options: { maxTokens?: number; system?: string } = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: options.maxTokens || 1024,
      ...(options.system ? { messages: [{ role: "system", content: options.system }, { role: "user", content: prompt }] } : { messages: [{ role: "user", content: prompt }] }),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json() as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI request failed (${response.status})`);
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no text");
  return text;
}
