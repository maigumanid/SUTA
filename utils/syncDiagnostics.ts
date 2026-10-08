/** Retain diagnostic text, never request bodies, row contents, credentials or paths. */
export function safeSyncDiagnosticText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (/failing row contains|\bkey\s*\([^)]*\)\s*=|\{[\s\S]*["'][^"']+["']\s*:/i.test(value)) {
    return 'Record-specific backend details omitted for privacy.';
  }
  return value
    .replace(/(?:https?:\/\/|file:\/\/|content:\/\/|blob:)[^\s<>"']+/gi, '[redacted URL]')
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [redacted]')
    .replace(/\b(?:eyJ|sb_secret_|sb_publishable_|ExponentPushToken\[|ExpoPushToken\[)[A-Za-z0-9_+.\/[\]=:-]+/g, '[redacted token]')
    .replace(/\b(?:authorization|apikey|api_key|access_token|refresh_token|password|secret|token)\b\s*[:=]\s*[^\s,;]+/gi, '[redacted credential]')
    .replace(/\b(?:barangays|users)\/[^\s<>"']+/gi, '[redacted object path]')
    .replace(/(?:[A-Za-z]:\\|\/(?:data|storage|private|var|Users)\/)[^\s<>"']+/g, '[redacted local path]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[redacted ID]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 600);
}

export function safeSyncErrorCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value)
    ? value
    : undefined;
}
