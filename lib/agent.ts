/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed external API data */
import { Article, getAbstracts, searchPubmed } from "./pubmed";
import { SYSTEM_PROMPT } from "./prompt";
import { stripViolations, treatmentViolations } from "./safety";

export type Explanation = {
  summary: string;
  terms: { term: string; plain_meaning: string; in_your_document: string; source?: { name: string; url: string } }[];
  findings: { from_document: string; explanation: string }[];
  research: {
    pmid: string;
    title: string;
    year: string;
    what_it_found: string;
    limitation: string;
  }[];
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
      properties: {
        query: {
          type: "string",
          description: "Search words, e.g. 'fatty liver lifestyle'",
        },
      },
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
  // OPENAI_BASE_URL lets you use any OpenAI-compatible server, e.g. llama.cpp at http://localhost:8080/v1
  if (process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL)
    return "openai";
  return null;
}

/** Runs one tool and records every article actually retrieved. */
async function runTool(
  name: string,
  input: any,
  seen: Map<string, Article>,
  emit: Emit,
): Promise<string> {
  try {
    if (name === "search_pubmed") {
      const query = String(input?.query ?? "").slice(0, 200);
      emit({
        type: "step",
        step: "search_pubmed",
        status: "running",
        detail: query,
      });
      const pmids = await searchPubmed(query, 6);
      emit({
        type: "step",
        step: "search_pubmed",
        status: "done",
        detail: `${query} · ${pmids.length} found`,
      });
      return JSON.stringify({
        query,
        pmids,
        note: pmids.length ? undefined : "No results. Try shorter words.",
      });
    }
    if (name === "get_abstracts") {
      const pmids: string[] = Array.isArray(input?.pmids)
        ? input.pmids.map(String).slice(0, 5)
        : [];
      emit({
        type: "step",
        step: "get_abstracts",
        status: "running",
        detail: pmids.join(", "),
      });
      const articles = await getAbstracts(pmids);
      articles.forEach((a) => seen.set(a.pmid, a));
      emit({
        type: "step",
        step: "get_abstracts",
        status: "done",
        detail: `${articles.length} abstracts read`,
      });
      return JSON.stringify(articles);
    }
    return JSON.stringify({ error: `Unknown tool ${name}` });
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

// ---------- Provider calls ----------

type Turn = {
  text: string;
  calls: { id: string; name: string; input: any }[];
  raw: any;
};

async function anthropicCall(
  messages: any[],
  withTools: boolean | "omit",
  system: string = SYSTEM_PROMPT,
): Promise<Turn> {
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
      system,
      messages,
      tools: TOOL_DEFS.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      ...(withTools === true ? {} : { tool_choice: { type: "none" } }),
    }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      `AI error ${res.status}: ${data?.error?.message ?? "unknown"}`,
    );
  const content: any[] = data.content ?? [];
  return {
    text: content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(""),
    calls: content
      .filter((c) => c.type === "tool_use")
      .map((c) => ({ id: c.id, name: c.name, input: c.input })),
    raw: content,
  };
}

// Models to try in order: OPENAI_MODEL, then OPENAI_FALLBACK_MODELS (comma-separated).
function openaiModels(): string[] {
  const first =
    process.env.OPENAI_MODEL ||
    (process.env.OPENAI_BASE_URL ? "local" : "gpt-5");
  const rest = (process.env.OPENAI_FALLBACK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [first, ...rest.filter((m) => m !== first)];
}
let preferredModel = 0; // remember a model that worked

async function openaiCall(
  messages: any[],
  withTools: boolean | "omit",
  system: string = SYSTEM_PROMPT,
): Promise<Turn> {
  const base = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (process.env.OPENAI_API_KEY)
    headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  const models = openaiModels();
  let data: any = null;
  let lastError = "";
  outer: for (let k = 0; k < models.length; k++) {
    const mi = (preferredModel + k) % models.length;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers,
          signal: AbortSignal.timeout(
            Number(process.env.AI_TIMEOUT_MS || 40000),
          ),
          body: JSON.stringify({
            model: models[mi],
            messages: [{ role: "system", content: system }, ...messages],
            ...(withTools === "omit"
              ? {}
              : {
                  tools: TOOL_DEFS.map((t) => ({
                    type: "function",
                    function: t,
                  })),
                  ...(withTools ? {} : { tool_choice: "none" }),
                }),
            temperature: 0.2,
            ...(process.env.OPENAI_REASONING_EFFORT
              ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT }
              : {}),
          }),
        });
      } catch (e) {
        // Timed out or network problem: try the next model.
        lastError = `AI error: ${(e as Error).name === "TimeoutError" ? "the model took too long" : (e as Error).message}`;
        continue outer;
      }
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        data = body;
        preferredModel = mi;
        break outer;
      }
      const err = Array.isArray(body) ? body[0]?.error : body?.error;
      lastError = `AI error ${res.status}: ${err?.message ?? "unknown"}`;
      // Busy or rate-limited: wait and retry, then try the next model.
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      // Model not found: try the next model. Anything else (bad request, bad key): stop.
      if (res.status === 404) continue outer;
      throw new Error(lastError);
    }
  }
  if (!data) throw new Error(lastError || "AI error: no answer");
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

