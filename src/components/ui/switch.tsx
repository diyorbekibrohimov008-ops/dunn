import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-elevated p-0.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-ok data-[state=checked]:bg-ok/25",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-full bg-subtle transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=checked]:bg-ok",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
