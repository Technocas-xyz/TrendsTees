// Safe value for a ?next= redirect: only same-site paths, otherwise Home.
// Blocks "https://evil.com", "//evil.com" and "/\evil.com".
export function safeNext(value?: string | string[] | null): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && /^\/(?![\/\\])[^\r\n]*$/.test(v) ? v : '/';
}
