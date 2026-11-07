// Safety check on every AI explanation: MedBridge must never give treatment advice.
import type { Explanation } from "./agent";

// Phrases that mean treatment or medication advice. Kept specific so that
// "the plan is lifestyle counselling" (quoting the report) is still allowed.
const TREATMENT = [
  /\b(levothyroxine|thyroxine (tablets?|replacement)|metformin|statins?|insulin|ozempic|semaglutide|glp-1|antihypertensive|ace inhibitors?|beta[- ]blockers?|vitamin e|pioglitazone)\b/i,
  /\b(treatment|medication|medicine|therapy|drug)s?\b[^.]{0,60}\b(is|are|isn't|aren't|not)?\s*(usually|generally|often|typically|rarely)?\s*(needed|required|necessary|recommended|unnecessary|started|considered|indicated)\b/i,
  /\b(start|begin|take|stop|increase|decrease|adjust)\w*\s+(a |any |your )?(medication|medicine|treatment|dose|tablets?|pills?)\b/i,
  /\b(unless|until|if|when)\b[^.]{0,40}\b(above|over|exceeds?|greater than|below|under)\s*\d/i,
  /\bdoses?\b|\bmg\b(?!\/dl)/i,
  /\byou (should|must|need to)\b(?![^.]{0,40}\b(ask|talk|speak|contact|discuss|bring|write)\b)/i,
  /\byou have\b/i,
];

export function treatmentViolations(d: Explanation): string[] {
  const texts = [
    d.summary,
    ...d.terms.flatMap((t) => [t.plain_meaning]),
    ...d.findings.map((f) => f.explanation),
    ...d.research.flatMap((r) => [r.what_it_found, r.limitation]),
    d.follow_up,
    d.caution,
  ];
  const found: string[] = [];
  for (const t of texts) {
    for (const sentence of t.split(/(?<=[.!?])\s+/)) {
      if (TREATMENT.some((re) => re.test(sentence))) found.push(sentence);
    }
  }
  return [...new Set(found)];
}

/** Last line of defence: remove any sentence that still gives treatment advice. */
export function stripViolations(d: Explanation): Explanation {
  const clean = (t: string) =>
    t
      .split(/(?<=[.!?])\s+/)
      .filter((s) => !TREATMENT.some((re) => re.test(s)))
      .join(" ");
  return {
    ...d,
    summary: clean(d.summary),
    terms: d.terms.map((t) => ({ ...t, plain_meaning: clean(t.plain_meaning) })),
    findings: d.findings.map((f) => ({ ...f, explanation: clean(f.explanation) })),
    research: d.research.map((r) => ({ ...r, what_it_found: clean(r.what_it_found), limitation: clean(r.limitation) })),
    follow_up: clean(d.follow_up),
    caution: clean(d.caution),
  };
}

/** For small on-device models: drop any sentence containing a number that is not in the report. */
export function dropInventedNumbers(text: string, report: string): string {
  const known = new Set(report.match(/\d+(?:[.,]\d+)?/g) ?? []);
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => (sentence.match(/\d+(?:[.,]\d+)?/g) ?? []).every((n) => known.has(n)))
    .join(" ");
}
