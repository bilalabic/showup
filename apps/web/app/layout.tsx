import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import { ConnectButton } from "@/components/wallet/connect-button";
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
        <WalletProvider>
          <NetworkGuard />
          <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
            <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
              <Link
                className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
                href="/"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-cyan-300 font-mono text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(103,232,249,0.2)]">
                  SU
                </span>
                <span>
                  <span className="block text-base font-black tracking-tight">
                    ShowUp
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Stellar Testnet
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-2 sm:gap-5">
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  href="/wallet"
                >
                  Wallet
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  href="/organizer"
                >
                  Organizer
                </Link>
                <ConnectButton />
              </div>
            </div>
          </header>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
