// Prepared explanations for the five fictional sample reports.
// Written ahead of time by Claude (AI), following the same rules as the live
// agent, using ONLY each report's text and the PubMed abstracts listed.
// At run time, titles and years are re-fetched from PubMed, so they are always real.
import type { Explanation } from "./agent";
import { redact } from "./redact";

type Prepared = { query: string; data: Explanation };

const QUESTIONS_EN = [
  "What does this result mean for me?",
  "Is there anything I should do or change before my next check?",
  "Do I need any other tests?",
  "When should I contact you sooner?",
];

const CAUTION_EN =
  "Prepared example: this explanation was written ahead of time by AI (Claude) using only your report and the PubMed abstracts linked above. It has not been reviewed by a clinician.";

const sarah: Explanation = {
  summary:
    "Your document says an ultrasound showed findings \"consistent with mild hepatic steatosis\", which means a small amount of extra fat in the liver. A liver blood test, ALT, was 52 U/L, above the reference range of 7-35. The plan in your report is lifestyle counselling and a repeat assessment in 3 months.",
  terms: [
    {
      term: "Hepatic steatosis",
      plain_meaning: "Extra fat stored in the liver. \"Hepatic\" means liver. \"Steatosis\" means fat build-up.",
      in_your_document: "Findings consistent with mild hepatic steatosis.",
    },
    {
      term: "Consistent with",
      plain_meaning: "The pictures look like this finding. It describes what was seen.",
      in_your_document: "Findings consistent with mild hepatic steatosis.",
    },
    { term: "Mild", plain_meaning: "A small amount, or an early stage.", in_your_document: "mild hepatic steatosis" },
    {
      term: "ALT",
      plain_meaning: "An enzyme made mostly in the liver, measured with a blood test. A higher level can be a sign the liver is irritated.",
      in_your_document: "ALT 52 U/L (reference 7-35).",
    },
    {
      term: "Reference range",
      plain_meaning: "The usual range of results for most healthy people. Labs can use slightly different ranges.",
      in_your_document: "reference 7-35",
    },
    {
      term: "Ultrasound",
      plain_meaning: "A scan that uses sound waves to make pictures of the inside of the body. It does not use radiation.",
      in_your_document: "Ultrasound: Findings consistent with mild hepatic steatosis.",
    },
  ],
  findings: [
    {
      from_document: "Ultrasound: Findings consistent with mild hepatic steatosis.",
      explanation:
        "Your document says the ultrasound pictures look like a mild amount of fat in the liver. The word \"mild\" is part of the report.",
    },
    {
      from_document: "Liver enzymes: ALT 52 U/L (reference 7-35).",
      explanation:
        "Your document says your ALT was 52 U/L. The usual range written in the report is 7-35 U/L, so this result is above that range.",
    },
  ],
  research: [
    {
      pmid: "33894145",
      title: "",
      year: "",
      what_it_found:
        "Research suggests fatty liver disease is common, affecting about 25% of people worldwide, and that a healthy lifestyle and weight reduction remain crucial to its prevention and treatment (PMID 33894145).",
      limitation: "This is a review of other studies. It describes people in general, not your situation.",
    },
    {
      pmid: "37402873",
      title: "",
      year: "",
      what_it_found:
        "Research suggests the main approach is a healthy lifestyle: for example, eating more fruits, nuts, whole grains and fish, fewer sugary drinks and ultra-processed foods, and being active at a level where you can talk but not sing (PMID 37402873).",
      limitation: "A review article. It gives general advice from studies, not a plan for one person.",
    },
    {
      pmid: "29858436",
      title: "",
      year: "",
      what_it_found:
        "Research suggests only a minority of people with fatty liver go on to develop scarring (fibrosis) and liver problems, and that lifestyle change and weight loss are the cornerstone of care (PMID 29858436).",
      limitation: "A review from 2018. Some names and treatments in this field have changed since then.",
    },
  ],
  organ_for_visual: "liver",
  follow_up:
    "Your document says: \"Plan: Lifestyle counselling; repeat assessment in 3 months.\" This is a planned check in 3 months. It is not a prediction of what the result will be.",
  questions_to_ask: [
    "What does \"mild hepatic steatosis\" mean for me?",
    "Why might my ALT be above the reference range?",
    "What will lifestyle counselling involve?",
    "What will the repeat assessment in 3 months include?",
  ],
  caution: CAUTION_EN,
};

