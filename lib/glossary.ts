// Built-in plain-language glossary used when the AI is not connected.
// Written at about a Grade 6 reading level. Educational only.
export type GlossaryEntry = {
  term: string;
  match: RegExp;
  plain: string;
  query?: string; // PubMed search used when this is the main topic
  organ?: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Hepatic steatosis",
    match: /hepatic steatosis|st[ée]atose h[ée]patique|fatty liver/i,
    plain: "Extra fat stored in the liver. \"Hepatic\" means liver and \"steatosis\" means fat build-up.",
    query: "fatty liver[ti] AND lifestyle[tiab] AND review[pt]",
    organ: "liver",
  },
  {
    term: "Blood pressure (mmHg)",
    match: /blood pressure|mmhg/i,
    plain:
      "How hard your blood pushes on the walls of your blood vessels. It has two numbers: the top one when the heart beats, the bottom one when it rests. mmHg is the unit.",
    query: "home blood pressure monitoring[ti] AND review[pt]",
    organ: "heart",
  },
  {
    term: "HbA1c",
    match: /hba1c|a1c/i,
    plain: "A blood test that shows your average blood sugar over the past 2 to 3 months.",
    query: "prediabetes[ti] AND review[pt]",
  },
  {
    term: "Degenerative changes",
    match: /degenerative changes/i,
    plain: "Wear and tear in the bones or joints that often happens with age.",
    query: "spine[ti] AND degenerative[ti] AND aging[tiab]",
    organ: "spine",
  },
  {
    term: "ALT (alanine aminotransferase)",
    match: /\bALT\b/,
    plain: "An enzyme made mostly in the liver. A blood test measures it. A higher level can be a sign the liver is irritated.",
    query: "elevated[ti] AND liver enzymes[ti]",
    organ: "liver",
  },
  {
    term: "Fasting glucose",
    match: /fasting glucose/i,
    plain: "The amount of sugar in your blood after not eating for at least 8 hours.",
    query: "impaired fasting glucose[ti] AND review[pt]",
  },
  {
    term: "Consistent with",
    match: /consistent with|compatibles? avec/i,
    plain: "The results look like this finding. It is a description of what was seen, not a final answer on its own.",
  },
  {
    term: "Mild",
    match: /\bmild\b|l[ée]g[èe]re?/i,
    plain: "A small amount, or an early stage.",
  },
  {
    term: "Reference range",
    match: /reference|r[ée]f[ée]rence/i,
    plain: "The usual range of results for most healthy people. Labs can use slightly different ranges.",
  },
  {
    term: "No acute abnormality",
    match: /no acute abnormality/i,
    plain: "Nothing urgent or new was seen.",
  },
  {
    term: "Thoracic spine",
    match: /thoracic spine/i,
    plain: "The middle part of your backbone, behind your chest.",
  },
  {
    term: "Ultrasound",
    match: /ultrasound|[ée]chographie/i,
    plain: "A scan that uses sound waves to make pictures of the inside of the body. It does not use radiation.",
  },
  {
    term: "Chest X-ray",
    match: /x-ray/i,
    plain: "A quick picture of the inside of the chest, showing the lungs, heart and bones.",
  },
  {
    term: "mmol/L",
    match: /mmol\/l/i,
    plain: "A unit used to measure how much sugar is in the blood.",
  },
  {
    term: "U/L",
    match: /u\/l/i,
    plain: "Units per litre. A unit used to measure enzymes in the blood.",
  },
];
