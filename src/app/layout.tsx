import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Wapi Pesa — Personal M-Pesa analytics showcase",
  description:
    "A technical showcase for privacy-conscious personal M-Pesa statement parsing, analytics, and report generation. Public uploads and payments are disabled.",
  openGraph: {
    title: "Wapi Pesa — Personal M-Pesa analytics showcase",
    description:
      "A technical showcase for privacy-conscious personal M-Pesa statement parsing, analytics, and report generation. Public uploads and payments are disabled.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} h-full`}>
      <body className="relative min-h-full flex flex-col font-[family-name:var(--font-body)] antialiased overflow-x-hidden">
        {/* Drifting accent orbs — sit between page bg mesh and content */}
        <div
          aria-hidden
          className="pointer-events-none fixed -top-40 -left-32 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-25 animate-orb-1"
          style={{ background: "radial-gradient(circle, rgba(255,106,74,0.55), transparent 60%)", zIndex: -1 }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed top-1/3 -right-40 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-20 animate-orb-2"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.55), transparent 60%)", zIndex: -1 }}
        />
        {children}
      </body>
    </html>
  );
}
