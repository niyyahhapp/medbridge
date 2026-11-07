import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

let cachedVoice: string | null = null;

async function voiceId(key: string): Promise<string> {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (cachedVoice) return cachedVoice;
  // No voice chosen: use the first voice in the account.
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  const data = await res.json();
  const id = data?.voices?.[0]?.voice_id;
  if (!id) throw new Error("No ElevenLabs voice found.");
  cachedVoice = id;
  return id;
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "Voice is not connected yet." }, { status: 503 });
  if (!allow("speak:" + clientIp(req), 30) || !allow("speak-total", 300)) {
    return Response.json({ error: "Voice is busy. Please try again soon." }, { status: 429 });
  }

  let text = "";
  try {
    text = String((await req.json())?.text ?? "").trim().slice(0, 2500);
  } catch {}
  if (!text) return Response.json({ error: "Nothing to read." }, { status: 400 });

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${await voiceId(key)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs error", res.status, err.slice(0, 300));
      return Response.json({ error: `Voice error (${res.status}).` }, { status: 502 });
    }
    return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