const str = (x: unknown) =>
  typeof x === "string" ? x : x == null ? "" : String(x);
const arr = (x: unknown): any[] => (Array.isArray(x) ? x : []);

/** Normalise the model's JSON and drop any article that was not really retrieved. */
function verify(
  raw: any,
  seen: Map<string, Article>,
): { data: Explanation; removed: number } {
  let removed = 0;
  const research = arr(raw?.research).flatMap((r) => {
    const pmid = str(r?.pmid).replace(/\D/g, "");
    const real = seen.get(pmid);
    if (!real) {
      removed++;
      return [];
    }
    // Title and year always come from PubMed itself, not from the model.
    return [
      {
        pmid,
        title: real.title,
        year: real.year,
        what_it_found: str(r?.what_it_found),
        limitation: str(r?.limitation),
      },
    ];
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
      findings: arr(raw?.findings).map((f) => ({
        from_document: str(f?.from_document),
        explanation: str(f?.explanation),
      })),
      research,
      organ_for_visual: str(raw?.organ_for_visual),
      follow_up: str(raw?.follow_up),
      questions_to_ask: arr(raw?.questions_to_ask).map(str).filter(Boolean),
      caution: str(raw?.caution),
    },
  };
}

// ---------- Agent loop ----------

type Call = (messages: any[], withTools: boolean | "omit", system?: string) => Promise<Turn>;

async function finish(
  call: Call,
  messages: any[],
  finalText: string,
  seen: Map<string, Article>,
  emit: Emit,
) {
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
        {
          role: "user",
          content:
            "That was not valid JSON. Return only the JSON object in the required format, nothing else.",
        },
      ],
      "omit",
    );
    parsed = extractJson(fix.text);
  }
  let { data, removed } = verify(parsed, seen);

  // Safety check: no treatment or medication advice. One rewrite, then remove what is left.
  const bad = treatmentViolations(data);
  let safetyNote = "";
  if (bad.length) {
    try {
      const fix = await call(
        [
          ...messages,
          { role: "assistant", content: JSON.stringify(data) },
          {
            role: "user",
            content: `These sentences give treatment or medication advice, which is not allowed:\n${bad.map((b) => "- " + b).join("\n")}\nRewrite the JSON without any treatment thresholds, medication names, doses or advice about when treatment is needed. Say the care team decides next steps instead. Keep everything else the same. Return only the JSON.`,
          },
        ],
        "omit"
      );
      ({ data, removed } = verify(extractJson(fix.text), seen));
    } catch {
      // keep the first version; the filter below still removes unsafe sentences
    }
    const still = treatmentViolations(data).length;
    data = stripViolations(data);
    safetyNote = `safety check: ${bad.length} sentence(s) rewritten${still ? `, ${still} removed` : ""}`;
  }
  const details = [removed ? `${removed} unverified article(s) removed` : "", safetyNote].filter(Boolean).join(" · ");
  emit({ type: "step", step: "write", status: "done", detail: details || undefined });
  return data;
}

/** Tool-calling agent: the model decides when to search and what to read. */
async function agentLoop(
  p: "anthropic" | "openai",
  call: Call,
  report: string,
  seen: Map<string, Article>,
  emit: Emit,
) {
  const messages: any[] = [
    { role: "user", content: `Here is the medical document:\n\n${report}` },
  ];
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
        results.push({
          type: "tool_result",
          tool_use_id: c.id,
          content: await runTool(c.name, c.input, seen, emit),
        });
      }
      messages.push({ role: "user", content: results });
    } else {
      messages.push(turn.raw);
      for (const c of turn.calls) {
        messages.push({
          role: "tool",
          tool_call_id: c.id,
          content: await runTool(c.name, c.input, seen, emit),
        });
      }
    }
  }
  return { messages, finalText };
}

