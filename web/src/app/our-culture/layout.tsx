import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OUR CULTURE — ALL ACCESS Winnipeg",
  description: "Honest couch conversations with artists, entrepreneurs, athletes, creators, business owners, and community leaders shaping Winnipeg.",
  openGraph: {
    title: "OUR CULTURE — ALL ACCESS Winnipeg",
    description: "Stories behind the people shaping Winnipeg. Honest couch conversations documenting Winnipeg's creative, business, sports, and community culture.",
    url: "https://allaccesswinnipeg.ca/our-culture",
    siteName: "ALL ACCESS Winnipeg",
    images: [{ url: "https://allaccesswinnipeg.ca/opengraph-image", width: 1200, height: 630 }],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OUR CULTURE — ALL ACCESS Winnipeg",
    description: "Honest couch conversations with the people building Winnipeg.",
    images: ["https://allaccesswinnipeg.ca/opengraph-image"],
  },
};

export default function OurCultureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
