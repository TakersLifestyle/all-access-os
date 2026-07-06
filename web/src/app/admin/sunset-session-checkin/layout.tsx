import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Check-In — Sunset Sessions Vol. 01 | ALL ACCESS",
  description: "Door check-in for Sunset Sessions Vol. 01 — Rooftop Sip & Paint Experience. July 31, 2026. Scan QR codes at the door.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "🎨 Admin Check-In — Sunset Sessions Sip & Paint",
    description: "Door check-in · Sunset Sessions Vol. 01 · July 31, 2026 · Premium Rooftop Venue, Winnipeg",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Admin Check-In — Sunset Sessions Sip & Paint",
    description: "Door check-in for Sunset Sessions Vol. 01 — Sip & Paint Experience.",
  },
};

export default function SunsetSessionCheckinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
