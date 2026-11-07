"use client";

import { useRef, useState } from "react";
import type { Explanation, Step } from "@/lib/agent";
import { SAMPLE_REPORTS } from "@/lib/reports";
import { OrganFigure, organFrom } from "./OrganFigure";

type StepState = { status: "waiting" | "running" | "done"; detail?: string };

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "read", label: "Reading the report" },
  { key: "search_pubmed", label: "search_pubmed" },
  { key: "get_abstracts", label: "get_abstracts" },
  { key: "write", label: "Writing the explanation" },
];

const freshSteps = (): Record<Step, StepState> => ({
  read: { status: "waiting" },
  search_pubmed: { status: "waiting" },
  get_abstracts: { status: "waiting" },
  write: { status: "waiting" },
});

function textToRead(d: Explanation): string {
  return [
    d.summary,
    ...d.findings.map((f) => f.explanation),
    d.follow_up,
    d.questions_to_ask.length ? d.questions_to_ask.join(" ") : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default function Home() {
  const [report, setReport] = useState(SAMPLE_REPORTS[0].text);
  const [steps, setSteps] = useState(freshSteps());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Explanation | null>(null);

  const [voice, setVoice] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setVoice("idle");
  }

  // Fallback when ElevenLabs is not connected: the browser's built-in voice.
  function speakWithBrowser(text: string, french: boolean): boolean {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = french ? "fr-FR" : "en-US";
    u.rate = 0.95;
    u.onend = () => setVoice("idle");
    u.onerror = () => setVoice("idle");
    synth.speak(u);
    setVoice("playing");
    return true;
  }

  async function run() {
    stopAudio();
    setLoading(true);
    setError(null);
    setData(null);
    setSteps(freshSteps());
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report }),
      });
      if (!res.body) throw new Error("No answer from the server.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotResult = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "step") {
            setSteps((s) => ({ ...s, [ev.step]: { status: ev.status, detail: ev.detail ?? s[ev.step as Step].detail } }));
          } else if (ev.type === "result") {
            setData(ev.data);
            gotResult = true;
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      if (!gotResult) throw new Error("The explanation did not finish. Please try again.");
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function listen() {
    if (!data) return;
    if (voice === "playing") return stopAudio();
    setVoice("loading");
    setVoiceError(null);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: textToRead(data) }),
      });
      if (res.status === 503) {
        // ElevenLabs key not added yet: use the browser voice instead.
        const french = /^(Votre|Exemple)/.test(data.summary + "") || data.caution.startsWith("Exemple");
        if (speakWithBrowser(textToRead(data), french)) return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Voice is not available.");
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setVoice("idle");
      await audio.play();
      setVoice("playing");
    } catch (e) {
      setVoice("error");
      setVoiceError((e as Error).message);
    }
  }

  const organ = data ? organFrom(data.organ_for_visual) : null;
  const started = loading || data || error;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <header className="border-b border-line pb-6">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">MedBridge</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">
          Understand your medical report, in plain words.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Paste a report. An AI agent searches real research on PubMed and explains what your report says, with a link to
          every article it uses. You can also listen to the explanation.
        </p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left column */}
        <section aria-labelledby="report-label">
          <label id="report-label" htmlFor="report" className="font-serif text-xl">
            The report
          </label>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-muted">Try a fictional report:</span>
            {SAMPLE_REPORTS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setReport(r.text)}
                className={`underline underline-offset-4 ${report === r.text ? "text-ink" : "text-accent"}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            id="report"
            value={report}
            onChange={(e) => setReport(e.target.value)}
            rows={9}
            className="mt-3 w-full border border-line bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-accent"
            placeholder="Paste the text of a medical report here."
          />
          <button
            type="button"
            onClick={run}
            disabled={loading || report.trim().length < 10}
            className="mt-3 w-full bg-ink px-5 py-3 font-medium text-paper transition hover:bg-accent disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Explaining…" : "Explain this report"}
          </button>
          <p className="mt-2 text-xs text-muted">Please do not paste real names or personal details.</p>

          {started && (
            <div className="mt-8 border-t border-line pt-4">
              <h2 className="font-serif text-lg">What the agent is doing</h2>
              <ol className="mt-2">
                {STEP_LABELS.map(({ key, label }) => {
                  const s = steps[key];
                  return (
                    <li key={key} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm">
                      <span className={key.includes("_") ? "font-mono" : ""}>
                        {label}
                        {s.detail && <span className="block text-xs text-muted">{s.detail}</span>}
                      </span>
                      <span
                        className={
                          s.status === "done" ? "text-accent" : s.status === "running" ? "text-ink" : "text-muted"
                        }
                      >
                        {s.status === "running" ? "running…" : s.status === "done" ? "done" : "waiting"}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>

        {/* Right column */}
        <section aria-live="polite" className="min-w-0">
          {!started && (
            <p className="border-t border-line pt-4 text-muted">
              The explanation will appear here. Choose a fictional report or paste your own, then press
              &ldquo;Explain this report&rdquo;.
            </p>
          )}

          {loading && !data && (
            <p className="border-t border-line pt-4 text-muted">
              Reading the report and searching PubMed. This takes about 20–40 seconds.
            </p>
          )}

          {error && (
            <div role="alert" className="border-t border-l-2 border-danger border-t-line py-3 pl-4">
              <p className="font-medium text-danger">Something went wrong</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}

          {data && (
            <article>
              <div className="border-t border-line pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium tracking-wide text-accent uppercase">In short</h2>
                  <button
                    type="button"
                    onClick={listen}
                    disabled={voice === "loading"}
                    className="border border-ink px-3 py-1.5 text-sm font-medium hover:bg-ink hover:text-paper disabled:opacity-50"
                  >
                    {voice === "loading" ? "Preparing voice…" : voice === "playing" ? "Stop" : "Listen to this explanation"}
                  </button>
                </div>
                <p className="mt-3 font-serif text-2xl leading-snug">{data.summary}</p>
                {voiceError && <p className="mt-2 text-sm text-danger">{voiceError}</p>}
              </div>

              {data.terms.length > 0 && (
                <Section title="Words in your report">
                  {data.terms.map((t, i) => (
                    <div key={i} className="border-b border-line py-3 last:border-0">
                      <p className="font-medium">{t.term}</p>
                      <p className="mt-1">{t.plain_meaning}</p>
                      {t.in_your_document && (
                        <p className="mt-1 text-sm text-muted">In your report: {t.in_your_document}</p>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {data.findings.length > 0 && (
                <Section title="What your report says">
                  {data.findings.map((f, i) => (
                    <div key={i} className="border-b border-line py-3 last:border-0">
                      <p className="font-mono text-sm">{f.from_document}</p>
                      <p className="mt-1">{f.explanation}</p>
                    </div>
                  ))}
                </Section>
              )}

              {organ && (
                <Section title={`Where the ${organ} is`}>
                  <figure className="flex flex-col items-start gap-2 pt-2 sm:flex-row sm:items-end sm:gap-6">
                    <OrganFigure organ={organ} />
                    <figcaption className="text-sm text-muted">Educational drawing, not the patient&rsquo;s scan.</figcaption>
                  </figure>
                </Section>
              )}

              <Section title="What research says">
                {data.research.length === 0 ? (
                  <p className="py-3 text-muted">
                    The agent did not find research it could rely on for this report, so it does not make any research
                    claims.
                  </p>
                ) : (
                  data.research.map((r) => (
                    <div key={r.pmid} className="border-b border-line py-3 last:border-0">
                      <p className="font-medium">
                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer">
                          {r.title}
                        </a>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {r.year} · PMID {r.pmid} · opens on PubMed
                      </p>
                      <p className="mt-2">{r.what_it_found}</p>
                      {r.limitation && <p className="mt-1 text-sm text-muted">Limit: {r.limitation}</p>}
                    </div>
                  ))
                )}
              </Section>

              {data.follow_up && (
                <Section title="What your report says about next steps">
                  <p className="py-3">{data.follow_up}</p>
                </Section>
              )}

              {data.questions_to_ask.length > 0 && (
                <Section title="Questions you could ask">
                  <ul className="py-1">
                    {data.questions_to_ask.map((q, i) => (
                      <li key={i} className="border-b border-line py-2 last:border-0">
                        {q}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {data.caution && <p className="mt-6 text-sm text-muted">{data.caution}</p>}
            </article>
          )}
        </section>
      </div>

      <footer className="mt-16 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        MedBridge explains information. It does not diagnose, recommend treatment, or replace your healthcare
        professional.{" "}
        {data?.caution.startsWith("Basic mode")
          ? "This explanation was put together automatically and has not been reviewed by a clinician."
          : "This explanation was written by AI and has not been reviewed by a clinician."}{" "}
        The sample patients are fictional. Research comes from PubMed; voice by ElevenLabs.
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-4">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}
