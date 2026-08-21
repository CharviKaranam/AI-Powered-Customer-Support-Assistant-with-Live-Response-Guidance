import { GoogleGenAI } from "@google/genai";
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  getSharedAIClient 
} from "../config/geminiConfig.js";

export { getSharedAIClient };

const FAST_MODELS = GEMINI_FALLBACK_MODELS;

export async function callGeminiFast(params: {
  contents: string;
  config?: any;
  timeoutMs?: number;
}): Promise<string | null> {
  const ai = getSharedAIClient();
  if (!ai) return null;

  const timeout = params.timeoutMs || GEMINI_AGENT_TIMEOUT_MS;

  for (const model of FAST_MODELS) {
    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI_TIMEOUT')), timeout)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[FastGemini] Model ${model} failed: ${errMsg.slice(0, 100)}`);
      continue;
    }
  }

  return null;
}
