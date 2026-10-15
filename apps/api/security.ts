// Next.js may normalize req.url to localhost even when the browser used 127.0.0.1.
// Compare the incoming Host with Origin, and only accept loopback or an explicit
// deployment origin. Authenticated ingress is still required for hosted use.
export function allowedRequest(req: Request): boolean {
  try {
    const host = req.headers.get("host") ?? new URL(req.url).host;
    const parsed = new URL("http://" + host);
    const configured = process.env.GHOSTRUN_ALLOWED_ORIGIN;
    const expected = configured ? new URL(configured) : undefined;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (!loopback && host !== expected?.host) return false;
    const raw = req.headers.get("origin");
    if (!raw) return true;
    const origin = new URL(raw);
    return (
      origin.host === host &&
      (loopback
        ? ["http:", "https:"].includes(origin.protocol)
        : origin.origin === expected?.origin)
    );
  } catch {
    return false;
  }
}
