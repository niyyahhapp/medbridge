// "Basic mode": works with no AI key. Searches PubMed for real, explains words
// from a built-in glossary, and quotes what each article concluded.
import type { Emit, Explanation } from "./agent";
import { GLOSSARY } from "./glossary";
import { rangeSentence, readRange } from "./ranges";
import { findMedicalTerms } from "./terms";
import { defineTerm, type Definition } from "./define";
import { getAbstracts, searchPubmed, type Article } from "./pubmed";

/** Where PubMed results come from: directly (server) or through our search-words-only endpoint (browser). */
export type ResearchDeps = {
  searchPubmed: (q: string, max?: number) => Promise<string[]>;
  getAbstracts: (ids: string[]) => Promise<Article[]>;
  define: (term: string) => Promise<Definition | null>;
};
const SERVER_DEPS: ResearchDeps = { searchPubmed, getAbstracts, define: defineTerm };

function conclusion(abstract: string): string {
  const m = abstract.match(/(?:^|\n)(?:CONCLUSIONS?|INTERPRETATION|CONCLUSIONS AND RELEVANCE)[^:\n]*:\s*([^\n]+)/i);
  let s = m?.[1]?.trim() ?? "";
  if (s.length < 40) {
    // No labelled conclusion: use the last two full sentences.
    const paragraphs = abstract.split("\n").map((p) => p.replace(/^[A-Z][A-Z ]+:\s*/, "").trim()).filter(Boolean);
    const sentences = (paragraphs.at(-1) ?? "").split(/(?<=[.!?])\s+(?=[A-Z])/);
    s = sentences.slice(-2).join(" ").trim();
  }
  return s.length > 450 ? s.slice(0, 447).trimEnd() + "…" : s;
}

