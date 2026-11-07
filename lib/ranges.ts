// Reads lab values and reference ranges from report lines and works out, exactly,
// whether each value is inside, above or below the range written in the report.
// No AI is involved: this is plain arithmetic on the report's own numbers.

export type RangeResult = {
  name: string;
  valueText: string; // exactly as written, e.g. "6.8 mIU/L"
  rangeText: string; // exactly as written, e.g. "0.4-4.0"
  status: "inside" | "above" | "below";
};

const num = (s: string) => parseFloat(s.replace(",", "."));

export function readRange(line: string): RangeResult | null {
  // 1. The reference range, written in brackets: "(reference 0.4-4.0)"
  const ref = line.match(/\((?:reference|référence|ref\.?|normal(?: range)?)\s*:?\s*([^)]+)\)/i);
  if (!ref || ref.index === undefined) return null;
  const rangeText = ref[1].trim();
  const before = line.slice(0, ref.index);

  // 2. The value: the first number not glued to a word (so "HbA1c" or "T4" are not read as values).
  const vm = before.match(/(?<![A-Za-zÀ-ÿ0-9.,])(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?\s*(%|[A-Za-zµ]+\/[A-Za-z]+|[A-Za-zµ]+)?/);
  if (!vm || vm.index === undefined) return null;
  const v1 = num(vm[1]);
  const v2 = vm[2] ? num(vm[2]) : null;
  const unit = vm[3] && !/^(on|in|at|x)$/i.test(vm[3]) ? vm[3] : "";
  const valueText = `${vm[1]}${vm[2] ? "/" + vm[2] : ""}${unit ? (unit === "%" ? "%" : " " + unit) : ""}`;

  // 3. The name: the words just before the value ("TSH", "ALT", "Clinic blood pressure").
  const head = before.slice(0, vm.index).replace(/[\s:]+$/, "");
  const parts = head.split(":").map((x) => x.trim()).filter(Boolean);
  let name = (parts.at(-1) ?? "").replace(/^(clinic|liver enzymes|enzymes hépatiques)\s+/i, "").trim();
  if (!name) name = "test";

  // 4. Compare, using only the report's own numbers.
  const below = rangeText.match(/^(?:below|under|less than|<|inférieur à|moins de)\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+(?:[.,]\d+)?))?/i);
  if (below) {
    const a = num(below[1]);
    const b = below[2] ? num(below[2]) : null;
    const over = v1 >= a || (v2 !== null && b !== null && v2 >= b);
    return { name, valueText, rangeText, status: over ? "above" : "inside" };
  }
  const above = rangeText.match(/^(?:above|over|more than|greater than|>|supérieur à)\s*(\d+(?:[.,]\d+)?)/i);
  if (above) return { name, valueText, rangeText, status: v1 <= num(above[1]) ? "below" : "inside" };
  const span = rangeText.match(/(\d+(?:[.,]\d+)?)\s*(?:-|–|to|à)\s*(\d+(?:[.,]\d+)?)/i);
  if (span) {
    const lo = num(span[1]), hi = num(span[2]);
    return { name, valueText, rangeText, status: v1 < lo ? "below" : v1 > hi ? "above" : "inside" };
  }
  return null;
}

export function rangeSentence(r: RangeResult): string {
  const where = r.status === "inside" ? "inside" : r.status === "above" ? "above" : "below";
  return `Your ${r.name} result is ${r.valueText}. The reference range written in your report is ${r.rangeText}, so this result is ${where} that range.`;
}
