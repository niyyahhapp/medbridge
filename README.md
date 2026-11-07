# MedBridge

Paste a medical report and get a plain-language explanation, backed by real PubMed research, that you can also listen to.

- An AI agent reads the report, calls `search_pubmed` and `get_abstracts` (NCBI E-utilities), then writes the explanation.
- Every article shown is checked against what was actually retrieved from PubMed; titles and years come from PubMed, not the AI.
- "Listen to this explanation" reads it aloud with ElevenLabs (multilingual, so the French report is read in French).
- MedBridge explains information. It does not diagnose, recommend treatment, or replace a healthcare professional. All sample patients are fictional.

## Run it

1. Copy `.env.example` to `.env.local` and fill in an AI key (Anthropic or OpenAI) and an ElevenLabs key.
2. `npm install`
3. `npm run dev`, then open http://localhost:3000

## Deploy

Import this repository on Vercel and add the same keys under Settings → Environment Variables.
