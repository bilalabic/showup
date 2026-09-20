import type { Metadata } from "next";
import { Geist, Space_Grotesk, Space_Mono } from "next/font/google";

import { SiteHeader } from "@/components/layout/site-header";
import { TechnicalDetails } from "@/components/debug/technical-details";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { NetworkGuard } from "@/components/wallet/network-guard";
import { WalletProvider } from "@/lib/wallet/provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "ShowUp — Attendance that pays back",
  description:
    "Programmable attendance commitment bonds on Stellar Testnet.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full text-white">
        {/* A faint grain over the whole app. Large flat dark fields band on
            cheap panels; this costs one fixed, pointer-transparent layer. */}
        <div
          aria-hidden="true"
          className="grain-overlay pointer-events-none fixed inset-0 z-50"
        />
        <MotionProvider>
          <WalletProvider>
            <NetworkGuard />
            <SiteHeader />
            {children}
            <TechnicalDetails />
            <Toaster />
          </WalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
