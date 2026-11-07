/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed external API data */
import { Article, getAbstracts, searchPubmed } from "./pubmed";
import { SYSTEM_PROMPT } from "./prompt";

export type Explanation = {
  summary: string;
  terms: { term: string; plain_meaning: string; in_your_document: string }[];
  findings: { from_document: string; explanation: string }[];
  research: { pmid: string; title: string; year: string; what_it_found: string; limitation: string }[];
  organ_for_visual: string;
  follow_up: string;
  questions_to_ask: string[];
  caution: string;
};

export type Step = "read" | "search_pubmed" | "get_abstracts" | "write";
export type Emit = (event: Record<string, unknown>) => void;

const MAX_ROUNDS = 6;

const TOOL_DEFS = [
  {
    name: "search_pubmed",
    description:
      "Search PubMed for research articles. Returns a list of PMIDs. Use short English search words.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Search words, e.g. 'fatty liver lifestyle'" } },
      required: ["query"],
    },
  },
  {
    name: "get_abstracts",
    description: "Get the title, year, journal and abstract for up to 5 PMIDs.",
    parameters: {
      type: "object",
      properties: { pmids: { type: "array", items: { type: "string" } } },
      required: ["pmids"],
    },
  },
];

export function provider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Runs one tool and records every article actually retrieved. */
async function runTool(
  name: string,
  input: any,
  seen: Map<string, Article>,
  emit: Emit
): Promise<string> {
  try {
    if (name === "search_pubmed") {
      const query = String(input?.query ?? "").slice(0, 200);
      emit({ type: "step", step: "search_pubmed", status: "running", detail: query });
      const pmids = await searchPubmed(query, 6);
      emit({ type: "step", step: "search_pubmed", status: "done", detail: `${query} · ${pmids.length} found` });
      return JSON.stringify({ query, pmids, note: pmids.length ? undefined : "No results. Try shorter words." });
    }
    if (name === "get_abstracts") {
      const pmids: string[] = Array.isArray(input?.pmids) ? input.pmids.map(String).slice(0, 5) : [];
      emit({ type: "step", step: "get_abstracts", status: "running", detail: pmids.join(", ") });
      const articles = await getAbstracts(pmids);
      articles.forEach((a) => seen.set(a.pmid, a));
      emit({ type: "step", step: "get_abstracts", status: "done", detail: `${articles.length} abstracts read` });
      return JSON.stringify(articles);
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

// ---------- Provider calls ----------

type Turn = { text: string; calls: { id: string; name: string; input: any }[]; raw: any };

async function anthropicCall(messages: any[], withTools: boolean): Promise<Turn> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages,
      tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      ...(withTools ? {} : { tool_choice: { type: "none" } }),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`AI error ${res.status}: ${data?.error?.message ?? "unknown"}`);
  const content: any[] = data.content ?? [];
  return {
    text: content.filter((c) => c.type === "text").map((c) => c.text).join(""),
    calls: content.filter((c) => c.type === "tool_use").map((c) => ({ id: c.id, name: c.name, input: c.input })),
    raw: content,
  };
}

async function openaiCall(messages: any[], withTools: boolean): Promise<Turn> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: TOOL_DEFS.map((t) => ({ type: "function", function: t })),
      ...(withTools ? {} : { tool_choice: "none" }),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`AI error ${res.status}: ${data?.error?.message ?? "unknown"}`);
  const msg = data.choices?.[0]?.message ?? {};
  return {
    text: msg.content ?? "",
    calls: (msg.tool_calls ?? []).map((c: any) => ({
      id: c.id,
      name: c.function?.name,
      input: (() => {
        try {
          return JSON.parse(c.function?.arguments || "{}");
        } catch {
          return {};
        }
      })(),
    })),
    raw: msg,
  };
}

// ---------- JSON handling ----------

function extractJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(text.slice(start, end + 1));
}

const str = (x: unknown) => (typeof x === "string" ? x : x == null ? "" : String(x));
const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);

/** Normalise the model's JSON and drop any article that was not really retrieved. */
function verify(raw: any, seen: Map<string, Article>): { data: Explanation; removed: number } {
  let removed = 0;
  const research = arr(raw?.research).flatMap((r) => {
    const pmid = str(r?.pmid).replace(/\D/g, "");
    const real = seen.get(pmid);
    if (!real) {
      removed++;
      return [];
    }
    // Title and year always come from PubMed itself, not from the model.
    return [{ pmid, title: real.title, year: real.year, what_it_found: str(r?.what_it_found), limitation: str(r?.limitation) }];
  });
  return {
    removed,
    data: {
      summary: str(raw?.summary),
      terms: arr(raw?.terms).map((t) => ({
        term: str(t?.term),
        plain_meaning: str(t?.plain_meaning),
        in_your_document: str(t?.in_your_document),
      })),
      findings: arr(raw?.findings).map((f) => ({ from_document: str(f?.from_document), explanation: str(f?.explanation) })),
      research,
      organ_for_visual: str(raw?.organ_for_visual),
      follow_up: str(raw?.follow_up),
      questions_to_ask: arr(raw?.questions_to_ask).map(str).filter(Boolean),
      caution: str(raw?.caution),
    },
  };
}

// ---------- Agent loop ----------

export async function explain(report: string, emit: Emit): Promise<Explanation> {
  const p = provider();
  if (!p) throw new Error("The AI is not connected yet (no API key set).");
  const call = p === "anthropic" ? anthropicCall : openaiCall;
  const seen = new Map<string, Article>();

  emit({ type: "step", step: "read", status: "running" });
  const messages: any[] = [{ role: "user", content: `Here is the medical document:\n\n${report}` }];
  let finalText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const lastRound = round === MAX_ROUNDS - 1;
    const turn = await call(messages, !lastRound);
    if (round === 0) emit({ type: "step", step: "read", status: "done" });

    if (turn.calls.length === 0 || lastRound) {
      finalText = turn.text;
      break;
    }

    if (p === "anthropic") {
      messages.push({ role: "assistant", content: turn.raw });
      const results = [];
      for (const c of turn.calls) {
        results.push({ type: "tool_result", tool_use_id: c.id, content: await runTool(c.name, c.input, seen, emit) });
      }
      messages.push({ role: "user", content: results });
    } else {
      messages.push(turn.raw);
      for (const c of turn.calls) {
        messages.push({ role: "tool", tool_call_id: c.id, content: await runTool(c.name, c.input, seen, emit) });
      }
    }
  }

  emit({ type: "step", step: "write", status: "running" });
  let parsed: any;
  try {
    parsed = extractJson(finalText);
  } catch {
    // Ask the model once to fix its JSON.
    const fix = await call(
      [
        ...messages,
        { role: "assistant", content: finalText || "(no answer)" },
        { role: "user", content: "That was not valid JSON. Return only the JSON object in the required format, nothing else." },
      ],
      false
    );
    parsed = extractJson(fix.text);
  }
  const { data, removed } = verify(parsed, seen);
  emit({ type: "step", step: "write", status: "done", detail: removed ? `${removed} unverified article(s) removed` : undefined });
  return data;
}
