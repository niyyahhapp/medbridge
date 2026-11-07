// "Basic mode": works with no AI key. Searches PubMed for real, explains words
// from a built-in glossary, and quotes what each article concluded.
import type { Emit, Explanation } from "./agent";
import { GLOSSARY } from "./glossary";
import { getAbstracts, searchPubmed } from "./pubmed";

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

export async function basicExplain(report: string, emit: Emit): Promise<Explanation> {
  emit({ type: "step", step: "read", status: "running" });
  const hits = GLOSSARY.filter((g) => g.match.test(report));
  const lines = report
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^patient\s*:/i.test(l));
  const planLine = lines.find((l) => /^(plan|comment|commentaire)\s*:/i.test(l));
  emit({ type: "step", step: "read", status: "done", detail: `${hits.length} medical terms found` });

  // Search PubMed with the main topic, falling back to shorter searches.
  const topics = hits.filter((h) => h.query);
  const queries = [...topics.map((t) => t.query!), ...topics.map((t) => t.term)];
  let pmids: string[] = [];
  for (const q of queries.slice(0, 3)) {
    emit({ type: "step", step: "search_pubmed", status: "running", detail: q });
    pmids = await searchPubmed(q, 5);
    emit({ type: "step", step: "search_pubmed", status: "done", detail: `${q} · ${pmids.length} found` });
    if (pmids.length) break;
  }

  let research: Explanation["research"] = [];
  if (pmids.length) {
    emit({ type: "step", step: "get_abstracts", status: "running", detail: pmids.join(", ") });
    const articles = (await getAbstracts(pmids)).filter((a) => a.abstract && conclusion(a.abstract).length >= 40);
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
    .filter((l) => l !== planLine)
    .map((l) => {
      const notes = GLOSSARY.filter((g) => g.match.test(l) && g.query).map((g) => `${g.term}: ${g.plain}`);
      return {
        from_document: l,
        explanation: notes.length
          ? notes.join(" ")
          : "See \"Words in your report\" for the meaning of the words in this line.",
      };
    });

  const main = topics[0]?.term;
  const data: Explanation = {
    summary: main
      ? `Your document talks about ${main.toLowerCase()}. Below, each medical word is explained in plain language, and real research about it is linked from PubMed.`
      : "Below, each medical word in your document is explained in plain language.",
    terms: hits.map((h) => ({
      term: h.term,
      plain_meaning: h.plain,
      in_your_document: lines.find((l) => h.match.test(l)) ?? "",
    })),
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
      "Basic mode: the AI is not connected, so word meanings come from MedBridge's built-in glossary and research is quoted directly from PubMed.",
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
