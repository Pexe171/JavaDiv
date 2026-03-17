import path from "node:path";
import { promises as fs } from "node:fs";

import { ensureDir } from "./fileManager";

import { stableStringify } from "../utils/json";

export async function saveJson(filePath: string, payload: unknown): Promise<string> {
  await ensureDir(path.dirname(filePath));
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${stableStringify(payload)}
`, "utf-8");
  await fs.rename(temporaryPath, filePath);
  return filePath;
}

export async function saveText(filePath: string, content: string): Promise<string> {
  await ensureDir(path.dirname(filePath));
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf-8");
  await fs.rename(temporaryPath, filePath);
  return filePath;
}
