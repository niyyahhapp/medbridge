// Simple in-memory limits so a busy room cannot burn all the credits.
// Per server instance; good enough for a hackathon demo.
const hits = new Map<string, number[]>();

export function allow(key: string, perHour: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (list.length >= perHour) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
