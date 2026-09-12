"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const FLASK_API_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || "http://localhost:5000";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finishOAuth() {
      if (!supabaseBrowser) {
        setError("Google sign-in is not configured.");
        return;
      }

      const { data, error: sessionError } = await supabaseBrowser.auth.getSession();
      if (sessionError || !data.session) {
        // Remove revoked refresh tokens so the next attempt starts cleanly.
        await supabaseBrowser.auth.signOut({ scope: "local" }).catch(() => {});
        localStorage.removeItem("token");
        localStorage.removeItem("authRole");
        localStorage.removeItem("oauthRole");
        setError(sessionError?.message || "Google sign-in did not return a session.");
        return;
      }

      const selectedRole = (localStorage.getItem("oauthRole") || "student") as "teacher" | "student";
      const metadata = data.session.user.user_metadata || {};
      const name = metadata.name || metadata.full_name || metadata.name || data.session.user.email?.split("@")[0] || "Student";

      const { error: updateError } = await supabaseBrowser.auth.updateUser({ data: { name, role: selectedRole } });
      if (updateError) throw updateError;
      const { data: refreshed } = await supabaseBrowser.auth.getSession();
      const token = refreshed.session?.access_token || data.session.access_token;
      localStorage.setItem("token", token);
      localStorage.setItem("authRole", selectedRole);

      // Keep the existing course/profile context when this Google account
      // has signed in before. OAuth is authentication, not class creation.
      // The API's /auth/me endpoint will load any existing enrollments/courses
      // after the full app reload below.

      if (selectedRole === "teacher") {
        const profileResponse = await fetch(`${FLASK_API_URL}/api/auth/teacher-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        });
        if (!profileResponse.ok) {
          const profileError = await profileResponse.json().catch(() => ({}));
          throw new Error(profileError.error || "Could not create the teacher profile. Check the server Supabase key.");
        }
      }

      localStorage.removeItem("oauthRole");
      if (!cancelled) {
        // Reload the app so AuthProvider initializes from the newly stored
        // token. This is important for Google students who have no student
        // row until they enroll in their first course.
        window.location.replace("/");
      }
    }

    finishOAuth().catch((callbackError) => {
      if (!cancelled) setError(callbackError instanceof Error ? callbackError.message : "Google sign-in failed.");
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {error ? <p className="text-sm text-red-500">{error}</p> : <p className="text-sm text-gray-500">Completing Google sign-in...</p>}
      </div>
    </main>
  );
}
