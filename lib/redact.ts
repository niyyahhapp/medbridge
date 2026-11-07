// Removes personal details from a report BEFORE it leaves the browser.
// Runs in the browser, and again on the server as a second safety net.
// It cannot be perfect, so the page also tells people not to paste personal details.

export type Removal = { kind: string; count: number };
export type Segment = { text: string; removed?: { kind: string; original: string } };

type Rule = { kind: string; re: RegExp; replacement: string; labelled?: boolean };

const RULES: Rule[] = [
  // "Patient: Sarah", "Name: ...", "Nom : ...", "Patient : Amina (fictive)"
  {
    kind: "Name",
    re: /^(\s*(?:patient(?:\s+name)?|name|full name|nom(?:\s+du\s+patient)?|patient\(e\))\s*:\s*)(.+)$/gim,
    replacement: "[name removed]",
    labelled: true,
  },
  {
    kind: "Doctor or staff name",
    re: /\b(?:Dr\.?|Doctor|Docteur|Nurse|Mr\.?|Mrs\.?|Ms\.?|Mme|M\.)\s+[A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?/gu,
    replacement: "[name removed]",
  },
  { kind: "Email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "[email removed]" },
  {
    kind: "Date of birth",
    re: /^(\s*(?:dob|d\.o\.b\.?|date of birth|birth ?date|date de naissance|né\(?e?\)? le)\s*:?\s*)(.+)$/gim,
    replacement: "[date of birth removed]",
    labelled: true,
  },
  {
    kind: "ID or record number",
    re: /^(\s*(?:mrn|medical record(?: number| no\.?)?|health ?card(?: number| no\.?)?|ohip|ramq|nas|sin|ssn|insurance(?: number| no\.?)?|patient id|id|chart(?: number| no\.?)?|numéro de dossier|n° de dossier)\s*[:#]?\s*)(.+)$/gim,
    replacement: "[ID removed]",
    labelled: true,
  },
  { kind: "Address", re: /^(\s*(?:address|adresse)\s*:\s*)(.+)$/gim, replacement: "[address removed]", labelled: true },
  {
    kind: "Phone number",
    re: /(?<![\d/.-])(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\d/])/g,
    replacement: "[phone removed]",
  },
  // Long numbers (7+ digits) are usually IDs, never lab values.
  { kind: "ID or record number", re: /\b\d{7,}\b/g, replacement: "[ID removed]" },
  // Canadian postal code / US ZIP+4
  {
    kind: "Postal code",
    re: /\b[A-CEGHJ-NPRSTVXY]\d[A-CEGHJ-NPRSTV-Z][ -]?\d[A-CEGHJ-NPRSTV-Z]\d\b/gi,
    replacement: "[postal code removed]",
  },
  { kind: "Postal code", re: /\b\d{5}-\d{4}\b/g, replacement: "[postal code removed]" },
  // Full dates like 12/03/1985, 1985-03-12, 12 March 1985 (not lab values like 148/92 or 7-35)
  {
    kind: "Date",
    re: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)[a-zéû]*\.?\s+(?:19|20)\d{2})\b/gi,
    replacement: "[date removed]",
  },
];

// Each removal is first replaced by one private-use character, so later rules
// cannot match inside text that was already removed.
const MARK = 0xe100;

export function redactSegments(text: string): { text: string; segments: Segment[]; removed: Removal[] } {
  const found: { kind: string; original: string; replacement: string }[] = [];
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...m: string[]) => {
      const prefix = rule.labelled ? m[1] : "";
      const original = rule.labelled ? m[2] : m[0];
      found.push({ kind: rule.kind, original, replacement: rule.replacement });
      return prefix + String.fromCharCode(MARK + found.length - 1);
    });
  }

  const segments: Segment[] = [];
  let plain = "";
  let buffer = "";
  for (const ch of out) {
    const i = ch.charCodeAt(0) - MARK;
    if (i >= 0 && i < found.length) {
      if (buffer) segments.push({ text: buffer });
      buffer = "";
      const f = found[i];
      segments.push({ text: f.replacement, removed: { kind: f.kind, original: f.original } });
      plain += f.replacement;
    } else {
      buffer += ch;
      plain += ch;
    }
  }
  if (buffer) segments.push({ text: buffer });

  const counts = new Map<string, number>();
  found.forEach((f) => counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1));
  return { text: plain, segments, removed: [...counts].map(([kind, count]) => ({ kind, count })) };
}

export function redact(text: string): { text: string; removed: Removal[] } {
  const { text: t, removed } = redactSegments(text);
  return { text: t, removed };
}
