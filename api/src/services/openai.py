import os
import requests
from typing import Optional


def openai_text(prompt: str, max_tokens: int = 1500, system: Optional[str] = None) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "max_tokens": max_tokens, "messages": messages},
        timeout=60,
    )
    response.raise_for_status()
    text = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
    if not text:
        raise RuntimeError("OpenAI returned no text")
    return text.strip()
