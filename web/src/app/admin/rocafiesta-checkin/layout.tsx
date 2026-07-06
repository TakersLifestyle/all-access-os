import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROCAFIESTA Door Check-In | ALL ACCESS Admin",
  description: "Scan QR codes and manage guest entry for ROCAFIESTA — A Spiritual Experience with Konfam. Pyramid Cabaret, August 5, 2026.",
  robots: { index: false, follow: false },
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
