import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface SavedApiConfig { apiKey?: string; model?: string }
export function readApiConfig(file?: string): SavedApiConfig {
  if (!file || !existsSync(file)) return {};
  const value = JSON.parse(readFileSync(file, "utf8")) as SavedApiConfig;
  return { apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    model: typeof value.model === "string" ? value.model : "" };
}
export function writeApiConfig(file: string, value: SavedApiConfig) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(value), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
}
