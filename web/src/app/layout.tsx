import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Nav from "@/components/Nav";
import Link from "next/link";
import OpenClaw from "@/components/OpenClaw";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ALL ACCESS Winnipeg",
  description: "Winnipeg's community-first social platform. Safe events, real connection, premium experiences. Founding 15 — Sea Bears Courtside Launch, June 30, 2026.",
  openGraph: {
    title: "ALL ACCESS Winnipeg — Founding 15",
    description: "15 tickets. June 30, 2026. Sea Bears Courtside Launch. $300 flat. Dinner, transport, courtside. This is how ALL ACCESS begins.",
    url: "https://allaccesswinnipeg.ca",
    siteName: "ALL ACCESS Winnipeg",
    images: [
      {
        url: "https://allaccesswinnipeg.ca/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ALL ACCESS Winnipeg — Sea Bears Courtside Launch — Founding 15",
      },
    ],
    locale: "en_CA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ALL ACCESS Winnipeg — Founding 15",
    description: "15 tickets. June 30, 2026. Sea Bears Courtside. $300 flat. This is how ALL ACCESS begins.",
    images: ["https://allaccesswinnipeg.ca/opengraph-image"],
  },
};

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-24 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-white/20 text-xs">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <p className="text-white/40 font-semibold tracking-wide">ALL ACCESS Winnipeg</p>
          <p>© {new Date().getFullYear()} All rights reserved.</p>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/community" className="hover:text-white/50 transition">Community</Link>
          <Link href="/guidelines" className="hover:text-white/50 transition">Guidelines</Link>
          <Link href="/events" className="hover:text-white/50 transition">Events</Link>
          <Link href="/about" className="hover:text-white/50 transition">About</Link>
        </div>
        <div className="flex items-center gap-4">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/allaccesswinnipeg/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-white/25 hover:text-pink-500 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          {/* TikTok */}
          <a
            href="https://www.tiktok.com/@allaccesswinnipeg"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="text-white/25 hover:text-pink-500 transition"
          >
            <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0e0a1a] text-white min-h-screen flex flex-col`}>
        <AuthProvider>
          <Nav />
          <div className="flex-1">{children}</div>
          <Footer />
          <OpenClaw />
        </AuthProvider>
      </body>
    </html>
  );
}
