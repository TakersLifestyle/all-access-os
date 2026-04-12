"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CheckoutStatus() {
  const params = useSearchParams();
  const status = params.get("checkout");
  if (status === "success") {
    return (
      <div className="bg-green-950/50 border border-green-700 rounded-2xl p-4 text-green-300 text-sm">
        ✅ Payment successful! Your membership will be activated shortly.
      </div>
    );
  }
  if (status === "cancel") {
    return (
      <div className="bg-yellow-950/50 border border-yellow-700 rounded-2xl p-4 text-yellow-300 text-sm">
        Checkout cancelled. Subscribe anytime to activate your membership.
      </div>
    );
  }
  return null;
}

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !profile) return null;

  return (
    <main className="max-w-xl mx-auto px-6 py-12 space-y-8">
      <Suspense>
        <CheckoutStatus />
      </Suspense>

      <h1 className="text-3xl font-bold">Your Profile</h1>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-pink-600 flex items-center justify-center text-2xl font-bold">
            {(profile.displayName ?? profile.email ?? "M")[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{profile.displayName ?? "Member"}</p>
            <p className="text-white/40 text-sm">{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wide">Status</p>
            <p className={`font-semibold mt-1 ${profile.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
              {profile.status === "active" ? "Active Member" : "Inactive"}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wide">Role</p>
            <p className="font-semibold mt-1 capitalize">{profile.role}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
