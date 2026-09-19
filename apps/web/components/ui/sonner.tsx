"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * ShowUp renders a single dark theme, so the theme is pinned rather than read
 * from a theme provider. Toasts carry transient news only — the persistent
 * transaction panel stays on the page and remains the authority on what the
 * ledger has actually confirmed.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-white/12 !bg-slate-900/90 !text-slate-100 !backdrop-blur-xl !shadow-2xl !shadow-black/50",
          description: "!text-slate-400",
          actionButton: "!bg-cyan-300 !text-slate-950 !font-bold",
          cancelButton: "!bg-white/10 !text-slate-200",
          success: "!border-emerald-300/30",
          error: "!border-rose-400/30",
          warning: "!border-amber-300/30",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
