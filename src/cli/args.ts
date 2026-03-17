export function toIdSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim()).filter(Boolean));
}

export function parseKeyValueEntries(values: string[] | undefined): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of values ?? []) {
    const separatorIndex = value.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = value.slice(0, separatorIndex).trim();
    const parsedValue = value.slice(separatorIndex + 1).trim();
    if (key && parsedValue) {
      result.set(key, parsedValue);
    }
  }
  return result;
}
