import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/components/ui/utils";

/**
 * The single button in the product, mapped onto ShowUp's palette rather than
 * shadcn's default one.
 *
 * Three things are deliberate:
 *  - the press scale is a `transform`, so it never triggers layout;
 *  - `motion-reduce:` cancels it for anyone who asked for less movement;
 *  - every size clears a 44 px touch target.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full",
    "text-sm font-bold tracking-tight",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-micro) ease-(--ease-out-soft)",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "active:scale-[0.97] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-brand text-primary-foreground shadow-[0_0_0_0_rgba(77,230,198,0)] hover:bg-brand-soft hover:shadow-[0_8px_30px_-8px_rgba(77,230,198,0.55)]",
        secondary:
          "bg-white/10 text-white hover:bg-white/15",
        outline:
          "border border-white/15 text-white hover:border-brand/60 hover:bg-white/5",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-brand-soft",
        destructive:
          "bg-rose-400/15 text-rose-100 ring-1 ring-inset ring-rose-400/30 hover:bg-rose-400/25",
        warning:
          "bg-amber-300 text-slate-950 hover:bg-amber-200",
        link: "h-auto min-h-0 rounded-none px-0 text-brand underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-11 px-4 py-2 text-[13px]",
        lg: "min-h-[3.25rem] px-7 py-3 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
}

export { Button, buttonVariants };
