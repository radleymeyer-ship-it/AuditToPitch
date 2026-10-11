import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
   title: "Inbound Site Audit & Client Presentation Tool | AuditToPitch Pro",
  description:
    "An inbound site audit and client presentation tool for agencies and freelancers. Analyze requested client sites, prepare discovery proposals, and create white-label reports.",
  icons: { icon: "/brand-mark.png", shortcut: "/brand-mark.png", apple: "/brand-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
