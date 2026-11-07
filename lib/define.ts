// Patient-friendly meanings of medical words from the U.S. National Library of Medicine:
// MedlinePlus (written for patients) first, MeSH (medical dictionary) as a backup.
// Only the single word is sent, never the report.
import { XMLParser } from "fast-xml-parser";
import { throttledFetch } from "./pubmed";

export type Definition = { term: string; meaning: string; source: string; url: string };

const cache = new Map<string, Definition | null>();
const strip = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const sentences = (t: string) => t.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [t];
const asArray = <T,>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

async function medlineplus(term: string): Promise<Definition | null> {
  const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(term)}&retmax=3&tool=medbridge`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const doc = new XMLParser({ ignoreAttributes: false }).parse(await res.text());
  const low = term.toLowerCase();
  for (const d of asArray<any>(doc?.nlmSearchResult?.list?.document)) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const contents = asArray<any>(d.content); // eslint-disable-line @typescript-eslint/no-explicit-any
    const get = (n: string) => contents.filter((c) => c["@_name"] === n).map((c) => strip(String(c["#text"] ?? "")));
    const title = get("title")[0] ?? "";
    const names = [title, ...get("altTitle")].map((x) => x.toLowerCase());
    // Only accept a page whose official name (or another official name) is exactly this word.
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().replace(/(es|s)$/, "");
    if (!names.some((n) => norm(n) === norm(low))) continue;
    const summary = sentences(get("FullSummary")[0] ?? "");
    const key = title.toLowerCase().replace(/s$/, "").split(" ")[0];
    const best = summary.filter((s) => s.toLowerCase().includes(key) || s.toLowerCase().includes(low)).slice(0, 2);
    const chosen = (best.length ? best : summary.slice(0, 2)).join(" ");
    const alsoCalled = title && title.toLowerCase() !== low ? `MedlinePlus explains this under "${title}". ` : "";
    return { term, meaning: (alsoCalled + chosen).slice(0, 420), source: "MedlinePlus", url: String(d["@_url"] ?? "https://medlineplus.gov") };
  }
  return null;
}

async function mesh(term: string): Promise<Definition | null> {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const s = await throttledFetch(`${base}/esearch.fcgi?db=mesh&retmode=json&tool=medbridge&term=${encodeURIComponent(`"${term}"[MeSH Terms]`)}`);
  const id = (await s.json())?.esearchresult?.idlist?.[0];
  if (!id) return null;
  const r = await throttledFetch(`${base}/esummary.fcgi?db=mesh&retmode=json&tool=medbridge&id=${id}`);
  const note = strip(String((await r.json())?.result?.[id]?.ds_scopenote ?? "")).replace(/\b[A-Z]{3,}\b/g, (w) => w.toLowerCase());
  if (!note) return null;
  return { term, meaning: sentences(note)[0].slice(0, 300), source: "MeSH (medical dictionary)", url: `https://www.ncbi.nlm.nih.gov/mesh/${id}` };
}

async function lookup(term: string): Promise<Definition | null> {
  const key = term.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const d = (await medlineplus(term)) ?? (await mesh(term));
    cache.set(key, d); // remember real answers ("found" or "not found"), never network failures
    return d;
  } catch {
    return null;
  }
}

/** Tries the full phrase ("left ventricular hypertrophy") first, then its main word ("hypertrophy"). */
export async function defineTerm(term: string): Promise<Definition | null> {
  const words = term.trim().split(/\s+/);
  const describing = /^(left|right|mild|trace|small|[a-z]+(al|ar|ic|ary|ous|ive|ial))$/i;
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && !describing.test(words[i - 1])) break; // never drop a real noun ("gallbladder sludge" is not "sludge")
    const d = await lookup(words.slice(i).join(" "));
    if (d) return { ...d, term };
  }
  return null;
}
