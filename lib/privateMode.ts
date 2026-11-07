// Private mode, run entirely in the browser.
// The report never leaves the device: only short search words go to our server (to look up PubMed).
// The explanation is built on the device with exact rules: values are compared with the report's own
// reference ranges by arithmetic, words come from MedBridge's glossary, and research is quoted from PubMed.
// No AI is used, so nothing can be guessed or made up.
import type { Emit, Explanation } from "./agent";
import { basicExplain, type ResearchDeps } from "./basic";
import type { Article } from "./pubmed";

const browserResearch: ResearchDeps = {
  async searchPubmed(q) {
    const r = await fetch(`/api/research?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "PubMed search failed.");
    return d.pmids as string[];
  },
  async getAbstracts(ids) {
    if (!ids.length) return [];
    const r = await fetch(`/api/research?ids=${ids.join(",")}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? "PubMed failed.");
    return d.articles as Article[];
  },
};

export async function privateExplain(report: string, emit: Emit): Promise<Explanation> {
  const out = await basicExplain(report, emit, browserResearch);
  emit({ type: "step", step: "write", status: "done", detail: "written on your device" });
  return {
    ...out,
    caution:
      "Private mode: your report never left your device. This explanation was put together on your device with exact rules (no AI): each value is compared with the reference range written in your report, word meanings come from MedBridge's glossary, and research is quoted directly from PubMed.",
  };
}
