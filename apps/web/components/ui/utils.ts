import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name merge helper for the components layer.
 *
 * It lives here rather than in a `lib/utils` junk drawer on purpose: the
 * architecture's dependency table has no such module, and a presentation-only
 * helper belongs inside the layer that uses it.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
