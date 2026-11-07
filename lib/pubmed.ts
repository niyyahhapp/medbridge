/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed external API data */
import { XMLParser } from "fast-xml-parser";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "medbridge";

export type Article = {
  pmid: string;
  title: string;
  year: string;
  journal: string;
  abstract: string;
};

// NCBI allows 3 requests per second without an API key. Space requests out.
let lastRequest = 0;
export async function throttledFetch(url: string): Promise<Response> {
  const wait = lastRequest + 350 - Date.now();
  lastRequest = Math.max(Date.now(), lastRequest + 350);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return res;
    // PubMed says "too many requests" or is briefly down: wait and try again.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error(`PubMed is not answering right now (${res.status}). Please try again in a moment.`);
  }
}

export async function searchPubmed(query: string, max = 5): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: String(Math.min(Math.max(max, 1), 10)),
    sort: "relevance",
    tool: TOOL,
  });
  const res = await throttledFetch(`${BASE}/esearch.fcgi?${params}`);
  const data = await res.json();
  const ids: unknown = data?.esearchresult?.idlist;
  return Array.isArray(ids) ? ids.map(String) : [];
}

// Turn the parsed XML node (string, object with #text, or array) into plain text.
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "object") {
    return Object.entries(node as Record<string, unknown>)
      .filter(([k]) => !k.startsWith("@_"))
      .map(([, v]) => text(v))
      .join(" ");
  }
  return "";
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const asArray = <T,>(x: T | T[] | undefined): T[] =>
  x == null ? [] : Array.isArray(x) ? x : [x];

export async function getAbstracts(pmids: string[]): Promise<Article[]> {
  const ids = pmids.map((p) => String(p).replace(/\D/g, "")).filter(Boolean).slice(0, 8);
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    rettype: "abstract",
    retmode: "xml",
    tool: TOOL,
  });
  const res = await throttledFetch(`${BASE}/efetch.fcgi?${params}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, textNodeName: "#text", htmlEntities: true });
  const doc = parser.parse(xml);
  const articles = asArray(doc?.PubmedArticleSet?.PubmedArticle);

  return articles.map((a: any) => {
    const cit = a?.MedlineCitation ?? {};
    const art = cit?.Article ?? {};
    const pubDate = art?.Journal?.JournalIssue?.PubDate ?? {};
    const year =
      text(pubDate?.Year) ||
      (text(pubDate?.MedlineDate).match(/\d{4}/)?.[0] ?? "") ||
      text(art?.ArticleDate?.Year);
    const abstract = asArray(art?.Abstract?.AbstractText)
      .map((p: any) => {
        const label = typeof p === "object" ? p?.["@_Label"] : undefined;
        const body = clean(text(p));
        return label ? `${label}: ${body}` : body;
      })
      .join("\n");
    return {
      pmid: text(cit?.PMID),
      title: clean(text(art?.ArticleTitle)),
      year,
      journal: clean(text(art?.Journal?.Title)),
      abstract: abstract.slice(0, 3000),
    };
  });
}
