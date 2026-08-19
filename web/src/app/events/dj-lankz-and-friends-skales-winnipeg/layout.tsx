import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DJ LANKZ & FRIENDS — SKALES LIVE IN WINNIPEG | ALL ACCESS Winnipeg",
  description:
    "SKALES LIVE IN WINNIPEG with special guest DANAGOG. October 9, 2026 · 265 Portage Ave, Winnipeg, MB · Doors 10 PM · 18+. Presented by DJ LANKZ & ALL ACCESS Winnipeg.",
  openGraph: {
    title: "DJ LANKZ & FRIENDS — SKALES LIVE IN WINNIPEG",
    description:
      "SKALES LIVE IN WINNIPEG with special guest DANAGOG. October 9, 2026 · Winnipeg, MB. Presented by DJ LANKZ & ALL ACCESS Winnipeg.",
    url: "https://allaccesswinnipeg.ca/events/dj-lankz-and-friends-skales-winnipeg",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
    images: [
      {
        url: "https://allaccesswinnipeg.ca/events/skales-hero.jpg",
        width: 1200,
        height: 630,
        alt: "SKALES LIVE IN WINNIPEG — DJ LANKZ & FRIENDS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DJ LANKZ & FRIENDS — SKALES LIVE IN WINNIPEG",
    description:
      "October 9, 2026 · 265 Portage Ave, Winnipeg, MB · Doors 10 PM · 18+. ALL ACCESS Winnipeg.",
  },
};

export default function DJLankzSkalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
