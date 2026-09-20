"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { copyText } from "@/components/ui/copy-text";

/**
 * The connected account, in full, with one-tap copy.
 *
 * This exists because funding a Testnet account means pasting its address into
 * friendbot or the Circle faucet, and an address the app never shows is an
 * address the user has to find somewhere else — which is exactly how funds end
 * up in the wrong account.
 */
export function AccountAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await copyText(address);
      setCopied(true);
      toast.success("Address copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the address and copy it manually.");
    }
  }

  return (
    <div className="glass mt-8 rounded-3xl px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Connected account
        </p>
        <Button onClick={onCopy} size="sm" type="button" variant="outline">
          {copied ? "Copied" : "Copy address"}
        </Button>
      </div>
      <p className="num mt-3 break-all text-sm text-slate-200 select-all">
        {address}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Fund this exact address. Anything sent elsewhere will not appear here.
      </p>
    </div>
  );
}
