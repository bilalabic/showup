import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/layout/site-header";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { NetworkGuard } from "@/components/wallet/network-guard";
import { WalletProvider } from "@/lib/wallet/provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShowUp — Attendance that pays back",
  description:
    "Programmable attendance commitment bonds on Stellar Testnet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-white">
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
            <Toaster />
          </WalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
