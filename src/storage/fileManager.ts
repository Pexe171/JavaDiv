import path from "node:path";
import { promises as fs } from "node:fs";

import type { AppConfig } from "../types/config";

const runtimeDirectories = [
  "sessions",
  "requests",
  "flows",
  "reports",
  path.join("exports", "axios"),
  path.join("exports", "httpx"),
  path.join("exports", "curl"),
  path.join("exports", "markdown")
];

export async function ensureDir(directoryPath: string): Promise<void> {
  await fs.mkdir(directoryPath, { recursive: true });
}

export async function ensureRuntimeDirectories(config: AppConfig): Promise<void> {
  await ensureDir(config.outputDirectory);
  await ensureDir(config.sessionDirectory);

  await Promise.all(
    runtimeDirectories.map((directory) => ensureDir(path.join(config.outputDirectory, directory)))
  );
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function listJsonFiles(directoryPath: string): Promise<string[]> {
  if (!(await fileExists(directoryPath))) {
    return [];
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
}

export function toAbsolutePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}
