// Finds likely medical words in a report without AI, using how medical words are built:
// endings like -itis, -osis, -emia, prefixes like hyper-/hypo-, short abbreviations like LDL,
// and the phrase after "consistent with", "suggestive of", "impression:" and similar.
import { GLOSSARY } from "./glossary";

const ADJ = "(?:(?:left|right|[a-z]+(?:al|ar|ic|ary|ous|ive|ial))\\s+){0,2}";
const SUFFIX_CORE =
  "[a-z]{3,}(?:itis|osis|oses|emia|aemia|oma|omas|pathy|ectomy|otomy|plasia|algia|megaly|uria|penia|trophy|sclerosis|stenosis|ectasis|lithiasis|cele|rrhea|rrhoea|ism|edema|oedema|plegia|paresis|lysis|genesis|cytosis|ectasia|graphy|scopy|emesis)";
// Common report words that do not follow the usual patterns.
const LEXICON =
  "emphysema|regurgitation|nodule|nodules|effusion|atelectasis|consolidation|sludge|polyp|polyps|fibroids?|aneurysm|embolus|thrombus|calcification|calcifications|lesion|lesions|opacity|opacities|infiltrate|hernia|herniation|fracture|steatosis|cirrhosis|fibrosis|murmur|arrhythmia|tachycardia|bradycardia|fibrillation|ischemia|infarct|infarction|ascites|cyst|cysts|adenopathy|lymphadenopathy|osteophytes?|spondylolisthesis|scoliosis|kyphosis|proteinuria|hematuria|anemia|anaemia";
const SUFFIX = new RegExp(`\\b${ADJ}(?:${SUFFIX_CORE}|${LEXICON})\\b`, "gi");
const PREFIX = /\b(?:hyper|hypo|peri|intra|sub|cardio|hepat|nephr|neuro|osteo|gastro|dermat|pulmon|thyro|haemo|hemo|myo|angio|arterio|cholecyst|chole)[a-z]{4,}\b/gi;
const PHRASE =
  /(?:consistent with|compatible with|suggestive of|in keeping with|suspicious for|evidence of|findings of|impression\s*:|diagnosis\s*:)\s*(?:an?\s+|the\s+)?(?:mild|moderate|severe|early|small|minimal|possible|probable)?\s*([a-z][a-z\- ]{3,40}?)(?=[.,;\n]|$)/gi;
const ABBR = /\b[A-Z][A-Za-z]?[A-Z]{1,4}[0-9]?\b/g;

// Common words that look medical but are not worth looking up.
const STOP = new Set(
  "patient plan comment report results result findings reference range normal abnormal history mechanism organism criticism tourism fictional fictive within prism optimism tests test values value repeat assessment follow appointment imaging seen noted further time".split(" "),
);
const ABBR_STOP = new Set(["DOB", "ID", "MRN", "PDF", "USA", "USD", "AM", "PM", "OK", "NB", "DR", "MD", "RN", "ER", "ICU", "OHIP", "SIN", "SSN", "RAMQ"]);

export function findMedicalTerms(report: string, max = 6): string[] {
  const text = report.replace(/\[[^\]]*removed\]/g, " ");
  const found: string[] = [];
  const add = (t: string) => {
    const term = t.trim().replace(/\s+/g, " ");
    const low = term.toLowerCase();
    if (term.length < 3 || STOP.has(low)) return;
    if (GLOSSARY.some((g) => g.match.test(term))) return; // already explained by the glossary
    if (found.some((f) => f.toLowerCase() === low || f.toLowerCase().includes(low))) return;
    found.push(term);
  };
  for (const m of text.matchAll(PHRASE)) add(m[1]);
  for (const m of text.matchAll(SUFFIX)) add(m[0]);
  for (const m of text.matchAll(PREFIX)) add(m[0]);
  for (const m of text.matchAll(ABBR)) if (!ABBR_STOP.has(m[0])) add(m[0]);
  return found.slice(0, max);
}
