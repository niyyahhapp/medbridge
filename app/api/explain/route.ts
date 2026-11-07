import { explain, provider } from "@/lib/agent";
import { basicExplain, preparedExplain } from "@/lib/basic";
import { findPrepared } from "@/lib/prepared";
import { SAMPLE_REPORTS } from "@/lib/reports";
import { allow, clientIp } from "@/lib/ratelimit";
import { redact } from "@/lib/redact";

export const runtime = "nodejs";
export const maxDuration = 120; // seconds; free AI tiers can be slow when busy

const PER_PERSON = Number(process.env.EXPLAIN_LIMIT_PER_PERSON || 15);
const TOTAL = Number(process.env.EXPLAIN_LIMIT_TOTAL || 150);

export async function POST(req: Request) {
  let report = "";
  let privateMode = false;
  try {
    const body = await req.json();
    // Second safety net: remove personal details again on the server.
    report = redact(String(body?.report ?? "")).text.trim();
    privateMode = body?.privateMode === true;
  } catch {}
  // The report is never stored or logged. It only lives in memory for this request.

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
        const data = provider() && !privateMode
          ? await explain(report, emit)
          : prepared
            ? await preparedExplain(prepared, emit)
            : await basicExplain(report, emit);
        emit({ type: "result", data });
      } catch (e) {
        console.error("explain failed:", (e as Error).message); // message only, never the report
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
