import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROCAFIESTA — Konfam's First Headline Show | ALL ACCESS Winnipeg",
  description:
    "A Spiritual Experience with Konfam. September 5, 2026 · Winnipeg, MB. Faith, music, culture, and community. Get your tickets — Early Bird $15.",
  openGraph: {
    title: "ROCAFIESTA — Konfam's First Headline Show",
    description:
      "A Spiritual Experience with Konfam. September 5, 2026 · Winnipeg, MB. Get your tickets at ALL ACCESS Winnipeg.",
    url: "https://allaccesswinnipeg.ca/events/rocafiesta-konfam",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ROCAFIESTA — Konfam's First Headline Show",
    description:
      "September 5, 2026 · Winnipeg, MB. Early Bird tickets from $15. ALL ACCESS Winnipeg.",
  },
};

export default function RocafiestaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
