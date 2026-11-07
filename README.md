# MedBridge

Paste a medical report and get a plain-language explanation, backed by real PubMed research, that you can also listen to.

- Upload files to be processed with the help of **OCR** or paste text directly.
- Private information such as names, health card info is automatically hidden. Nothing is stored. 
- An **AI agent** reads the report and searches the PubMed database for the explaination. 
- Every article shown is checked against what was actually retrieved from PubMed; information comes from PubMed, not the
- It does not diagnose, recommend treatment, or replace a healthcare professional. All sample patients are fictional.
- **Translation**: Translate the explaination to a language you understand with DeepL.
- **TTS**: Have the information read aloud to you with ElevenLabs.

## Concerned about privacy? 
You can get information without sending any information externally by with the private mode. Private mode will use Natural Language Processing **(NLP)** on the client side instead of an LLM to create an explaination.
It identifies medical terms using pattern matching and regular expressions, retrieves simple definitions from a glossary, and finally makes sure its similarity score is above a certain threshold.
Then, it searches these terms in the PubMed database to create your explaination as usual.

All of your information stays in your browser, without being sent to any other server!

## Run it
1. Copy `.env.example` to `.env.local` and fill in an OpenAPI compatible key and an ElevenLabs key.
2. `npm install`
3. `npm run dev`, then open http://localhost:3000