export async function basicExplain(report: string, emit: Emit, deps: ResearchDeps = SERVER_DEPS): Promise<Explanation> {
  emit({ type: "step", step: "read", status: "running" });
  const hits = GLOSSARY.filter((g) => g.match.test(report));
  const lines = report
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^patient\s*:/i.test(l) && !/\[[^\]]*removed\]/.test(l));
  // Prefer a "Plan:" line; otherwise a follow-up style comment.
  const planLine =
    lines.find((l) => /^(plan|follow[- ]?up|recommendation|recommandation)s?\s*:/i.test(l)) ??
    lines.find((l) => /^(comment|commentaire)\s*:/i.test(l) && /repeat|follow|recheck|again|review|nouvelle|contr[ôo]le/i.test(l));
  // The main condition, as written: "consistent with X", "suggestive of X", "Impression: X"...
  const diagnosis = report
    .match(/(?:consistent with|compatible(?:s)? avec|suggestive of|in keeping with|suspicious for|impression\s*:|diagnosis\s*:|conclusion\s*:)\s*(?:an?\s+|une?\s+)?([^.;\n]{3,80})/i)?.[1]
    ?.replace(/^(mild|moderate|severe|early|small|légère|modérée)\s+/i, "")
    .trim();
  // More medical words, found by how they are built (no AI), defined by MedlinePlus or MeSH.
  // Only each single word is looked up, never the report.
  const extra = findMedicalTerms(report);
  const defined = (await Promise.all(extra.map((t) => deps.define(t).catch(() => null)))).filter((d): d is Definition => !!d);
  emit({ type: "step", step: "read", status: "done", detail: `${hits.length + defined.length} medical terms found` });

  // Search PubMed with the main topic, falling back to shorter searches.
  // Topics from the glossary; the one named in the diagnosis comes first.
  // A topic whose value is inside its reference range is not the main concern, so it goes last.
  const normalOnly = (h: (typeof hits)[number]) => {
    const ls = lines.filter((l) => h.match.test(l));
    return ls.length > 0 && ls.every((l) => readRange(l)?.status === "inside");
  };
  const rank = (h: (typeof hits)[number]) => (diagnosis && h.match.test(diagnosis) ? 0 : normalOnly(h) ? 2 : 1);
  const topics = hits.filter((h) => h.query).sort((a, b) => rank(a) - rank(b));
  const queries = [
    ...(diagnosis && !topics.some((t) => t.match.test(diagnosis)) && /^[\x00-\x7F]+$/.test(diagnosis)
      ? [`${diagnosis}[tiab] AND review[pt]`, diagnosis]
      : []),
    ...topics.filter((t) => !normalOnly(t)).map((t) => t.query!),
    ...topics.filter((t) => !normalOnly(t)).map((t) => t.term.replace(/\s*\(.*\)/, "")),
    // Words found by the word finder and confirmed by MedlinePlus / MeSH
    ...defined.flatMap((d) => [`${d.term}[ti] AND review[pt]`, d.term]),
    ...topics.filter(normalOnly).map((t) => t.query!),
  ].filter((q, i, a) => a.indexOf(q) === i);
  let pmids: string[] = [];
  for (const q of queries.slice(0, 3)) {
    emit({ type: "step", step: "search_pubmed", status: "running", detail: q });
    pmids = await deps.searchPubmed(q, 5);
    emit({ type: "step", step: "search_pubmed", status: "done", detail: `${q} · ${pmids.length} found` });
    if (pmids.length) break;
  }

  let research: Explanation["research"] = [];
  if (pmids.length) {
    emit({ type: "step", step: "get_abstracts", status: "running", detail: pmids.join(", ") });
    const articles = (await deps.getAbstracts(pmids)).filter((a) => a.abstract && conclusion(a.abstract).length >= 40);
    research = articles.slice(0, 3).map((a) => ({
      pmid: a.pmid,
      title: a.title,
      year: a.year,
      what_it_found: `From the abstract: "${conclusion(a.abstract)}"`,
      limitation: "Quoted directly from the article's abstract, not simplified. Ask your healthcare professional what it means for you.",
    }));
    emit({ type: "step", step: "get_abstracts", status: "done", detail: `${articles.length} abstracts read` });
  } else {
    emit({ type: "step", step: "get_abstracts", status: "done", detail: "no articles to read" });
  }

  emit({ type: "step", step: "write", status: "running" });
  const findings = lines
    .filter((l) => l !== planLine && !/^[^:]{2,40}:\s*$/.test(l)) // skip headings like "Thyroid function tests:"
    .map((l) => {
      // Exact comparison with the report's own reference range (arithmetic, not AI).
      const r = readRange(l);
      const meaning = GLOSSARY.find((g) => g.match.test(l) && g.query);
      const parts = [
        r ? rangeSentence(r) : "",
        meaning ? `${meaning.term.replace(/\s*\(.*\)/, "")}: ${meaning.plain}` : "",
      ].filter(Boolean);
      return { from_document: l, explanation: parts.join(" ") };
    });
  const ranges = lines.map(readRange).filter((r): r is NonNullable<typeof r> => !!r);
  const outside = ranges.filter((r) => r.status !== "inside");
  const rangeSummary = ranges.length
    ? ` ${ranges.map((r) => `Your ${r.name} (${r.valueText}) is ${r.status} the range written in your report (${r.rangeText})`).join(". ")}.` +
      (outside.length ? " One result outside a range does not, on its own, show a lasting condition. Tests are often repeated to confirm." : "")
    : "";

  const main = topics[0]?.term;
  const data: Explanation = {
    summary:
      (diagnosis
        ? `Your document says: "${lines.find((l) => l.toLowerCase().includes(diagnosis.toLowerCase())) ?? diagnosis}"`
        : main
          ? `Your document talks about ${((t) => (/[A-Z].*[A-Z0-9]/.test(t) ? t : t.toLowerCase()))(main.replace(/\s*\(.*\)/, ""))}.`
          : "Here is what your document says, in plain words.") + rangeSummary,
    terms: [
      ...hits.map((h) => ({
        term: h.term,
        plain_meaning: h.plain,
        in_your_document: lines.find((l) => h.match.test(l)) ?? "",
      })),
      ...defined.map((d) => ({
        term: d.term.charAt(0).toUpperCase() + d.term.slice(1),
        plain_meaning: d.meaning,
        in_your_document: lines.find((l) => l.toLowerCase().includes(d.term.toLowerCase())) ?? "",
        source: { name: d.source, url: d.url },
      })),
    ],
    findings,
    research,
    organ_for_visual: hits.find((h) => h.organ)?.organ ?? "",
    follow_up: planLine
      ? `Your document says: "${planLine}" This is the plan written in your report. It is not a prediction of what will happen.`
      : "Your document does not describe a follow-up plan. Ask your healthcare professional what happens next.",
    questions_to_ask: [
      "What does this result mean for me?",
      "Is there anything I should do or change before my next check?",
      "Do I need any other tests?",
      "When should I contact you sooner?",
    ],
    caution:
      "Basic mode: the AI is not connected, so this was put together with exact rules: each value is compared with the reference range written in your report, word meanings come from MedBridge's built-in glossary, and research is quoted directly from PubMed.",
  };
  emit({ type: "step", step: "write", status: "done" });
  return data;
}

/** Prepared explanation for a sample report. PubMed is still called for real,
 *  and titles and years are taken from PubMed, not from the prepared text. */
export async function preparedExplain(
  prepared: { query: string; data: Explanation },
  emit: Emit
): Promise<Explanation> {
  emit({ type: "step", step: "read", status: "running" });
  emit({ type: "step", step: "read", status: "done", detail: "fictional sample report" });
  emit({ type: "step", step: "search_pubmed", status: "running", detail: prepared.query });
  const found = await searchPubmed(prepared.query, 5);
  emit({ type: "step", step: "search_pubmed", status: "done", detail: `${prepared.query} · ${found.length} found` });
  const pmids = prepared.data.research.map((r) => r.pmid);
  emit({ type: "step", step: "get_abstracts", status: "running", detail: pmids.join(", ") });
  const real = new Map((await getAbstracts(pmids)).map((a) => [a.pmid, a]));
  emit({ type: "step", step: "get_abstracts", status: "done", detail: `${real.size} abstracts read` });
  emit({ type: "step", step: "write", status: "running" });
  const research = prepared.data.research
    .filter((r) => real.has(r.pmid))
    .map((r) => ({ ...r, title: real.get(r.pmid)!.title, year: real.get(r.pmid)!.year }));
  emit({ type: "step", step: "write", status: "done", detail: "prepared example" });
  return { ...prepared.data, research };
}
