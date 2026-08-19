import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SKALES Live in Winnipeg | DJ LANKZ & FRIENDS",
  description:
    "SKALES live in Winnipeg with special guest DANAGOG. Friday, October 9, 2026. DJ LANKZ & FRIENDS.",
  openGraph: {
    title: "SKALES Live in Winnipeg | DJ LANKZ & FRIENDS",
    description:
      "SKALES live in Winnipeg with special guest DANAGOG. Friday, October 9, 2026. DJ LANKZ & FRIENDS.",
    url: "https://allaccesswinnipeg.ca/events/dj-lankz-and-friends-skales-winnipeg",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
    images: [
      {
        url: "https://allaccesswinnipeg.ca/events/skales-hero.jpg",
        width: 1200,
        height: 630,
        alt: "SKALES Live in Winnipeg — DJ LANKZ & FRIENDS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SKALES Live in Winnipeg | DJ LANKZ & FRIENDS",
    description:
      "SKALES live in Winnipeg with special guest DANAGOG. Friday, October 9, 2026. DJ LANKZ & FRIENDS.",
  },
};

export default function DJLankzSkalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