const daniel: Explanation = {
  summary:
    "Your document says your blood pressure at the clinic was 148/92 mmHg on two visits. The reference written in the report is below 140/90 mmHg. The plan is to measure your blood pressure at home for 2 weeks, then have a follow-up appointment in 4 weeks.",
  terms: [
    {
      term: "Blood pressure",
      plain_meaning:
        "How hard your blood pushes on the walls of your blood vessels. The top number is when the heart beats. The bottom number is when it rests between beats.",
      in_your_document: "Clinic blood pressure: 148/92 mmHg on two visits",
    },
    { term: "mmHg", plain_meaning: "The unit used to measure blood pressure.", in_your_document: "148/92 mmHg" },
    {
      term: "Home blood pressure monitoring",
      plain_meaning: "Measuring your own blood pressure at home with a machine, and writing down the results.",
      in_your_document: "Home blood pressure monitoring for 2 weeks",
    },
  ],
  findings: [
    {
      from_document: "Clinic blood pressure: 148/92 mmHg on two visits (reference below 140/90 mmHg).",
      explanation:
        "Your document says both numbers, 148 and 92, were higher than the reference of 140/90 mmHg, on two different visits.",
    },
  ],
  research: [
    {
      pmid: "39657954",
      title: "",
      year: "",
      what_it_found:
        "Research suggests home blood pressure monitoring is a validated way to measure blood pressure outside the clinic, and gives useful information for diagnosing and managing high blood pressure (PMID 39657954).",
      limitation: "A review article. It summarises other studies and guidelines rather than testing something new.",
    },
    {
      pmid: "30310433",
      title: "",
      year: "",
      what_it_found:
        "Research suggests home monitoring can help spot \"white-coat\" readings (blood pressure that is higher at the clinic), and that home machines need to be validated because some give inaccurate readings (PMID 30310433).",
      limitation: "A short review from 2015. Newer guidelines may add more detail.",
    },
  ],
  organ_for_visual: "heart",
  follow_up:
    "Your document says: \"Plan: Home blood pressure monitoring for 2 weeks; follow-up appointment in 4 weeks.\" These are planned steps. They are not a prediction of what your readings will show.",
  questions_to_ask: [
    "How and when should I take my blood pressure at home?",
    "Is my home machine a validated one?",
    "What should I bring to my follow-up appointment in 4 weeks?",
    "When should I contact you sooner?",
  ],
  caution: CAUTION_EN,
};

const priya: Explanation = {
  summary:
    "Your document says your HbA1c was 6.2% (reference below 6.0%) and your fasting glucose was 6.3 mmol/L (reference 3.9-6.0). The comment says the values are above the reference range, and that testing will be repeated in 3 months.",
  terms: [
    {
      term: "HbA1c",
      plain_meaning: "A blood test that shows your average blood sugar over the past 2 to 3 months.",
      in_your_document: "HbA1c: 6.2% (reference below 6.0%).",
    },
    {
      term: "Fasting glucose",
      plain_meaning: "The amount of sugar in your blood after not eating for at least 8 hours.",
      in_your_document: "Fasting glucose: 6.3 mmol/L (reference 3.9-6.0).",
    },
    { term: "mmol/L", plain_meaning: "A unit used to measure how much sugar is in the blood.", in_your_document: "6.3 mmol/L" },
    {
      term: "Reference range",
      plain_meaning: "The usual range of results for most healthy people.",
      in_your_document: "Values above reference range.",
    },
  ],
  findings: [
    {
      from_document: "HbA1c: 6.2% (reference below 6.0%).",
      explanation: "Your document says your HbA1c was 6.2%, which is above the reference of below 6.0% written in the report.",
    },
    {
      from_document: "Fasting glucose: 6.3 mmol/L (reference 3.9-6.0).",
      explanation: "Your document says your fasting glucose was 6.3 mmol/L, which is above the reference range of 3.9-6.0.",
    },
  ],
  research: [
    {
      pmid: "37039787",
      title: "",
      year: "",
      what_it_found:
        "Research describes \"prediabetes\" as a stage between normal blood sugar and diabetes, and says the first approach is lifestyle change, including weight loss and exercise. Some definitions in this review use HbA1c ranges such as 5.7% to 6.4% or 6.0% to 6.4% (PMID 37039787).",
      limitation: "Only your healthcare professional can say whether these definitions apply to you. The review is based on US data and uses mg/dL for glucose.",
    },
    {
      pmid: "22683128",
      title: "",
      year: "",
      what_it_found:
        "Research suggests that each year about 5-10% of people with prediabetes progress to diabetes, and about the same share go back to normal blood sugar (PMID 22683128).",
      limitation: "A review from 2012. These are averages across large groups of people, not a prediction for one person.",
    },
    {
      pmid: "35151523",
      title: "",
      year: "",
      what_it_found:
        "Research combining many trials found that more people in lifestyle programmes reached normal blood sugar levels than people in control groups (PMID 35151523).",
      limitation: "Results come from many different studies and programmes, which makes them hard to compare exactly.",
    },
  ],
  organ_for_visual: "",
  follow_up:
    "Your document says: \"Repeat testing in 3 months.\" This is a planned check. It is not a prediction of what the next result will be.",
  questions_to_ask: [
    "What do my HbA1c and fasting glucose results mean for me?",
    "Is there anything I could do before the repeat test in 3 months?",
    "Do I need to fast before the next test?",
    "When should I contact you sooner?",
  ],
  caution: CAUTION_EN,
};

