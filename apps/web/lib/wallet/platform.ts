export type WalletPlatformSignals = {
  userAgent: string;
  maxTouchPoints: number;
  freighterPlatform?: string;
};

export function prefersMobileWallet({
  userAgent,
  maxTouchPoints,
  freighterPlatform,
}: WalletPlatformSignals): boolean {
  if (freighterPlatform === "mobile") return true;

  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent)) {
    return true;
  }

  // iPadOS can identify itself as macOS while using a touch screen.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function isMobileWalletBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const stellar = window as typeof window & {
    stellar?: { platform?: string };
  };

  return prefersMobileWallet({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    freighterPlatform: stellar.stellar?.platform,
  });
}
