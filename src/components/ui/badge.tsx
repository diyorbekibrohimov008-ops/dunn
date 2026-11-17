import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-medium tracking-wide uppercase",
  {
    variants: {
      tone: {
        muted: "bg-elevated text-muted border border-border",
        paper: "bg-primary/15 text-primary",
        danger: "bg-danger/15 text-danger",
        warn: "bg-warn/15 text-warn",
        ok: "bg-ok/15 text-ok",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
