export function buildExportHeaders(headers: Record<string, string>): Record<string, string> {
  const selectedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("authorization")) {
      selectedHeaders[key] = "Bearer <TOKEN>";
    } else if (normalizedKey.includes("cookie")) {
      selectedHeaders[key] = "<COOKIE>";
    } else if (normalizedKey.includes("csrf")) {
      selectedHeaders[key] = "<CSRF>";
    } else if (["content-type", "accept", "x-requested-with"].includes(normalizedKey)) {
      selectedHeaders[key] = value;
    }
  }
  return selectedHeaders;
}
