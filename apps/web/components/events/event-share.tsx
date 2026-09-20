"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { QrPass } from "@/components/qr/qr-pass";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/components/ui/utils";
import { buildPublicEventUrl } from "@/lib/domain/event-url";

function subscribeToBrowserReady(): () => void {
  return () => undefined;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some embedded browsers expose the API but deny it at runtime. Fall
      // through to the user-initiated DOM copy path before reporting failure.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("The browser rejected the copy request.");
    }
  } finally {
    textarea.remove();
  }
}

type EventShareProps = {
  eventId: string;
  title: string;
  showQr?: boolean;
  className?: string;
};

export function EventShare({
  eventId,
  title,
  showQr = false,
  className,
}: EventShareProps) {
  const browserReady = useSyncExternalStore(
    subscribeToBrowserReady,
    () => true,
    () => false,
  );
  const url = browserReady
    ? buildPublicEventUrl(window.location.origin, eventId)
    : "";
  const canShare = browserReady && typeof navigator.share === "function";

  async function copyLink() {
    try {
      await copyText(url);
      toast.success("Event link copied.");
    } catch {
      toast.error("Could not copy the event link.");
    }
  }

  async function shareEvent() {
    try {
      await navigator.share({
        title: `${title} · ShowUp`,
        text: `View ${title} on ShowUp.`,
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not open the share sheet.");
    }
  }

  return (
    <div
      aria-label="Share this event"
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
    >
      {canShare ? (
        <Button
          disabled={!url}
          onClick={() => void shareEvent()}
          size="sm"
          type="button"
          variant="secondary"
        >
          Share
        </Button>
      ) : null}
      <Button
        disabled={!url}
        onClick={() => void copyLink()}
        size="sm"
        type="button"
        variant="outline"
      >
        Copy link
      </Button>
      {showQr ? (
        <Dialog>
          <DialogTrigger asChild>
            <Button disabled={!url} size="sm" type="button" variant="outline">
              Event QR
            </Button>
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share event QR</DialogTitle>
              <DialogDescription className="leading-6 text-slate-400">
                Guests can scan this code to open the public event page. It is
                a link, not a reservation or check-in credential.
              </DialogDescription>
            </DialogHeader>
            {url ? (
              <QrPass label={`QR code for ${title}`} payload={url} />
            ) : null}
            <p className="break-all text-center font-mono text-xs leading-5 text-slate-400">
              {url}
            </p>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
