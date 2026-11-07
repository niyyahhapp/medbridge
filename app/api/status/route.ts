import { providerLabel } from "@/lib/agent";

export const dynamic = "force-dynamic";

// Tells the page which outside services are switched on, so the privacy panel is accurate.
export function GET() {
  return Response.json({
    ai: providerLabel(),
    voice: Boolean(process.env.ELEVENLABS_API_KEY),
  });
}
