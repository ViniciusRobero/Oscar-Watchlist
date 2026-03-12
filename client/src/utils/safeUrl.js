/**
 * Validates that a URL uses only http or https protocol.
 * Returns the URL if valid, or null if it's missing, malformed, or uses a dangerous protocol.
 */
export function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}
