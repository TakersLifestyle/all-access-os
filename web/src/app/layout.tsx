import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Nav from "@/components/Nav";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ALL ACCESS Winnipeg",
  description: "Winnipeg's community experience platform — events, perks, and real connection for youth and young adults.",
};

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-24 py-8 px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/20 text-xs">
        <p>© {new Date().getFullYear()} ALL ACCESS Winnipeg. All rights reserved.</p>
        <div className="flex items-center gap-5">
          <Link href="/community" className="hover:text-white/50 transition">Community</Link>
          <Link href="/guidelines" className="hover:text-white/50 transition">Community Guidelines</Link>
          <Link href="/events" className="hover:text-white/50 transition">Events</Link>
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
        </AuthProvider>
      </body>
    </html>
  );
}
