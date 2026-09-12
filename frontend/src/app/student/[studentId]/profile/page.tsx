"use client";

import { useParams, useRouter } from "next/navigation";
import StudentTopNav from "@/components/student/StudentTopNav";
import { useAuth } from "@/lib/auth-context";

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  return <div className="min-h-screen bg-gray-50 text-gray-800">
    <StudentTopNav studentId={studentId} email={user?.email} />
    <main className="mx-auto max-w-3xl p-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Account</p>
        <h1 className="mt-2 text-3xl font-medium text-gray-800">Profile & settings</h1>
        <div className="mt-8 space-y-4 border-t border-gray-100 pt-5 text-sm">
          <div><p className="text-xs text-gray-400">Name</p><p className="mt-1 font-medium">{profile?.name || "Student"}</p></div>
          <div><p className="text-xs text-gray-400">Email</p><p className="mt-1 font-medium">{user?.email || "—"}</p></div>
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={() => router.push(`/student/${studentId}`)} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white">Back to Node Map</button>
          <button onClick={async () => { await signOut(); router.push("/"); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600">Sign out</button>
        </div>
      </div>
    </main>
  </div>;
}
