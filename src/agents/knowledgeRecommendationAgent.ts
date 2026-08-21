import { GoogleGenAI, Type } from "@google/genai";
import { KNOWLEDGE_BASE, performHybridRAGSearch, chunkArticle } from "../rag/kb.js";
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  getSharedAIClient,
  markQuotaExhausted
} from "../config/geminiConfig.js";

export type RecommendationCategory =
  | "Policy"
  | "FAQ"
  | "Troubleshooting"
  | "Manual"
  | "SOP"
  | "Guide";

export interface KnowledgeRecommendationItem {
  title: string;
  category: RecommendationCategory;
  summary: string;
  excerpt: string;
  relevance_score: number; // 0.0 to 1.0
  reasoning: string;
}

export interface KnowledgeRecommendationOutput {
  knowledge_recommendations: KnowledgeRecommendationItem[];
  status_message?: string;
  query_used?: string;
  context_summary?: string;
}

export interface SessionInfo {
  scenarioName?: string;
  scenarioDescription?: string;
  customerName?: string;
  product?: string;
  persona?: string;
  [key: string]: any;
}

export interface ConversationMessage {
  sender: "customer" | "agent" | string;
  text: string;
  timestamp?: string;
  [key: string]: any;
}

export interface KnowledgeRecommendationInput {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  product?: string;
  sessionInfo?: SessionInfo;
}

export interface KnowledgeAgentState {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  product?: string;
  sessionInfo?: SessionInfo;
  recommendations?: KnowledgeRecommendationOutput;
  [key: string]: any;
}

// Knowledge System Prompt as specified by Vidzai AI Customer Support Coaching Assistant specification
export const KNOWLEDGE_SYSTEM_PROMPT = `
You are the "Knowledge Recommendation Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to evaluate knowledge base document chunks retrieved via RAG (Retrieval-Augmented Generation) against live customer interactions, calculate exact semantic relevance (0.00 to 1.00), and extract concise, actionable policy summaries and procedural steps for the human support representative.

======================================================================
1. CORE OBJECTIVES & GROUNDING RULES
======================================================================
- GROUNDING RULE (CRITICAL): Only utilize factual information contained within the provided knowledge base snippets. Never hallucinate corporate policies, arbitrary refund windows, or unverified hardware procedures.
- If the customer issue is not addressed in the retrieved knowledge base, honestly state that no exact policy matches were found.
- Assign each retrieved document a clear category: "Policy", "FAQ", "Troubleshooting", "SOP", or "Guide".
- Generate a clean, human-friendly title formatted from the source filename (e.g., "refund_policy.txt" -> "Refund & Replacement Policy", "hardware_troubleshooting.txt" -> "Smart Device Setup & Hardware Guide").

======================================================================
2. RELEVANCE & SUMMARY EXTRACTION
======================================================================
- relevance_score: Float between 0.00 (irrelevant) and 1.00 (perfect solution for customer issue).
- retrieval_reason: 1-2 sentence explanation of why this specific article was retrieved for the customer's stated problem.
- relevant_section_summary: Direct, high-impact excerpt or synthesized bullet points detailing the exact resolution steps, limits, or exceptions the agent must know.
- context_summary: High-level overview (1-2 sentences) summarizing what relevant knowledge is available to solve the interaction.

======================================================================
3. OUTPUT JSON SCHEMA (STRICT REQUIREMENT: VALID JSON ONLY)
======================================================================
{
  "query_used": "out of warranty replacement policy smart speaker",
  "snippets": [
    {
      "content": "Full excerpt from the knowledge base document...",
      "source": "refund_policy.txt",
      "document_title": "Refund & Replacement Policy",
      "relevance_score": 0.94,
      "category": "Policy",
      "retrieval_reason": "Customer is requesting a refund for a smart speaker 45 days after purchase, exceeding the standard 30-day window.",
      "relevant_section_summary": "Strict 30-day full refund policy. Devices between 31-90 days qualify for warranty diagnostics and authorized replacement units or store credit upon manager approval."
    }
  ],
  "total_retrieved": 1,
  "context_summary": "Policy permits warranty repair/replacement for items past 30 days, but denies direct cash refunds."
}
`.trim();

export function build_knowledge_prompt(
  customer_message: string,
  retrieved_chunks: Array<{ content?: string; source?: string; title?: string }>
): [string, string] {
  let chunks_text = "";
  for (let i = 0; i < retrieved_chunks.length; i++) {
    const chunk = retrieved_chunks[i];
    chunks_text += `\n--- CHUNK ${i + 1} (source: ${chunk.source || chunk.title || 'unknown'}) ---\n`;
    chunks_text += chunk.content || "";
  }

  const user = `
CUSTOMER MESSAGE: "${customer_message}"

RETRIEVED KNOWLEDGE BASE CHUNKS:
${chunks_text || "No relevant chunks were retrieved."}

Analyze the above chunks and return the most relevant knowledge for the support agent.
`.trim();

  return [KNOWLEDGE_SYSTEM_PROMPT, user];
}

const MODELS_TO_TRY = GEMINI_FALLBACK_MODELS;

