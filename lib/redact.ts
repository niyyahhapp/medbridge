// Removes personal details from a report BEFORE it leaves the browser.
// Runs in the browser, and again on the server as a second safety net.
// It cannot be perfect, so the page also tells people not to paste personal details.

export type Removal = { kind: string; count: number };

const RULES: { kind: string; re: RegExp; replace: string | ((...m: string[]) => string) }[] = [
  // "Patient: Sarah", "Name: ...", "Nom : ...", "Patient : Amina (fictive)"
  {
    kind: "Name",
    re: /^(\s*(?:patient(?:\s+name)?|name|full name|nom(?:\s+du\s+patient)?|patient\(e\))\s*:\s*)(.+)$/gim,
    replace: (_m, label) => `${label}[name removed]`,
  },
  {
    kind: "Doctor or staff name",
    re: /\b(Dr\.?|Doctor|Docteur|Nurse|Mr\.?|Mrs\.?|Ms\.?|Mme|M\.)\s+[A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?/gu,
    replace: "[name removed]",
  },
  { kind: "Email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replace: "[email removed]" },
  {
    kind: "Date of birth",
    re: /^(\s*(?:dob|d\.o\.b\.?|date of birth|birth ?date|date de naissance|né\(?e?\)? le)\s*:?\s*)(.+)$/gim,
    replace: (_m, label) => `${label}[date of birth removed]`,
  },
  {
    kind: "ID or record number",
    re: /^(\s*(?:mrn|medical record(?: number| no\.?)?|health ?card(?: number| no\.?)?|ohip|ramq|nas|sin|ssn|insurance(?: number| no\.?)?|patient id|id|chart(?: number| no\.?)?|numéro de dossier|n° de dossier)\s*[:#]?\s*)(.+)$/gim,
    replace: (_m, label) => `${label}[ID removed]`,
  },
  { kind: "Address", re: /^(\s*(?:address|adresse)\s*:\s*)(.+)$/gim, replace: (_m, label) => `${label}[address removed]` },
  {
    kind: "Phone number",
    re: /(?<![\d/.-])(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\d/])/g,
    replace: "[phone removed]",
  },
  // Long numbers (7+ digits) are usually IDs, never lab values.
  { kind: "ID or record number", re: /\b\d{7,}\b/g, replace: "[ID removed]" },
  // Canadian postal code / US ZIP+4
  { kind: "Postal code", re: /\b[A-CEGHJ-NPRSTVXY]\d[A-CEGHJ-NPRSTV-Z][ -]?\d[A-CEGHJ-NPRSTV-Z]\d\b/gi, replace: "[postal code removed]" },
  { kind: "Postal code", re: /\b\d{5}-\d{4}\b/g, replace: "[postal code removed]" },
  // Full dates like 12/03/1985, 1985-03-12, 12 March 1985 (not lab values like 148/92 or 7-35)
  {
    kind: "Date",
    re: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}|(?:19|20)\d{2}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)[a-zéû]*\.?\s+(?:19|20)\d{2})\b/gi,
    replace: "[date removed]",
  },
];

export function redact(text: string): { text: string; removed: Removal[] } {
  const counts = new Map<string, number>();
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, (...m: string[]) => {
      counts.set(rule.kind, (counts.get(rule.kind) ?? 0) + 1);
      return typeof rule.replace === "string" ? rule.replace : rule.replace(...m);
    });
  }
  return { text: out, removed: [...counts].map(([kind, count]) => ({ kind, count })) };
}
