"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) return null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { title: "Manage Events", desc: "Create, edit, and delete events.", href: "/admin/events" },
          { title: "Manage Perks", desc: "Add and update member perks.", href: "/admin/perks" },
          { title: "Manage Users", desc: "View members and manage access.", href: "/admin/users" },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 space-y-2 transition group"
          >
            <h2 className="font-semibold text-lg group-hover:text-amber-400 transition">{item.title}</h2>
            <p className="text-white/50 text-sm">{item.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
