import { NextRequest, NextResponse } from "next/server";
import { defineTerm } from "@/lib/define";
import { allow, clientIp } from "@/lib/ratelimit";

// Receives ONE medical word (never a report) and returns its patient-friendly meaning.
export async function GET(req: NextRequest) {
  if (!allow("define:" + clientIp(req), 200)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const term = (req.nextUrl.searchParams.get("term") ?? "").slice(0, 60).trim();
  if (!term) return NextResponse.json({ error: "Missing term." }, { status: 400 });
  return NextResponse.json({ definition: await defineTerm(term) });
}
