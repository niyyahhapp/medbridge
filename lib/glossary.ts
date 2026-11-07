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
    match: /(?<![A-Za-z])U\/L\b/,
    plain: "Units per litre. A unit used to measure enzymes in the blood.",
  },
  // ---- More common report terms (thyroid, blood counts, kidneys, cholesterol, scans) ----
  {
    term: "TSH (thyroid-stimulating hormone)",
    match: /\bTSH\b|thyr[eé]ostimuline/i,
    plain: "A hormone from the pituitary gland, at the base of the brain, that tells the thyroid how much hormone to make. A TSH above the usual range can be a sign the thyroid is less active. One result alone does not confirm a lasting condition, so it is often checked again.",
    query: "subclinical hypothyroidism[ti] AND review[pt]",
    organ: "thyroid",
  },
  {
    term: "Free T4",
    match: /\b(free )?T4\b|thyroxine/i,
    plain: "The main thyroid hormone in the blood. \"Free\" means the part not attached to proteins. The body turns much of it into T3, the more active form.",
    query: "thyroxine thyroid function tests[ti]",
    organ: "thyroid",
  },
  {
    term: "Subclinical hypothyroidism",
    match: /subclinical hypothyroidism|hypothyro[iï]die (fruste|infraclinique)/i,
    plain: "A pattern where TSH is above the usual range but the thyroid hormone (T4) is still in the usual range. \"Subclinical\" means it is found on a blood test, often without clear symptoms.",
    query: "subclinical hypothyroidism[ti] AND review[pt]",
    organ: "thyroid",
  },
  {
    term: "Hypothyroidism",
    match: /\bhypothyroidism\b/i,
    plain: "When the thyroid gland makes less thyroid hormone than the body needs.",
    query: "hypothyroidism[ti] AND review[pt]",
    organ: "thyroid",
  },
  {
    term: "Hyperthyroidism",
    match: /hyperthyroidism/i,
    plain: "When the thyroid gland makes more thyroid hormone than the body needs.",
    query: "hyperthyroidism[ti] AND review[pt]",
    organ: "thyroid",
  },
  {
    term: "Thyroid antibodies",
    match: /thyroid antibod|anti-?TPO|TPO antibod/i,
    plain: "A blood test that looks for immune-system proteins that can react against the thyroid gland. The most common one is TPO (thyroid peroxidase) antibodies, used to check for autoimmune thyroid conditions such as Hashimoto's thyroiditis.",
  },
  {
    term: "Thyroid nodule",
    match: /thyroid nodule/i,
    plain: "A lump or growth in the thyroid gland. Most thyroid nodules are not cancer.",
    query: "thyroid nodules[ti] AND review[pt]",
    organ: "thyroid",
  },
  {
    term: "LDL cholesterol",
    match: /\bLDL\b/i,
    plain: "Often called \"bad\" cholesterol. It is a type of fat in the blood that can build up in blood vessels.",
    query: "LDL cholesterol[ti] AND cardiovascular risk AND review[pt]",
    organ: "heart",
  },
  {
    term: "HDL cholesterol",
    match: /\bHDL\b/i,
    plain: "Often called \"good\" cholesterol. It helps carry cholesterol away from blood vessels.",
  },
  { term: "Triglycerides", match: /triglycerides?/i, plain: "A type of fat in the blood that comes from food and is stored for energy.", query: "hypertriglyceridemia[ti] AND review[pt]" },
  {
    term: "Hemoglobin",
    match: /h(a)?emoglobin(?!\s*a1c)|\bHgb\b|\bHb\b(?!A1c)/i,
    plain: "The protein in red blood cells that carries oxygen around the body.",
    query: "anemia[ti] AND evaluation[tiab] AND review[pt]",
  },
  { term: "Anemia", match: /an(a)?emia/i, plain: "When there are fewer red blood cells or less hemoglobin than usual, so the body gets less oxygen.", query: "anemia[ti] AND evaluation[tiab] AND review[pt]" },
  { term: "Ferritin", match: /ferritin/i, plain: "A blood test that shows how much iron the body has stored.", query: "iron deficiency[ti] AND ferritin AND review[pt]" },
  { term: "Vitamin D", match: /vitamin d|25-?OH/i, plain: "A vitamin that helps the body use calcium to keep bones strong.", query: "vitamin D deficiency[ti] AND review[pt]" },
  { term: "Vitamin B12", match: /\bB12\b|cobalamin/i, plain: "A vitamin the body needs to make red blood cells and keep nerves healthy.", query: "vitamin B12 deficiency[ti] AND review[pt]" },
  {
    term: "Creatinine",
    match: /creatinine/i,
    plain: "A waste product that the kidneys filter out of the blood. It is used to check how well the kidneys are working.",
    query: "chronic kidney disease[ti] AND diagnosis AND review[pt]",
    organ: "kidneys",
  },
  {
    term: "eGFR",
    match: /\beGFR\b|glomerular filtration/i,
    plain: "An estimate of how well the kidneys filter the blood. A lower number means the kidneys are filtering less.",
    query: "chronic kidney disease[ti] AND diagnosis AND review[pt]",
    organ: "kidneys",
  },
  { term: "CRP (C-reactive protein)", match: /\bCRP\b|c-reactive protein/i, plain: "A blood test that rises when there is inflammation somewhere in the body." },
  { term: "White blood cells", match: /white blood cell|\bWBC\b|leukocyte/i, plain: "Blood cells that help the body fight infections." },
  { term: "Platelets", match: /platelets?|\bPLT\b/i, plain: "Small blood cells that help blood clot and stop bleeding." },
  { term: "Gallstones", match: /gallstones?|cholelithiasis/i, plain: "Small, hard pieces that form in the gallbladder, a small organ under the liver.", query: "gallstones[ti] AND review[pt]", organ: "liver" },
  { term: "Nodule", match: /\bnodules?\b/i, plain: "A small lump or spot. Many nodules are harmless, and some are checked again later." },
  { term: "Cyst", match: /\bcysts?\b/i, plain: "A small pocket filled with fluid. Many cysts are harmless." },
  { term: "Osteopenia", match: /osteopenia/i, plain: "Bones that are a little less dense than usual, but not as thin as in osteoporosis.", query: "osteopenia[ti] AND review[pt]", organ: "spine" },
  { term: "Osteoporosis", match: /osteoporosis/i, plain: "Thin, weaker bones that can break more easily.", query: "osteoporosis[ti] AND review[pt]", organ: "spine" },
  { term: "Elevated / above range", match: /\b(elevated|raised|high)\b|above (the )?(reference|normal)/i, plain: "Higher than the usual range written in the report." },
  { term: "mIU/L", match: /\bmIU\/L\b/i, plain: "A unit used to measure hormones such as TSH in the blood." },
  { term: "pmol/L", match: /\bpmol\/L\b/i, plain: "A unit used to measure very small amounts of a substance, such as thyroid hormone, in the blood." },
  { term: "MRI", match: /\bMRI\b/, plain: "A scan that uses strong magnets and radio waves to make detailed pictures of the inside of the body. It does not use radiation." },
  { term: "CT scan", match: /\bCT\b|computed tomography/i, plain: "A scan that uses X-rays and a computer to make detailed cross-section pictures of the body." },
  { term: "Echocardiogram (echo)", match: /\becho(cardiogram)?\b/i, plain: "An ultrasound of the heart. It shows how the heart's chambers and valves are working." },
  { term: "MCV", match: /\bMCV\b/, plain: "Mean corpuscular volume: the average size of your red blood cells. Smaller than usual is called microcytic." },
  { term: "Herniation", match: /herniat/i, plain: "When part of something pushes out of its usual place, for example a spinal disc bulging out." },
];

