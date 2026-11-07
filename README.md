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

## Featherless

Set `OPENAI_BASE_URL=https://api.featherless.ai/v1`, `OPENAI_API_KEY` (your Featherless key) and `OPENAI_MODEL` (an instruct model from featherless.ai/models). If the model does not support tool calling, MedBridge automatically falls back to a guided pipeline: it searches PubMed itself and the model writes the explanation from those abstracts only.

## Modes

- **AI agent**: when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `OPENAI_BASE_URL` is set.
- **Prepared example**: with no AI connected, the five sample reports show explanations written ahead of time by Claude from the linked abstracts; PubMed is still called live and titles/years come from PubMed.
- **Basic mode**: any other report with no AI connected gets live PubMed results, a built-in plain-language glossary, and direct quotes from abstracts.
- **Files**: PDFs (including scans) and photos are turned into text in the browser with pdf.js and Tesseract; the file is never uploaded.
- **Translation**: the explanation (never the report) can be translated with DeepL (`DEEPL_API_KEY`) or, without it, the connected AI. Off in Private mode.
- **Privacy**: personal details are removed in the browser and again on the server; nothing is stored; Private mode sends nothing to AI companies; delete and auto-delete.
- **Voice**: ElevenLabs when `ELEVENLABS_API_KEY` is set, otherwise the browser's built-in voice.

## Deploy

Import this repository on Vercel and add the same keys under Settings → Environment Variables.
