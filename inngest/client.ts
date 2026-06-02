import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "innovera-eval-v3",
  eventKey: process.env.INNGEST_EVENT_KEY ?? "local",
});
