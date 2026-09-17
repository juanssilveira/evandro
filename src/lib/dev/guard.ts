

const ALLOWED_LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
]);

/**
 * Extracts and normalizes the hostname from host/x-forwarded-host headers.
 * Strips port and brackets if present.
 */
export function extractHostname(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) return null;

  // If there's a comma-separated list (e.g. from multiple proxies), take the primary/incoming host
  const firstEntry = trimmed.split(",")[0].trim();

  // Handle bracketed IPv6 like [::1]:3000 or [::1]
  if (firstEntry.startsWith("[")) {
    const closingBracketIndex = firstEntry.indexOf("]");
    if (closingBracketIndex !== -1) {
      return firstEntry.substring(0, closingBracketIndex + 1);
    }
  }

  // Handle raw IPv6 like ::1
  if (firstEntry === "::1") {
    return "::1";
  }

  // Handle IPv4 / hostname with port like localhost:3000 or 127.0.0.1:3000
  // (only strip port if there is a single colon)
  const colonCount = (firstEntry.match(/:/g) || []).length;
  if (colonCount === 1) {
    const colonIndex = firstEntry.indexOf(":");
    return firstEntry.substring(0, colonIndex);
  }

  return firstEntry;
}


/**
 * Validates all security conditions for the local development admin panel.
 * Returns true ONLY when ALL conditions are satisfied:
 * 1. NODE_ENV === "development"
 * 2. APP_ENV === "development"
 * 3. DEV_PANEL_ENABLED === "true"
 * 4. VERCEL environment is absent
 * 5. Host is strictly loopback (localhost, 127.0.0.1, [::1], ::1)
 */
export function isLocalDevPanelAllowedWithHeaders(resolvedHeaders: Headers | null): boolean {
  // 1. NODE_ENV must be development
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  // 2. APP_ENV must be development
  if (process.env.APP_ENV !== "development") {
    return false;
  }

  // 3. DEV_PANEL_ENABLED must be explicitly "true"
  if (process.env.DEV_PANEL_ENABLED !== "true") {
    return false;
  }

  // 4. Must NOT be running in any Vercel environment
  if (
    process.env.VERCEL ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV
  ) {
    return false;
  }

  // 5. Host must be strictly loopback
  if (!resolvedHeaders) {
    return false;
  }

  const hostHeader =
    resolvedHeaders.get("x-forwarded-host") ||
    resolvedHeaders.get("host");

  if (!hostHeader) {
    return false;
  }

  const hostname = extractHostname(hostHeader);
  if (!hostname || !ALLOWED_LOOPBACK_HOSTS.has(hostname)) {
    return false;
  }

  return true;
}

/**
 * Asynchronously checks if the local dev panel is allowed using request headers.
 */
export async function isLocalDevPanelAllowed(customHeaders?: Headers): Promise<boolean> {
  let resolvedHeaders: Headers | null = null;
  try {
    if (customHeaders) {
      resolvedHeaders = customHeaders;
    } else {
      const { headers: nextHeaders } = await import("next/headers");
      resolvedHeaders = await nextHeaders();
    }
  } catch {
    // If headers() cannot be resolved, fail closed
    resolvedHeaders = null;
  }

  return isLocalDevPanelAllowedWithHeaders(resolvedHeaders);
}

/**
 * Fail-closed assertion for all dev panel pages, Server Actions, and handlers.
 * If any security check fails, immediately triggers notFound() / throws error.
 * No data or database operation may proceed if this check fails.
 */
export async function assertLocalDevPanelAccess(customHeaders?: Headers): Promise<void> {
  const allowed = await isLocalDevPanelAllowed(customHeaders);
  if (!allowed) {
    try {
      const { notFound } = await import("next/navigation");
      notFound();
    } catch (err: unknown) {
      // If not in a Next request context, or if notFound threw NextJS NEXT_NOT_FOUND, rethrow or throw custom error
      if (err && typeof err === "object" && "digest" in err) {
        throw err;
      }
      throw new Error("DEV_PANEL_DISABLED_OR_FORBIDDEN");
    }
  }
}