const omar: Explanation = {
  summary:
    "Your document says the chest X-ray showed \"no acute abnormality\" in the lungs or heart, which means nothing urgent or new was seen. It also mentions mild degenerative changes of the thoracic spine. The plan says no further imaging is planned at this time.",
  terms: [
    {
      term: "No acute abnormality",
      plain_meaning: "Nothing urgent or new was seen.",
      in_your_document: "No acute abnormality seen in the lungs or heart.",
    },
    {
      term: "Degenerative changes",
      plain_meaning: "Wear and tear in the bones or joints that often happens with age.",
      in_your_document: "Mild degenerative changes of the thoracic spine.",
    },
    {
      term: "Thoracic spine",
      plain_meaning: "The middle part of your backbone, behind your chest.",
      in_your_document: "Mild degenerative changes of the thoracic spine.",
    },
    { term: "Mild", plain_meaning: "A small amount, or an early stage.", in_your_document: "Mild degenerative changes" },
  ],
  findings: [
    {
      from_document: "Chest X-ray: No acute abnormality seen in the lungs or heart.",
      explanation: "Your document says nothing urgent or new was seen in the lungs or heart.",
    },
    {
      from_document: "Mild degenerative changes of the thoracic spine.",
      explanation: "Your document says there are mild wear-and-tear changes in the middle part of the backbone.",
    },
  ],
  research: [
    {
      pmid: "42442882",
      title: "",
      year: "",
      what_it_found:
        "Research suggests spine degeneration builds up over time, and is partly due to normal aging and partly due to other conditions. The line between the two is not always clear (PMID 42442882).",
      limitation: "This review is about spine imaging in general, mostly MRI. It is not about chest X-rays.",
    },
    {
      pmid: "27430442",
      title: "",
      year: "",
      what_it_found: "Research describes degenerative disease as the most frequent condition affecting the spine (PMID 27430442).",
      limitation: "A book chapter about reading scans, written for doctors. The evidence about what this means for patients is limited.",
    },
  ],
  organ_for_visual: "spine",
  follow_up:
    "Your document says: \"Plan: No further imaging planned at this time.\" This is the plan written in your report.",
  questions_to_ask: [
    "What do the mild degenerative changes mean for me?",
    "Is there anything I should watch for?",
    "When should I contact you if something changes?",
  ],
  caution: CAUTION_EN,
};

