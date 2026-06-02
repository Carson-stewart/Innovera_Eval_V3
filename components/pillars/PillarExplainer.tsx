"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { useState } from "react";
import { PILLAR_EXPLANATIONS } from "@/lib/pillars/explanations";

interface PillarExplainerProps {
  pillarKey: string;
  /** Score to show alongside the name (optional — used in Score Breakdown) */
  score?: number;
  /** Open by default — false unless caller opts in (e.g. Scoring Guide) */
  defaultOpen?: boolean;
}

/**
 * Collapsible explainer block for a single pillar/dimension.
 * Trigger = pillar name + chevron affordance (orange when open).
 * Content = stage label + detail text; expands in-place, no layout shift.
 * Reads from PILLAR_EXPLANATIONS — never hardcodes text.
 */
export function PillarExplainer({
  pillarKey,
  score,
  defaultOpen = false,
}: PillarExplainerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const exp = PILLAR_EXPLANATIONS[pillarKey];

  if (!exp) return null;

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen}>
      <CollapsiblePrimitive.Trigger asChild>
        <button
          className="
            group flex w-full items-center justify-between gap-3
            rounded-md px-3 py-2 text-left text-sm
            hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-brand-orange-ring transition-colors
          "
          aria-expanded={open}
        >
          {/* Left: key badge + name + optional score */}
          <span className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-600">
              {pillarKey}
            </span>
            <span className="font-medium text-gray-800 truncate">{exp.name}</span>
            {score !== undefined && (
              <span className="ml-1 text-xs text-gray-500">{score.toFixed(2)}</span>
            )}
          </span>

          {/* Right: stage label + chevron */}
          <span className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs text-gray-400">{exp.stage}</span>
            {/* Chevron — rotates 180° when open */}
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${
                open ? "rotate-180 text-brand-orange" : "text-gray-400 group-hover:text-gray-600"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>
      </CollapsiblePrimitive.Trigger>

      {/* Content — expands in-place below the trigger, no layout shift above */}
      <CollapsiblePrimitive.Content className="overflow-hidden data-[state=open]:animate-none">
        <div className="px-3 pb-3 pt-1">
          <p className="text-xs leading-relaxed text-gray-500">{exp.detail}</p>
        </div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
