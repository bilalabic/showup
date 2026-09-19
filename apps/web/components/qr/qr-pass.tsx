"use client";

import { useEffect, useRef } from "react";

export function QrPass({ payload }: { payload: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    void (async () => {
      const { BrowserQRCodeSvgWriter } = await import("@zxing/browser");
      if (cancelled) return;

      const svg = new BrowserQRCodeSvgWriter().write(payload, 280, 280);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "ShowUp reservation QR code");
      svg.classList.add("h-auto", "w-full", "max-w-[280px]");
      container.replaceChildren(svg);
    })();

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [payload]);

  return (
    <div
      className="grid min-h-[280px] place-items-center rounded-3xl bg-white p-4"
      ref={containerRef}
    />
  );
}
