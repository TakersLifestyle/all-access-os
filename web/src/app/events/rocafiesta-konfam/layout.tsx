import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROCAFIESTA — A Spiritual Experience with Konfam",
  description:
    "September 5, 2026 • Winnipeg. Experience ROCAFIESTA with Konfam — music, community and an unforgettable night with ALL ACCESS Winnipeg.",
  alternates: {
    canonical: "https://allaccesswinnipeg.ca/events/rocafiesta-konfam",
  },
  openGraph: {
    title: "ROCAFIESTA — A Spiritual Experience with Konfam",
    description:
      "September 5, 2026 • Winnipeg. Experience ROCAFIESTA with Konfam — music, community and an unforgettable night with ALL ACCESS Winnipeg.",
    url: "https://allaccesswinnipeg.ca/events/rocafiesta-konfam",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
    images: [
      {
        url: "https://allaccesswinnipeg.ca/og/rocafiesta-og.jpg",
        width: 1200,
        height: 630,
        alt: "ROCAFIESTA — A Spiritual Experience with Konfam | ALL ACCESS Winnipeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ROCAFIESTA — A Spiritual Experience with Konfam",
    description:
      "September 5, 2026 • Winnipeg. Experience ROCAFIESTA with Konfam — music, community and an unforgettable night with ALL ACCESS Winnipeg.",
    images: ["https://allaccesswinnipeg.ca/og/rocafiesta-og.jpg"],
  },
};

export default function RocafiestaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
