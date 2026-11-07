import { explain, provider } from "@/lib/agent";
import { basicExplain, preparedExplain } from "@/lib/basic";
import { findPrepared } from "@/lib/prepared";
import { SAMPLE_REPORTS } from "@/lib/reports";
import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60; // local models can be slower; this only applies on Vercel

const PER_PERSON = Number(process.env.EXPLAIN_LIMIT_PER_PERSON || 15);
const TOTAL = Number(process.env.EXPLAIN_LIMIT_TOTAL || 150);

export async function POST(req: Request) {
  let report = "";
  try {
    report = String((await req.json())?.report ?? "").trim();
  } catch {}

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (report.length < 10) throw new Error("Please paste a report first.");
        if (report.length > 6000) throw new Error("This report is too long for the demo. Please paste a shorter one.");
        if (!allow("ip:" + clientIp(req), PER_PERSON) || !allow("total", TOTAL)) {
          throw new Error("The demo is busy right now. Please try again in a little while.");
        }
        const prepared = findPrepared(report, SAMPLE_REPORTS);
        const data = provider()
          ? await explain(report, emit)
          : prepared
            ? await preparedExplain(prepared, emit)
            : await basicExplain(report, emit);
        emit({ type: "result", data });
      } catch (e) {
        console.error("explain failed:", e);
        emit({ type: "error", message: (e as Error).message || "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