const amina: Explanation = {
  summary:
    "Votre document indique que l'échographie montre des résultats « compatibles avec une stéatose hépatique légère », c'est-à-dire un peu de graisse en trop dans le foie. Votre ALT, une prise de sang pour le foie, est de 52 U/L, au-dessus de la référence de 7-35. Le plan prévoit des conseils sur le mode de vie et une nouvelle évaluation dans 3 mois.",
  terms: [
    {
      term: "Stéatose hépatique",
      plain_meaning: "De la graisse stockée en trop dans le foie. « Hépatique » veut dire « du foie ».",
      in_your_document: "Résultats compatibles avec une stéatose hépatique légère.",
    },
    {
      term: "Compatibles avec",
      plain_meaning: "Les images ressemblent à ce résultat. C'est une description de ce qui a été vu.",
      in_your_document: "Résultats compatibles avec une stéatose hépatique légère.",
    },
    { term: "Légère", plain_meaning: "Une petite quantité, ou un stade précoce.", in_your_document: "stéatose hépatique légère" },
    {
      term: "ALT",
      plain_meaning: "Une enzyme fabriquée surtout par le foie, mesurée par une prise de sang. Un taux plus élevé peut indiquer que le foie est irrité.",
      in_your_document: "ALT 52 U/L (référence 7-35).",
    },
    {
      term: "Échographie",
      plain_meaning: "Un examen qui utilise des ondes sonores pour faire des images de l'intérieur du corps. Il n'utilise pas de rayons.",
      in_your_document: "Échographie : Résultats compatibles avec une stéatose hépatique légère.",
    },
  ],
  findings: [
    {
      from_document: "Échographie : Résultats compatibles avec une stéatose hépatique légère.",
      explanation: "Votre document indique que les images ressemblent à une légère quantité de graisse dans le foie.",
    },
    {
      from_document: "Enzymes hépatiques : ALT 52 U/L (référence 7-35).",
      explanation: "Votre document indique une ALT à 52 U/L. La référence écrite dans le rapport est de 7-35 U/L, donc ce résultat est au-dessus.",
    },
  ],
  research: [
    {
      pmid: "33894145",
      title: "",
      year: "",
      what_it_found:
        "La recherche suggère que la stéatose du foie est fréquente (environ 25 % des personnes dans le monde) et qu'un mode de vie sain et la perte de poids restent essentiels pour la prévenir et la traiter (PMID 33894145).",
      limitation: "Un article de synthèse. Il décrit les personnes en général, pas votre situation.",
    },
    {
      pmid: "37402873",
      title: "",
      year: "",
      what_it_found:
        "La recherche suggère que l'approche principale est un mode de vie sain : par exemple plus de fruits, de noix, de céréales complètes et de poisson, moins de boissons sucrées et d'aliments ultra-transformés, et une activité physique où l'on peut parler mais pas chanter (PMID 37402873).",
      limitation: "Un article de synthèse. Ce sont des conseils généraux, pas un plan pour une personne.",
    },
    {
      pmid: "29858436",
      title: "",
      year: "",
      what_it_found:
        "La recherche suggère que seule une minorité des personnes avec une stéatose développe une cicatrisation du foie (fibrose), et que le changement de mode de vie est la base de la prise en charge (PMID 29858436).",
      limitation: "Un article de 2018. Certains noms et traitements ont changé depuis.",
    },
  ],
  organ_for_visual: "liver",
  follow_up:
    "Votre document indique : « Plan : Conseils sur le mode de vie; nouvelle évaluation dans 3 mois. » C'est un contrôle prévu dans 3 mois. Ce n'est pas une prédiction du résultat.",
  questions_to_ask: [
    "Que signifie « stéatose hépatique légère » pour moi ?",
    "Pourquoi mon ALT peut-elle être au-dessus de la référence ?",
    "En quoi consisteront les conseils sur le mode de vie ?",
    "Que comprendra la nouvelle évaluation dans 3 mois ?",
  ],
  caution:
    "Exemple préparé : cette explication a été écrite à l'avance par une IA (Claude) à partir de votre rapport et des résumés PubMed ci-dessus uniquement. Elle n'a pas été vérifiée par un clinicien.",
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export const PREPARED: Record<string, Prepared> = {
  sarah: { query: "fatty liver[ti] AND lifestyle[tiab] AND review[pt]", data: sarah },
  daniel: { query: "home blood pressure monitoring[ti] AND review[pt]", data: daniel },
  priya: { query: "prediabetes[ti] AND review[pt]", data: priya },
  omar: { query: "spine[ti] AND degenerative[ti] AND aging[tiab]", data: omar },
  amina: { query: "fatty liver[ti] AND lifestyle[tiab] AND review[pt]", data: amina },
};

export function findPrepared(report: string, samples: { label: string; text: string }[]): Prepared | null {
  const r = norm(report);
  const match = samples.find((s) => norm(s.text) === r || norm(redact(s.text).text) === r);
  if (!match) return null;
  const key = match.label.split(" ")[0].toLowerCase();
  return PREPARED[key] ?? null;
}
