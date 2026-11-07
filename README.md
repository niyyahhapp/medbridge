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

## Run the agent locally with llama.cpp

1. Start llama.cpp's server with tool calling on: `llama-server -m your-model.gguf --port 8080 --jinja`
2. In `.env.local` set `OPENAI_BASE_URL=http://localhost:8080/v1`
3. `npm run dev` and open http://localhost:3000

Use a model that supports tool calling (for example a Qwen or Llama instruct model).

## Modes

- **AI agent**: when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `OPENAI_BASE_URL` is set.
- **Prepared example**: with no AI connected, the five sample reports show explanations written ahead of time by Claude from the linked abstracts; PubMed is still called live and titles/years come from PubMed.
- **Basic mode**: any other report with no AI connected gets live PubMed results, a built-in plain-language glossary, and direct quotes from abstracts.
- **Voice**: ElevenLabs when `ELEVENLABS_API_KEY` is set, otherwise the browser's built-in voice.

## Deploy

Import this repository on Vercel and add the same keys under Settings → Environment Variables.
