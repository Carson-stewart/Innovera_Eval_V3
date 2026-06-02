"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { PILLAR_EXPLANATIONS } from "@/lib/pillars/explanations";

interface PillarTooltipProps {
  pillarKey: string;
  children: React.ReactNode;
}

/**
 * Wraps any element in a hover/focus tooltip showing the pillar's one-line gloss.
 * Reads from PILLAR_EXPLANATIONS — never hardcodes text.
 *
 * The TooltipProvider must live above this in the tree (added to root layout).
 */
export function PillarTooltip({ pillarKey, children }: PillarTooltipProps) {
  const exp = PILLAR_EXPLANATIONS[pillarKey];

  // Unknown key: render children unchanged — graceful degradation
  if (!exp) return <>{children}</>;

  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="
            z-50 max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg
            animate-in fade-in-0 zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          "
        >
          <span className="font-semibold text-white">{exp.name}</span>
          <span className="text-gray-300"> — </span>
          <span className="text-gray-200">{exp.gloss}</span>
          <TooltipPrimitive.Arrow className="fill-gray-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
