import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Check-In — ROCAFIESTA | ALL ACCESS",
  description: "Door check-in for ROCAFIESTA — A Spiritual Experience with Konfam. Pyramid Cabaret, September 5, 2026. Scan QR codes at the door.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Admin Check-In — ROCAFIESTA",
    description: "Door check-in for ROCAFIESTA — A Spiritual Experience with Konfam. Pyramid Cabaret · Aug 5, 2026.",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Admin Check-In — ROCAFIESTA",
    description: "Door check-in for ROCAFIESTA — A Spiritual Experience with Konfam.",
  },
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
