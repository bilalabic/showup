import { Button } from "@/components/ui/button";

export const FRIENDBOT_URL = "https://friendbot.stellar.org";

export function XlmFundingNotice({
  address,
  children,
  title = "Add Testnet XLM to continue",
}: {
  address: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] px-5 py-5 text-sm text-amber-100">
      <p className="font-bold">{title}</p>
      <p className="mt-2 leading-6 text-amber-100/80">{children}</p>
      <Button asChild className="mt-4" size="sm" variant="warning">
        <a
          href={`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          Fund with Friendbot
        </a>
      </Button>
    </div>
  );
}
