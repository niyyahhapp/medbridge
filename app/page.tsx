"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Explanation, Step } from "@/lib/agent";
import { SAMPLE_REPORTS } from "@/lib/reports";
import { OrganFigure, organFrom } from "./OrganFigure";
import { redact, redactSegments, type Removal } from "@/lib/redact";
import { fileToText } from "@/lib/fileText";
import { LANGUAGES } from "@/lib/languages";
import { privateExplain } from "@/lib/privateMode";

const AUTO_DELETE_MINUTES = 10;

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

  // Privacy
  const [privateMode, setPrivateMode] = useState(false);
  const [removed, setRemoved] = useState<Removal[] | null>(null);
  const [services, setServices] = useState<{ ai: string | null; voice: boolean; translate: string | null } | null>(null);
  // Translation of the explanation (never the report)
  const [lang, setLang] = useState("orig");
  const [translations, setTranslations] = useState<Record<string, Explanation>>({});
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [cleared, setCleared] = useState<string | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setServices)
      .catch(() => setServices({ ai: null, voice: false, translate: null }));
  }, []);

  // Auto-delete: clear the report and explanation after a period with no activity.
  useEffect(() => {
    const touch = () => (lastActivity.current = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_DELETE_MINUTES * 60_000) {
        clearAll(`Deleted automatically after ${AUTO_DELETE_MINUTES} minutes without activity.`);
        lastActivity.current = Date.now();
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Files are turned into text on this device; only the text (after the person checks it) is sent.
  const [fileStatus, setFileStatus] = useState<{ kind: "busy" | "done" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setCleared(null);
    setFileStatus({ kind: "busy", text: "Reading your file on this device…" });
    try {
      const text = await fileToText(file, (m) => setFileStatus({ kind: "busy", text: m }));
      if (text.replace(/\s/g, "").length < 10) throw new Error("No readable text was found in this file. Try a clearer photo, or paste the text.");
      setReport(text);
      setData(null);
      setError(null);
      setRemoved(null);
      setFileStatus({
        kind: "done",
        text: `Text taken from "${file.name}". The file itself was not uploaded. Please check the text below before you press Explain.`,
      });
    } catch (e) {
      setFileStatus({ kind: "error", text: (e as Error).message || "This file could not be read." });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function clearAll(message = "Everything was deleted from this page.") {
    stopAudio();
    setReport("");
    setData(null);
    setError(null);
    setRemoved(null);
    setSteps(freshSteps());
    setFileStatus(null);
    setLang("orig");
    setTranslations({});
    setCleared(message);
  }

  function stopAudio() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setVoice("idle");
  }

  // Browser voice, used when ElevenLabs is not connected or in Private mode.
  // Only voices built into the device are used: some browsers also offer online
  // voices that send the text to a company, and those are skipped on purpose.
  async function speakWithBrowser(text: string, speechLang: string): Promise<boolean> {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return false;
    let voices = synth.getVoices();
    if (!voices.length) {
      await new Promise<void>((res) => {
        const done = () => res();
        synth.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1500);
      });
      voices = synth.getVoices();
    }
    const prefix = speechLang.slice(0, 2).toLowerCase();
    const local = voices.filter((v) => v.localService && v.lang.toLowerCase().startsWith(prefix));
    const voice = local.find((v) => v.lang.toLowerCase() === speechLang.toLowerCase()) ?? local[0];
    if (!voice) {
      setVoice("error");
      setVoiceError("This device has no built-in voice for this language, so nothing was read aloud and nothing was sent.");
      return true;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
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
    setCleared(null);
    setLang("orig");
    setTranslations({});
    setTranslateError(null);
    // Remove personal details in the browser, before anything is sent.
    const safe = redact(report);
    setRemoved(safe.removed);
    // Private mode: everything runs in this browser. The report is never sent anywhere.
    if (privateMode) {
      try {
        const onStep = (ev: Record<string, unknown>) => {
          if (ev.type === "step")
            setSteps((s) => ({ ...s, [ev.step as Step]: { status: ev.status as StepState["status"], detail: (ev.detail as string) ?? s[ev.step as Step].detail } }));
        };
        setData(await privateExplain(safe.text, onStep));
      } catch (e) {
        setError((e as Error).message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ report: safe.text }),
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

  async function changeLanguage(code: string) {
    stopAudio();
    setTranslateError(null);
    setLang(code);
    if (code === "orig" || translations[code] || !data) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data, lang: code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Translation failed.");
      setTranslations((t) => ({ ...t, [code]: body.data }));
    } catch (e) {
      setTranslateError((e as Error).message);
      setLang("orig");
    } finally {
      setTranslating(false);
    }
  }

  async function listen() {
    if (!data) return;
    if (voice === "playing") return stopAudio();
    setVoice("loading");
    setVoiceError(null);
    const view = (lang !== "orig" && translations[lang]) || data;
    const french = /^(Votre|Exemple)/.test(data.summary + "") || data.caution.startsWith("Exemple");
    const speechLang = lang !== "orig" ? LANGUAGES.find((l) => l.code === lang)?.speech : french ? "fr-FR" : "en-US";
    // In private mode, never send text to a voice company: use the browser's own voice.
    if (privateMode && (await speakWithBrowser(textToRead(view), speechLang!))) return;
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: textToRead(view) }),
      });
      if (res.status === 503) {
        // ElevenLabs key not added yet: use the browser voice instead.
        if (await speakWithBrowser(textToRead(view), speechLang!)) return;
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
  const view = data ? (lang !== "orig" && translations[lang]) || data : null;
  const rtl = !!LANGUAGES.find((l) => l.code === lang)?.rtl;
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
        <LaunchVideo />
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

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`relative mt-3 ${dragging ? "outline-2 outline-offset-2 outline-dashed outline-accent" : ""}`}
          >
            <textarea
              id="report"
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={9}
              className="w-full border border-line bg-white p-3 font-mono text-sm leading-relaxed outline-none focus:border-accent"
              placeholder="Paste the text of a medical report here, or drop a PDF or a photo of it."
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/90 text-accent">
                Drop the file to read it on this device
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={fileStatus?.kind === "busy"}
              className="border border-ink px-3 py-1.5 font-medium hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              Attach a file
            </button>
            <span className="text-xs text-muted">PDF, photo or text file. Or drag it onto the box. It is read on your device.</span>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.md,image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          {fileStatus && (
            <p
              role="status"
              className={`mt-2 text-sm ${fileStatus.kind === "error" ? "text-danger" : fileStatus.kind === "done" ? "text-accent" : "text-muted"}`}
            >
              {fileStatus.text}
            </p>
          )}
          <button
            type="button"
            onClick={run}
            disabled={loading || fileStatus?.kind === "busy" || report.trim().length < 10}
            className="mt-3 w-full bg-ink px-5 py-3 font-medium text-paper transition hover:bg-accent disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Explaining…" : "Explain this report"}
          </button>
          <SentPreview report={report} />

          <PrivacyPanel
            privateMode={privateMode}
            setPrivateMode={setPrivateMode}
            services={services}
            removed={removed}
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button type="button" onClick={() => clearAll()} className="text-danger underline underline-offset-4">
              Delete everything now
            </button>
            <span className="text-xs text-muted">Auto-deletes after {AUTO_DELETE_MINUTES} minutes without activity.</span>
          </div>
          {cleared && (
            <p role="status" className="mt-2 text-sm text-accent">
              {cleared} Nothing was saved on our server.
            </p>
          )}

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

          {data && view && (
            <article dir={rtl ? "rtl" : undefined}>
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
                <p className="mt-3 font-serif text-2xl leading-snug">{view.summary}</p>
                {voiceError && <p className="mt-2 text-sm text-danger">{voiceError}</p>}
                <div dir="ltr" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <label htmlFor="lang" className="text-muted">
                    Read in
                  </label>
                  <select
                    id="lang"
                    value={lang}
                    onChange={(e) => changeLanguage(e.target.value)}
                    disabled={translating || privateMode || !services?.translate}
                    className="border border-line bg-white px-2 py-1 disabled:opacity-50"
                  >
                    <option value="orig">Original language</option>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  {translating && <span className="text-muted">Translating…</span>}
                  {!translating && lang !== "orig" && (
                    <span className="text-xs text-muted">
                      Translated by {services?.translate === "DeepL" ? "DeepL" : "AI"}. Article titles stay in English.
                    </span>
                  )}
                  {privateMode && <span className="text-xs text-muted">Translation is off in Private mode.</span>}
                  {!privateMode && services && !services.translate && (
                    <span className="text-xs text-muted">Translation is not connected yet.</span>
                  )}
                </div>
                {translateError && <p className="mt-2 text-sm text-danger">{translateError}</p>}
              </div>

              {view.terms.length > 0 && (
                <Section title="Words in your report">
                  {view.terms.map((t, i) => (
                    <div key={i} className="border-b border-line py-3 last:border-0">
                      <p className="font-medium">{t.term}</p>
                      <p className="mt-1">{t.plain_meaning}</p>
                      {t.in_your_document && (
                        <p className="mt-1 text-sm text-muted">In your report: {t.in_your_document}</p>
                      )}
                      {t.source && (
                        <p className="mt-1 text-xs text-muted">
                          Meaning from{" "}
                          <a href={t.source.url} target="_blank" rel="noreferrer">
                            {t.source.name}
                          </a>
                        </p>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {view.findings.length > 0 && (
                <Section title="What your report says">
                  {view.findings.map((f, i) => (
                    <div key={i} className="border-b border-line py-3 last:border-0">
                      <p className="font-mono text-sm">{f.from_document}</p>
                      {f.explanation && <p className="mt-1">{f.explanation}</p>}
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
                {view.research.length === 0 ? (
                  <p className="py-3 text-muted">
                    The agent did not find research it could rely on for this report, so it does not make any research
                    claims.
                  </p>
                ) : (
                  view.research.map((r) => (
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

              {view.follow_up && (
                <Section title="What your report says about next steps">
                  <p className="py-3">{view.follow_up}</p>
                </Section>
              )}

              {view.questions_to_ask.length > 0 && (
                <Section title="Questions you could ask">
                  <ul className="py-1">
                    {view.questions_to_ask.map((q, i) => (
                      <li key={i} className="border-b border-line py-2 last:border-0">
                        {q}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {view.caution && <p className="mt-6 text-sm text-muted">{view.caution}</p>}
            </article>
          )}
        </section>
      </div>

      <footer className="mt-16 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        MedBridge explains information. It does not diagnose, recommend treatment, or replace your healthcare
        professional.{" "}
        {data?.caution.startsWith("Basic mode") || data?.caution.startsWith("Private mode")
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

function PrivacyPanel({
  privateMode,
  setPrivateMode,
  services,
  removed,
}: {
  privateMode: boolean;
  setPrivateMode: (v: boolean) => void;
  services: { ai: string | null; voice: boolean; translate: string | null } | null;
  removed: Removal[] | null;
}) {
  const ai = services?.ai;
  const aiIsLocal = !!ai && ai.startsWith("a model running on this computer");
  return (
    <div className="mt-6 border-t border-line pt-4">
      <h2 className="font-serif text-lg">Your privacy</h2>

      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={privateMode}
          onChange={(e) => setPrivateMode(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[#1F5C4D]"
        />
        <span>
          <span className="font-medium">Private mode</span>
          <span className="block text-sm text-muted">
            Your report never leaves your device. The explanation is built inside your browser with exact rules (no AI):
            each value is compared with the range written in your report, words are explained from our glossary, and only
            short search words (like &ldquo;fatty liver&rdquo;) and single medical words are sent out, to find PubMed research
            and trusted meanings from the U.S. National Library of Medicine. Translation and online
            voices are off.
          </span>
        </span>
      </label>

      {removed && (
        <p className="mt-3 text-sm">
          {removed.length === 0 ? (
            <span className="text-muted">No personal details were found in your report.</span>
          ) : (
            <>
              <span className="font-medium text-accent">Removed before sending: </span>
              {removed.map((r) => `${r.kind}${r.count > 1 ? ` (${r.count})` : ""}`).join(", ")}.
            </>
          )}
        </p>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-accent underline underline-offset-4">Where your report goes</summary>
        <ul className="mt-2">
          <li className="border-b border-line py-2">
            <span className="font-medium">In your browser first:</span> attached files (PDFs and photos) are read on your
            device and are never uploaded. MedBridge removes personal details it can recognise, such as a labelled
            name, date of birth, health card or record number, phone number, email, address, and doctors&rsquo; names.
            You can see exactly what was removed above. It can miss details written in an unusual way, such as a name in
            the middle of a sentence, so please check before you press Explain.
          </li>
          <li className="border-b border-line py-2">
            <span className="font-medium">Our server:</span>{" "}
            {privateMode
              ? "never receives your report in Private mode, only short search words for PubMed and single medical words to look up their meaning."
              : "uses the report only while explaining it."}{" "}
            {privateMode ? null : <> Our code does not
            save it or write it to logs, and there is no database.</>}{" "}Our hosting service (Vercel) keeps standard records of
            each visit, such as the time and IP address, but not the report.
          </li>
          <li className="border-b border-line py-2">
            <span className="font-medium">AI company:</span>{" "}
            {privateMode
              ? "none. In Private mode no AI is used and your report is not sent to any AI company."
              : ai
                ? aiIsLocal
                  ? `${ai}.`
                  : `the report (without personal details) is sent to ${ai} to write the explanation. Free AI services may keep data or use it to improve their products. Turn on Private mode if you are not comfortable with this.`
                : "none is connected right now, so your report is not sent to any AI company."}
          </li>
          <li className="border-b border-line py-2">
            <span className="font-medium">PubMed:</span> receives only short medical search words, such as &ldquo;fatty
            liver lifestyle&rdquo;, sent from our server. It never receives your report or your IP address.
          </li>
          <li className="border-b border-line py-2">
            <span className="font-medium">Voice:</span>{" "}
            {privateMode || !services?.voice
              ? "uses only a voice built into your device, so the text is not sent anywhere. If your device has no built-in voice for the language, nothing is read aloud."
              : "if you press Listen, the explanation (not your report) is sent to ElevenLabs to make the audio."}
          </li>
          <li className="border-b border-line py-2">
            <span className="font-medium">Translation:</span>{" "}
            {privateMode || !services?.translate
              ? "not used."
              : `only if you choose a language, the explanation (not your report) is sent to ${services.translate === "DeepL" ? "DeepL" : ai} to translate it.`}
          </li>
          <li className="py-2">
            <span className="font-medium">This page:</span> stores nothing in your browser, so nothing is kept after you close
            it. Use &ldquo;Delete everything now&rdquo; at any time. Fonts and all other files come from our own
            site, so loading the page does not contact Google or other companies.
          </li>
        </ul>
      </details>
    </div>
  );
}

/** Live preview of exactly what will be sent, with removed personal details crossed out. */
function SentPreview({ report }: { report: string }) {
  const r = useMemo(() => redactSegments(report), [report]);
  if (report.trim().length < 10) return null;
  const n = r.removed.reduce((a, b) => a + b.count, 0);
  return (
    <details open={n > 0} className="mt-4 border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer">
        <span className="font-medium">What will be sent</span>{" "}
        <span className={n ? "text-accent" : "text-muted"}>
          {n ? `· ${n} personal detail${n > 1 ? "s" : ""} removed` : "· no personal details found"}
        </span>
      </summary>
      <p className="mt-2 text-xs text-muted">
        Crossed out in red: removed on your device and never sent. In green: what is sent instead.
      </p>
      <pre className="mt-2 max-h-72 overflow-auto border border-line bg-white p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {r.segments.map((seg, i) =>
          seg.removed ? (
            <span key={i} title={`${seg.removed.kind}: removed before sending`}>
              <del className="bg-[#9b2c2c]/10 text-danger decoration-2">{seg.removed.original}</del>{" "}
              <ins className="bg-accent/10 text-accent no-underline">{seg.text}</ins>
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </pre>
    </details>
  );
}

/** The launch film (motion design) and the recorded demo, both with fictional patients. */
const VIDEOS = {
  film: {
    label: "Watch the launch film",
    base: "/medbridge-launch",
    caption: "The MedBridge launch film. The patient shown is fictional.",
  },
  demo: {
    label: "Watch the demo",
    base: "/medbridge-demo",
    caption: "A real run of MedBridge with a fictional patient. The AI\u2019s waiting time is sped up and labelled in the video.",
  },
} as const;

function LaunchVideo() {
  const [open, setOpen] = useState<keyof typeof VIDEOS | null>(null);
  const v = open ? VIDEOS[open] : null;
  return (
    <div className="mt-4">
      {!v ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setOpen("film")}
            className="inline-flex items-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent"
          >
            <span aria-hidden="true">▶</span> {VIDEOS.film.label}
          </button>
          <button
            type="button"
            onClick={() => setOpen("demo")}
            className="inline-flex items-center gap-2 border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper"
          >
            <span aria-hidden="true">▶</span> {VIDEOS.demo.label}
          </button>
        </div>
      ) : (
        <figure className="max-w-4xl">
          <video
            key={open}
            poster={`${v.base}-poster.jpg`}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full border border-line bg-white"
          >
            <source src={`${v.base}.webm`} type="video/webm" />
            <source src={`${v.base}.mp4`} type="video/mp4" />
            <track kind="descriptions" />
          </video>
          <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
            <span>{v.caption}</span>
            <span className="flex gap-4">
              <button
                type="button"
                onClick={() => setOpen(open === "film" ? "demo" : "film")}
                className="text-accent underline underline-offset-4"
              >
                {open === "film" ? VIDEOS.demo.label : VIDEOS.film.label}
              </button>
              <button type="button" onClick={() => setOpen(null)} className="text-accent underline underline-offset-4">
                Close video
              </button>
            </span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}
