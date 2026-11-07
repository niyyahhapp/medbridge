import { NextRequest, NextResponse } from "next/server";
import { getAbstracts, searchPubmed } from "@/lib/pubmed";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "fatty liver";
  try {
    const pmids = await searchPubmed(q, 5);
    const articles = await getAbstracts(pmids);
    return NextResponse.json({ query: q, pmids, articles });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
