import { NextRequest, NextResponse } from "next/server";
import { getAbstracts, searchPubmed } from "@/lib/pubmed";
import { allow, clientIp } from "@/lib/ratelimit";

// Used by Private mode: receives ONLY short search words or article numbers, never a report.
export async function GET(req: NextRequest) {
  if (!allow("research:" + clientIp(req), 120)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const q = req.nextUrl.searchParams.get("q");
  const ids = req.nextUrl.searchParams.get("ids");
  try {
    if (q) return NextResponse.json({ pmids: await searchPubmed(q.slice(0, 120), 5) });
    if (ids) return NextResponse.json({ articles: await getAbstracts(ids.split(",").slice(0, 8)) });
    return NextResponse.json({ error: "Missing q or ids." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
