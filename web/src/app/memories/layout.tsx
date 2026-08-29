import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "4,000+ Community Memories | ALL ACCESS Winnipeg",
  description:
    "Winnipeg, you might be in here 👀 Explore 4,000+ photos from concerts, festivals, nightlife, sports and community experiences across Winnipeg.",
  openGraph: {
    title: "4,000+ Community Memories | ALL ACCESS Winnipeg",
    description:
      "Winnipeg, you might be in here 👀 Explore 4,000+ photos from concerts, festivals, nightlife, sports and community experiences across Winnipeg.",
    url: "https://allaccesswinnipeg.ca/memories",
    siteName: "ALL ACCESS Winnipeg",
    locale: "en_CA",
    type: "website",
    images: [
      {
        url: "https://allaccesswinnipeg.ca/memories/opengraph-image",
        width: 1200,
        height: 630,
        alt: "4,000+ Community Memories — ALL ACCESS Winnipeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "4,000+ Community Memories | ALL ACCESS Winnipeg",
    description:
      "Winnipeg, you might be in here 👀 Explore 4,000+ photos from concerts, festivals, nightlife, sports and community experiences.",
    images: ["https://allaccesswinnipeg.ca/memories/opengraph-image"],
  },
};

export default function MemoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
