import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Validated, active Gemini models for ResolveAI.
 * Primary generation model: gemini-3.6-flash
 * Bounded fallback models: gemini-3.6-flash, gemini-3.1-flash-lite
 */
export const GEMINI_PRIMARY_MODEL = "gemini-3.7-flash";

export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite"
] as const;

/**
 * Global default per-agent generation timeout in ms (3.5 seconds for fast, non-blocking agent pipeline).
 */
export const GEMINI_AGENT_TIMEOUT_MS = 3500;

/**
 * Post-interaction summary / comprehensive QA rubric generation timeout in ms (5 seconds).
 */
export const GEMINI_SUMMARY_TIMEOUT_MS = 5000;

let sharedAIClient: GoogleGenAI | null = null;
let quotaCooldownUntil = 0;

/**
 * Checks if the API is currently in a temporary 429 quota exhaustion cooldown.
 */
export function isQuotaExhausted(): boolean {
  return Date.now() < quotaCooldownUntil;
}

/**
 * Flags that quota or rate limit (429) was hit, pausing calls for the given duration.
 */
export function markQuotaExhausted(delaySeconds = 30): void {
  quotaCooldownUntil = Date.now() + (delaySeconds * 1000);
}

/**
 * Returns the singleton initialized GoogleGenAI instance if available and not quota-exhausted.
 */
export function getSharedAIClient(ignoreQuotaCheck = false): GoogleGenAI | null {
  if (!ignoreQuotaCheck && isQuotaExhausted()) {
    return null;
  }
  if (!sharedAIClient && process.env.GEMINI_API_KEY) {
    sharedAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return sharedAIClient;
}
