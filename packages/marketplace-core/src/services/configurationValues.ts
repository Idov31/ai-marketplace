import { platforms, type Platform } from "../types/packages";

export function normalizeDefaultPlatform(value: unknown): Platform {
  return typeof value === "string" && platforms.includes(value as Platform) ? value as Platform : "codex";
}
