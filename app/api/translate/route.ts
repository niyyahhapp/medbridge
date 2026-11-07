import { aiTranslate, type Explanation } from "@/lib/agent";
import { LANGUAGES } from "@/lib/languages";
import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Translates the EXPLANATION (never the original report). Nothing is stored.
// Uses DeepL when DEEPL_API_KEY is set, otherwise the connected AI.

function collect(d: Explanation): string[] {
  return [
    d.summary,
    ...d.terms.flatMap((t) => [t.term, t.plain_meaning, t.in_your_document]),
    ...d.findings.map((f) => f.explanation),
    ...d.research.flatMap((r) => [r.what_it_found, r.limitation]),
    d.follow_up,
    ...d.questions_to_ask,
    d.caution,
  ];
}

function rebuild(d: Explanation, t: string[]): Explanation {
  let i = 0;
  const n = () => t[i++] ?? "";
  return {
    summary: n(),
    terms: d.terms.map(() => ({ term: n(), plain_meaning: n(), in_your_document: n() })),
    // Quotes from the report stay exactly as written, so they match the patient's paper.
    findings: d.findings.map((f) => ({ from_document: f.from_document, explanation: n() })),
    // Article titles stay in their original language: they are the real PubMed titles.
    research: d.research.map((r) => ({ ...r, what_it_found: n(), limitation: n() })),
    organ_for_visual: d.organ_for_visual,
    follow_up: n(),
    questions_to_ask: d.questions_to_ask.map(() => n()),
    caution: n(),
  };
}

async function deepl(texts: string[], target: string): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY!;
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const res = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: { authorization: `DeepL-Auth-Key ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts.map((t) => t || " "), target_lang: target, preserve_formatting: true }),
  });
  if (!res.ok) throw new Error(`Translation error (${res.status}).`);
  const data = await res.json();
  return (data.translations ?? []).map((x: { text: string }) => x.text.trim());
}

export async function POST(req: Request) {
  if (!allow("translate:" + clientIp(req), 40)) {
    return Response.json({ error: "Too many translations. Please wait a little." }, { status: 429 });
  }
  try {
    const { data, lang } = (await req.json()) as { data: Explanation; lang: string };
    const language = LANGUAGES.find((l) => l.code === lang);
    if (!language || !data?.summary) return Response.json({ error: "Unknown language." }, { status: 400 });
    const texts = collect(data);
    const translated = process.env.DEEPL_API_KEY ? await deepl(texts, language.deepl) : await aiTranslate(texts, language.name);
    return Response.json({ data: rebuild(data, translated), by: process.env.DEEPL_API_KEY ? "DeepL" : "AI" });
  } catch (e) {
    console.error("translate failed:", (e as Error).message.match(/\d{3}/)?.[0] ?? "error"); // code only
    return Response.json({ error: (e as Error).message || "Translation failed." }, { status: 500 });
  }
}
