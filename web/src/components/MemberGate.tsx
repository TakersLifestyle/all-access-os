"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function MemberGate({ children }: { children: React.ReactNode }) {
  const { user, isActive, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-white/50">Log in or join to access this content.</p>
        <div className="flex gap-3">
          <Link href="/login" className="border border-white/20 px-6 py-2 rounded-xl hover:border-white/40 transition">
            Log in
          </Link>
          <Link href="/signup" className="bg-pink-600 hover:bg-pink-500 px-6 py-2 rounded-xl font-medium transition">
            Join Now
          </Link>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <h2 className="text-2xl font-bold">Subscribe to Access</h2>
        <p className="text-white/50 max-w-sm">
          Your account exists but your membership isn&apos;t active yet.
        </p>
        <Link href="/" className="bg-pink-600 hover:bg-pink-500 px-6 py-2 rounded-xl font-medium transition">
          Subscribe Now
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
