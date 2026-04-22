import { CommunityGuidelinesCard } from "@/components/CommunityGuidelines";
import Link from "next/link";

export const metadata = {
  title: "Community Guidelines — ALL ACCESS Winnipeg",
};

export default function GuidelinesPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16 space-y-8">
      <Link href="/community" className="text-white/30 hover:text-white/60 text-sm transition flex items-center gap-2">
        ← Back to Community
      </Link>
      <CommunityGuidelinesCard />
    </main>
  );
}
