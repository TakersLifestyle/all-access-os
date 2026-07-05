import type { Metadata } from "next";

const EVENT_META: Record<string, { title: string; description: string; url: string }> = {
  "vol-01": {
    title: "Rooftop Paint & Sip — Sunset Sessions Vol. 01 | ALL ACCESS Winnipeg",
    description:
      "An evening of art, wine, and golden hour on a Winnipeg rooftop. July 31, 2026. Tickets from $60 (members) · $80 general admission. Limited spots.",
    url: "https://allaccesswinnipeg.ca/series/sunset-sessions/vol-01",
  },
};

export async function generateMetadata({
  params,
}: {
  params: { eventSlug: string };
}): Promise<Metadata> {
  const meta = EVENT_META[params.eventSlug] ?? {
    title: "Sunset Sessions | ALL ACCESS Winnipeg",
    description:
      "Community events built for Winnipeg — art, culture, and real connection. ALL ACCESS Winnipeg.",
    url: "https://allaccesswinnipeg.ca/series/sunset-sessions",
  };

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.url,
      siteName: "ALL ACCESS Winnipeg",
      locale: "en_CA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default function EventSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
