import { fromStroops } from "@/lib/domain";
import { cn } from "@/components/ui/utils";

/**
 * The single way an amount reaches the screen.
 *
 * Conversion happens here, at render time, from integer stroops via
 * `lib/domain/amounts` — the same integer arithmetic the contract uses. The
 * `num` utility pins tabular figures so a column of bonds lines up and an
 * animated value never makes its neighbours shift.
 */
export function Money({
  className,
  stroops,
  unit = "USDC",
}: {
  className?: string;
  stroops: bigint;
  unit?: string | null;
}) {
  return (
    <span className={cn("num", className)}>
      {fromStroops(stroops)}
      {unit ? (
        <span className="ml-1 text-[0.78em] font-semibold text-slate-400">
          {unit}
        </span>
      ) : null}
    </span>
  );
}
