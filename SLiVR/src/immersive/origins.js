/**
 * Which host serves a capture.
 *
 * The provider serves the same experiences from more than one host. They
 * return byte-identical documents for the same tour, but they are different
 * browser origins, so a capture URL, the target origin commands are posted to,
 * and the origin inbound messages are accepted from must all agree.
 *
 * This exists because the hosts have not been shown to behave the same way
 * inside a frame: on 2026-09-20 the provider's own page failed to fetch its
 * tour data from one of them while embedded (L033). Switching between them is
 * therefore a diagnostic, not a preference, and it is confined to the region's
 * configured list so a typo cannot point the viewer at an arbitrary host.
 */

/** Every origin a capture may legitimately be loaded from. */
export function allowedOrigins(immersive) {
  const aliases = Array.isArray(immersive?.originAliases) ? immersive.originAliases : [];
  return [immersive?.origin, ...aliases].filter(Boolean);
}

/**
 * Rewrites a capture to load from `origin`, keeping path and query intact.
 *
 * Returns the capture unchanged when the origin is the one it already uses,
 * and null when the origin is not configured, so a caller cannot quietly send
 * the viewer somewhere the region never approved.
 *
 * @returns {{capture: object, origin: string} | null}
 */
export function captureAtOrigin(capture, origin, immersive) {
  if (!capture?.url) return null;
  if (!allowedOrigins(immersive).includes(origin)) return null;

  let url;
  try {
    url = new URL(capture.url);
  } catch {
    return null;
  }
  if (url.origin === origin) return { capture, origin };

  const target = new URL(origin);
  url.protocol = target.protocol;
  url.host = target.host;
  return { capture: { ...capture, url: url.toString() }, origin };
}
