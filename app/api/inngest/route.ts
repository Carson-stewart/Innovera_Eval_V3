import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { scoreMemo } from "@/inngest/functions/scoreMemo";
import { sanityCheck } from "@/inngest/functions/sanityCheck";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scoreMemo, sanityCheck],
});
