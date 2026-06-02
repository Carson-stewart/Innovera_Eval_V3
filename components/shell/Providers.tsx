"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/**
 * Client-side providers that must wrap the whole app.
 * Lives here so the root layout (server component) stays clean.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}
