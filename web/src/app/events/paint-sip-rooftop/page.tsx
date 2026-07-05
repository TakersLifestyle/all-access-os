"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirects to the canonical Sunset Sessions Vol. 01 page
export default function PaintSipRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/series/sunset-sessions/vol-01");
  }, [router]);
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/30 text-sm">Redirecting...</p>
    </div>
  );
}
