import { supabaseBrowser } from "@/lib/supabase-browser";

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (supabaseBrowser) {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const sessionToken = data.session?.access_token || null;
      if (sessionToken) {
        localStorage.setItem("token", sessionToken);
        return sessionToken;
      }
    } catch {
      // Fall back to the legacy token mirror below.
    }
  }
  return localStorage.getItem("token");
}

export type LectureDeck = {
  id: string;
  course_id: string;
  filename: string;
  created_at?: string;
  file_url?: string;
  file_type?: string;
};

export type LectureSlide = {
  id: string;
  deck_id?: string;
  slide_number: number;
  title: string;
  content: string;
  concept_ids: string[];
};

async function request<T = any>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "1",
    ...((options?.headers as Record<string, string>) || {}),
  };

  // Use the mirrored token or recover the active Supabase session token.
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const flaskApi = {
  get: (path: string) => request(FLASK_API_URL, path),
  post: (path: string, body: unknown) =>
    request(FLASK_API_URL, path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(FLASK_API_URL, path, { method: "PUT", body: JSON.stringify(body) }),
  uploadDeck: async (courseId: string, file: File) => {
    const headers: Record<string, string> = { "ngrok-skip-browser-warning": "1" };
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${FLASK_API_URL}/api/courses/${courseId}/decks`, { method: "POST", headers, body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to upload deck");
    }
    const data = await res.json();
    if (data.deck) data.deck.file_url = `${FLASK_API_URL}/api/decks/${data.deck.id}/file`;
    return data;
  },
  listDecks: async (courseId: string) => {
    const data = await request<{ decks: LectureDeck[] }>(FLASK_API_URL, `/api/courses/${courseId}/decks`);
    return { ...data, decks: (data.decks || []).map((deck) => ({ ...deck, file_url: `${FLASK_API_URL}/api/decks/${deck.id}/file` })) };
  },
  getDeckSlides: (deckId: string) => request<{ deck_id: string; slides: LectureSlide[] }>(FLASK_API_URL, `/api/decks/${deckId}/slides`),
};

export const nextApi = {
  get: (path: string) => request("", path),
  post: (path: string, body: unknown) =>
    request("", path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request("", path, { method: "PUT", body: JSON.stringify(body) }),
};