function mapToCategory(internalCategory: string): RecommendationCategory {
  const cat = (internalCategory || "").toLowerCase();
  if (cat.includes("policy") || cat.includes("refund")) return "Policy";
  if (cat.includes("troubleshoot") || cat.includes("hub") || cat.includes("reset") || cat.includes("guide")) return "Troubleshooting";
  if (cat.includes("faq") || cat.includes("billing")) return "FAQ";
  if (cat.includes("account") || cat.includes("lockout")) return "SOP";
  return "Guide";
}

export async function getKnowledgeRecommendationsFallback(
  input: KnowledgeRecommendationInput
): Promise<KnowledgeRecommendationOutput> {
  const text = input.currentMessage || "";
  const intent = input.intent || "";

  // Perform true hybrid RAG search across knowledge base
  const ragResults = await performHybridRAGSearch(text, {
    topK: 3,
    minScore: 0.15
  });

  if (ragResults.length === 0) {
    return {
      knowledge_recommendations: [],
      status_message: "No relevant knowledge found. Escalate to human support if necessary."
    };
  }

  const recommendations: KnowledgeRecommendationItem[] = ragResults.map(({ article, score, retrievalReason }) => {
    const category = mapToCategory(article.category);
    const summary = article.content.slice(0, 140) + "...";
    const excerpt = article.steps && article.steps.length > 0
      ? article.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join(' ')
      : article.content.slice(0, 160);

    return {
      title: article.title,
      category,
      summary,
      excerpt,
      relevance_score: score,
      reasoning: retrievalReason || `Retrieved policy '${article.title}' matching inquiry.`
    };
  });

  return {
    knowledge_recommendations: recommendations,
    query_used: text.slice(0, 60),
    context_summary: `Retrieved ${recommendations.length} matching support policies.`
  };
}

export async function getKnowledgeRecommendations(
  input: KnowledgeRecommendationInput
): Promise<KnowledgeRecommendationOutput> {
  const { currentMessage, intent = "General Query" } = input;

  if (!currentMessage || typeof currentMessage !== "string") {
    return await getKnowledgeRecommendationsFallback(input);
  }

  // First step of real RAG: Retrieve top relevant chunks from knowledge base
  const ragResults = await performHybridRAGSearch(currentMessage, {
    topK: 3,
    minScore: 0.15
  });

  if (ragResults.length === 0) {
    return {
      knowledge_recommendations: [],
      status_message: "No relevant knowledge found. Escalate to human support if necessary."
    };
  }

  const retrievedChunks = ragResults.flatMap(res => {
    return res.matchedChunks.slice(0, 2).map(chunk => ({
      content: chunk.content,
      source: `${res.article.id}.md`,
      title: res.article.title
    }));
  });

  const ai = getSharedAIClient();
  if (!ai) {
    return await getKnowledgeRecommendationsFallback(input);
  }

  const [sysPrompt, userPrompt] = build_knowledge_prompt(currentMessage, retrievedChunks);
  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;

  for (const modelName of MODELS_TO_TRY) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              query_used: { type: Type.STRING },
              snippets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    content: { type: Type.STRING },
                    source: { type: Type.STRING },
                    document_title: { type: Type.STRING },
                    relevance_score: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    retrieval_reason: { type: Type.STRING },
                    relevant_section_summary: { type: Type.STRING }
                  },
                  required: ["content", "document_title", "relevance_score", "category", "retrieval_reason", "relevant_section_summary"]
                }
              },
              total_retrieved: { type: Type.INTEGER },
              context_summary: { type: Type.STRING }
            },
            required: ["snippets", "context_summary"]
          }
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), GEMINI_AGENT_TIMEOUT_MS);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        const snippets = parsed.snippets || [];

        const mappedRecs: KnowledgeRecommendationItem[] = snippets.map((s: any) => ({
          title: s.document_title || s.source || "Knowledge Article",
          category: mapToCategory(s.category),
          summary: s.relevant_section_summary || s.content?.slice(0, 120) || "",
          excerpt: s.content || "",
          relevance_score: Number(s.relevance_score) || 0.8,
          reasoning: s.retrieval_reason || "Matched customer request."
        }));

        return {
          knowledge_recommendations: mappedRecs.length > 0 ? mappedRecs : (await getKnowledgeRecommendationsFallback(input)).knowledge_recommendations,
          query_used: parsed.query_used,
          context_summary: parsed.context_summary,
          status_message: mappedRecs.length === 0 ? "No relevant knowledge found." : undefined
        };
      }
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        markQuotaExhausted(30);
        break;
      }
      continue;
    }
  }

  return await getKnowledgeRecommendationsFallback(input);
}

export async function knowledgeRecommendationNode(
  state: KnowledgeAgentState
): Promise<KnowledgeAgentState> {
  const recommendations = await getKnowledgeRecommendations({
    currentMessage: state.currentMessage,
    history: state.history,
    intent: state.intent || state.analysis?.intent,
    product: state.product || state.sessionInfo?.product,
    sessionInfo: state.sessionInfo
  });

  return {
    ...state,
    recommendations
  };
}
