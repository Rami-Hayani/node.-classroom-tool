"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen, GraduationCap, Users, Settings } from "lucide-react";
import { motion } from "framer-motion";

interface StudentTopNavProps { studentId: string; email?: string | null }

export default function StudentTopNav({ studentId, email }: StudentTopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = [
    { label: "Node Map", icon: BookOpen, href: `/student/${studentId}` },
    { label: "Tutoring", icon: GraduationCap, href: `/student/${studentId}/tutor` },
    { label: "Study Buddy", icon: Users, href: `/student/${studentId}/study-group` },
    { label: "Profile", icon: Settings, href: `/student/${studentId}/profile` },
  ];

  return (
    <header className="relative z-20 flex h-[68px] shrink-0 items-center justify-between overflow-visible bg-black px-7 text-white shadow-sm">
      <button onClick={() => router.push(`/student/${studentId}`)} className="font-[family-name:var(--font-geist-sans)] font-medium text-2xl tracking-tight">node.</button>
      <nav className="flex h-full items-center gap-1">
        {tabs.map(({ label, icon: Icon, href }) => {
          const active = pathname === href || (label !== "Node Map" && pathname.startsWith(`${href}/`));
          return <button key={href} onClick={() => router.push(href)} className={`relative flex h-full items-center gap-2 px-4 text-xs transition-colors duration-300 active:scale-100 ${active ? "text-white" : "text-white/55 hover:text-white"}`}>
            <Icon size={15} /><span className="relative z-10">{label}</span>
            {active && <motion.span layoutId="student-nav-nudge" transition={{ type: "spring", stiffness: 430, damping: 32 }} className="absolute -bottom-1.5 left-1/2 z-0 h-3 w-28 -translate-x-1/2 rounded-t-[20px] bg-white" />}
          </button>;
        })}
      </nav>
      <div className="hidden max-w-[180px] truncate text-right text-[11px] text-white/65 sm:block">{email || "Student"}</div>
    </header>
  );
}