/** Backup for models without tool calling: the app searches PubMed itself,
 *  then gives the abstracts to the model to write the explanation. */
async function guidedPipeline(
  call: Call,
  report: string,
  seen: Map<string, Article>,
  emit: Emit,
) {
  const q = await call(
    [
      {
        role: "user",
        content: `Medical document:\n\n${report}\n\nWrite ONE short PubMed search query (2 to 5 English words) about the main condition in this document. Reply with the query only, no quotes, no JSON.`,
      },
    ],
    "omit",
  );
  emit({ type: "step", step: "read", status: "done" });
  const firstLine =
    q.text
      .replace(/["'`{}]/g, "")
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  let query = firstLine.slice(0, 80);
  let found =
    JSON.parse(await runTool("search_pubmed", { query }, seen, emit)).pmids ??
    [];
  if (!found.length && query.split(" ").length > 2) {
    query = query.split(" ").slice(0, 2).join(" ");
    found =
      JSON.parse(await runTool("search_pubmed", { query }, seen, emit)).pmids ??
      [];
  }
  const abstracts = found.length
    ? await runTool("get_abstracts", { pmids: found.slice(0, 4) }, seen, emit)
    : "[]";
  const messages: any[] = [
    {
      role: "user",
      content: `Here is the medical document:\n\n${report}\n\nI already searched PubMed for "${query}". These are the ONLY abstracts you may use (JSON):\n${abstracts}\n\nNow write the explanation. Return only the JSON object.`,
    },
  ];
  const turn = await call(messages, "omit");
  return { messages, finalText: turn.text };
}

export async function explain(
  report: string,
  emit: Emit,
): Promise<Explanation> {
  const p = provider();
  if (!p) throw new Error("The AI is not connected yet (no API key set).");
  const call: Call = p === "anthropic" ? anthropicCall : openaiCall;
  const seen = new Map<string, Article>();
  emit({ type: "step", step: "read", status: "running" });

  if (process.env.AGENT_TOOLS !== "off") {
    try {
      const r = await agentLoop(p, call, report, seen, emit);
      // Only accept the agent's answer if it really read research.
      if (seen.size > 0)
        return await finish(call, r.messages, r.finalText, seen, emit);
    } catch (e) {
      // Some models do not support tool calling: fall back below.
      // Log only the error code, never message text that could echo the report.
      console.warn("Tool-calling agent failed, using guided pipeline:", (e as Error).message.match(/AI error \d+/)?.[0] ?? "error");
      if (/\b(401|402|403|429)\b/.test((e as Error).message)) throw e;
    }
  }
  const r = await guidedPipeline(call, report, seen, emit);
  return await finish(call, r.messages, r.finalText, seen, emit);
}

/** Human-readable name of the AI company the report is sent to, for the privacy panel. */
export function providerLabel(): string | null {
  const p = provider();
  if (!p) return null;
  if (p === "anthropic") return "Anthropic (Claude)";
  const base = process.env.OPENAI_BASE_URL || "";
  if (!base) return "OpenAI";
  if (base.includes("googleapis")) return "Google (Gemini)";
  if (base.includes("featherless")) return "Featherless";
  if (base.includes("groq")) return "Groq";
  if (/localhost|127\.0\.0\.1/.test(base)) return "a model running on this computer (nothing leaves the device)";
  return new URL(base).hostname;
}

/** Translate short texts with the connected AI (used when DeepL is not set up). */
export async function aiTranslate(texts: string[], language: string): Promise<string[]> {
  const p = provider();
  if (!p) throw new Error("Translation is not connected.");
  const call = p === "anthropic" ? anthropicCall : openaiCall;
  const system =
    "You are a careful medical translator for patients. Translate faithfully and simply. Keep every number, unit, reference range, PMID and the words' meaning exactly. Do not add or remove information. Return only a JSON array of strings, the same length and order as the input.";
  const turn = await call([{ role: "user", content: `Translate into ${language}:\n${JSON.stringify(texts)}` }], "omit", system);
  const t = turn.text;
  const out = JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1));
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error("The translation came back incomplete. Please try again.");
  return out.map(String);
}
