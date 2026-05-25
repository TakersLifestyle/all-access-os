"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/takers-ai",           label: "Dashboard",    icon: "⌂",  exact: true },
  { href: "/takers-ai/chat",      label: "Chat",         icon: "◎" },
  { href: "/takers-ai/agents",    label: "Agents",       icon: "✦" },
  { href: "/takers-ai/workflows", label: "Workflows",    icon: "⟳" },
  { href: "/takers-ai/approvals", label: "Approvals",    icon: "✓" },
  { href: "/takers-ai/memory",    label: "Brand Memory", icon: "◈" },
  { href: "/takers-ai/templates", label: "Templates",    icon: "◧" },
  { href: "/takers-ai/outputs",   label: "Saved Outputs",icon: "◫" },
  { href: "/takers-ai/feedback",  label: "Feedback Log", icon: "◉" },
  { href: "/takers-ai/tasks",     label: "Task Board",   icon: "◱" },
  { href: "/takers-ai/logs",      label: "Logs",         icon: "◐" },
  { href: "/takers-ai/settings",  label: "Settings",     icon: "◳" },
];

export default function TakersAILayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) return null;

  return (
    // Fixed overlay — covers global Nav/Footer entirely
    <div className="fixed inset-0 z-50 bg-[#09090f] flex overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-14"
        } shrink-0 flex flex-col border-r border-white/[0.07] bg-[#0d0d15] transition-all duration-200`}
      >
        {/* Logo area */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.07] gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-600/40 flex items-center justify-center text-red-400 hover:bg-red-600/30 transition shrink-0"
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              {sidebarOpen
                ? <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                : <path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              }
            </svg>
          </button>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="text-white text-xs font-bold tracking-wider truncate">TAKERS AI</p>
              <p className="text-white/30 text-[10px] truncate">Command Center</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition group ${
                  active
                    ? "bg-red-600/15 border border-red-600/25 text-red-300"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
                }`}
              >
                <span className={`text-base shrink-0 ${active ? "text-red-400" : "text-white/30 group-hover:text-white/50"}`}>
                  {item.icon}
                </span>
                {sidebarOpen && (
                  <span className="truncate font-medium text-xs">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom — back to site */}
        <div className={`p-3 border-t border-white/[0.07] ${sidebarOpen ? "" : "flex justify-center"}`}>
          <Link
            href="/admin"
            className="flex items-center gap-2 text-white/20 hover:text-white/50 text-xs transition"
            title="Back to Admin"
          >
            <span className="shrink-0">←</span>
            {sidebarOpen && <span className="truncate">Admin</span>}
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
