import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Agency Operations Hub", template: "%s · Ops Hub" },
  description:
    "Internal operations for a digital agency: tasks, client requests, knowledge base, audit trail and Slack notifications.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" className={`${plex.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh font-sans">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
