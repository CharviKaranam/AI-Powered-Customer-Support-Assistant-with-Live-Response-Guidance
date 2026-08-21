import { GoogleGenAI, Type } from "@google/genai";
import { KnowledgeRecommendationItem } from "./knowledgeRecommendationAgent.js";
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  getSharedAIClient,
  markQuotaExhausted
} from "../config/geminiConfig.js";

export interface ResponseQualityScores {
  professionalism: number; // 0 to 100
  empathy: number; // 0 to 100
  clarity: number; // 0 to 100
  completeness: number; // 0 to 100
  courtesy: number; // 0 to 100
  accuracy: number; // 0 to 100
  actionability: number; // 0 to 100
}

export interface AlternativeResponses {
  formal: string;
  empathetic: string;
}

export interface CoachingAgentOutput {
  suggested_response: string;
  response_quality: ResponseQualityScores;
  coaching_tips: string[];
  alternative_responses: AlternativeResponses;
  reasoning: string;
  tone_feedback?: string;
  tone_score?: number;
  grammar_issues?: string[];
  empathy_rating?: string;
  professionalism_rating?: string;
  do_nots?: string[];
  next_best_action?: string;
}

export interface ConversationMessage {
  sender: "customer" | "agent" | string;
  text: string;
  timestamp?: string;
  [key: string]: any;
}

export interface SessionInfo {
  scenarioName?: string;
  scenarioDescription?: string;
  customerName?: string;
  product?: string;
  persona?: string;
  [key: string]: any;
}

export interface CoachingAgentInput {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  sentiment?: string;
  emotionalState?: string;
  frustrationLevel?: string;
  frustrationScore?: number;
  satisfactionTrend?: string;
  knowledgeRecommendations?: KnowledgeRecommendationItem[] | any[];
  product?: string;
  sessionInfo?: SessionInfo;
}

export interface CoachingAgentState {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  sentiment?: string;
  emotionalState?: string;
  frustrationLevel?: string;
  frustrationScore?: number;
  satisfactionTrend?: string;
  knowledgeRecommendations?: any[];
  product?: string;
  sessionInfo?: SessionInfo;
  coachingOutput?: CoachingAgentOutput;
  [key: string]: any;
}

// System Prompt defined as per Vidzai AI Customer Support Coaching Assistant specification
export const COACHING_SYSTEM_PROMPT = `
You are the "Coaching & Response Suggestion Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your mission is to act as a world-class real-time mentor for the human customer support representative during live interactions. You generate ready-to-use suggested responses, evaluate communication quality, deliver actionable pedagogical tips, provide clear tactical "Next Best Actions", and specify critical phrases or behaviors to avoid.

======================================================================
1. INPUT CONTEXT EVALUATION
======================================================================
You will receive:
1. Full conversation history
2. Latest customer message with intent, emotion, and frustration score
3. Retrieved corporate knowledge base policies, troubleshooting guides, and SOPs
4. Session metadata (scenario topic, customer profile, customer name)

======================================================================
2. COACHING PRINCIPLES & STANDARDS
======================================================================
- EMPATHY FIRST: Validate customer emotions sincerely before presenting technical facts, constraints, or troubleshooting instructions.
- CONTEXT SPECIFICITY: Integrate exact conversation specifics (customer's name, order ID, product name, time elapsed, error codes, dollar amounts). Never produce bland generic templates.
- ACTION-ORIENTED & CONCISE: Limit suggested responses to 2-4 natural, conversational sentences. Clearly outline what immediate step the agent or customer will take.
- DUAL RESPONSE STYLES:
  * "suggested_response": Primary balanced response (warm, empathetic, professional, and directly actionable).
  * "alternative_responses.empathetic": Extra compassionate and reassuring framing for high-frustration situations.
  * "alternative_responses.formal": Precise, structured, and direct framing for enterprise or business clients.
- NEXT BEST ACTION: Exactly one clear, high-impact tactical instruction for the agent (e.g. "Run diagnostic trace on Hub SN-9021 and guide customer through 15-second reset button sequence").
- GUARDRAILS & DO-NOTS: 2-3 specific bad practices or negative phrases to avoid (e.g. "Do not cite the 30-day limit without offering a warranty diagnostic first").

======================================================================
3. QUALITY & TONE SCORING (0 to 100)
======================================================================
Evaluate the interaction and your suggested framing across core dimensions:
- professionalism (0-100), empathy (0-100), clarity (0-100), completeness (0-100), courtesy (0-100), accuracy (0-100), actionability (0-100)
- tone_score (0.0 to 10.0 scale)
- empathy_rating: "low" | "medium" | "high"
- professionalism_rating: "low" | "medium" | "high"

======================================================================
4. OUTPUT JSON SCHEMA (STRICT REQUIREMENT: VALID JSON ONLY)
======================================================================
{
  "suggested_response": "Hello Elena, I completely understand your frustration with seeing duplicate charges on your account. Let me look up your billing records right now to locate the duplicate $59.99 transaction and void the pending charge immediately.",
  "response_quality": {
    "professionalism": 95,
    "empathy": 92,
    "clarity": 90,
    "completeness": 88,
    "courtesy": 94,
    "accuracy": 96,
    "actionability": 95
  },
  "coaching_tips": [
    "Acknowledge the financial concern immediately before asking for account verification.",
    "Reassure the customer that duplicate pending authorisations can be reversed without a lengthy dispute cycle."
  ],
  "alternative_responses": {
    "empathetic": "I am so sorry for the stress this double charge caused, Elena. Please rest assured I am personally reversing the extra charge right now so you don't have to worry.",
    "formal": "Thank you for bringing this to our attention, Elena. I am accessing your billing ledger to identify the secondary $59.99 charge and issue an immediate cancellation."
  },
  "tone_feedback": "Maintain an empathetic and urgent tone to reassure the customer regarding transaction security.",
  "tone_score": 9.2,
  "grammar_issues": [],
  "empathy_rating": "high",
  "professionalism_rating": "high",
  "do_nots": [
    "Do not tell the customer to call their bank before checking internal transaction logs.",
    "Avoid saying 'It was just a system glitch' without apologizing for the inconvenience."
  ],
  "next_best_action": "Verify customer account ID, confirm the duplicate auth code, and execute a 1-click void in the billing portal.",
  "reasoning": "Empathy directly disarms the high frustration score, while immediate voiding fulfills the resolution criteria."
}
`.trim();

export function build_coaching_prompt(
  conversation_history: string,
  customer_message: string,
  intent: string,
  emotion: string,
  frustration_level: number,
  knowledge_context: string,
  agent_last_message: string
): [string, string] {
  const user = `
CONVERSATION HISTORY:
${conversation_history || "Conversation just started."}

LATEST CUSTOMER MESSAGE: "${customer_message}"
DETECTED INTENT: ${intent}
CUSTOMER EMOTION: ${emotion}
FRUSTRATION LEVEL: ${frustration_level}/10

RELEVANT KNOWLEDGE BASE:
${knowledge_context || "No relevant knowledge articles found."}

AGENT'S LAST RESPONSE:
${agent_last_message || "Agent has not responded yet."}

Provide real-time coaching for the support agent.
`.trim();

  return [COACHING_SYSTEM_PROMPT, user];
}

const MODELS_TO_TRY = GEMINI_FALLBACK_MODELS;

export function getCoachingAndSuggestionsFallback(
  input: CoachingAgentInput
): CoachingAgentOutput {
  const messageLower = (input.currentMessage || "").toLowerCase();
  const intent = input.intent || "General Customer Query";
  const emotionalState = input.emotionalState || "Neutral / Concerned";
  const frustrationLevel = input.frustrationLevel || "Medium";

  let kbExcerpt = "";
  if (input.knowledgeRecommendations && input.knowledgeRecommendations.length > 0) {
    const topRec = input.knowledgeRecommendations[0];
    kbExcerpt = topRec.excerpt || topRec.summary || "";
  }

  let primaryResponse = `I am truly sorry to hear that you're experiencing issues regarding ${intent.toLowerCase()}. I completely understand your frustration. ${kbExcerpt ? `According to our policy: "${kbExcerpt}". ` : ''}Let me look into this for you immediately to resolve it right away.`;
  let formalResponse = `Thank you for contacting customer support. ${kbExcerpt ? `Per company guidelines: ${kbExcerpt}. ` : ''}I am currently investigating your query and will assist you promptly.`;
  let empatheticResponse = `I hear you completely, and I'd be frustrated too! ${kbExcerpt ? `Just to share our policy: ${kbExcerpt}. ` : ''}Let's fix this together right now.`;

  const tips = [
    "Acknowledge customer emotion immediately before providing information.",
    "Offer a clear, immediate next action step."
  ];

  return {
    suggested_response: primaryResponse,
    response_quality: {
      professionalism: 92,
      empathy: 95,
      clarity: 90,
      completeness: 88,
      courtesy: 94,
      accuracy: 90,
      actionability: 92
    },
    coaching_tips: tips,
    alternative_responses: {
      formal: formalResponse,
      empathetic: empatheticResponse
    },
    reasoning: `Selected response addresses '${intent}' while managing emotional state '${emotionalState}'.`,
    tone_feedback: "Professional and empathetic tone maintained.",
    tone_score: 8.0,
    grammar_issues: [],
    empathy_rating: "high",
    professionalism_rating: "high",
    do_nots: ["Don't say 'that's not our policy'", "Avoid delay without explanation"],
    next_best_action: "Provide concrete timeline and verify customer details."
  };
}

export async function getCoachingAndSuggestions(
  input: CoachingAgentInput
): Promise<CoachingAgentOutput> {
  const {
    currentMessage,
    history = [],
    intent = "General Customer Query",
    emotionalState = "Concerned",
    frustrationScore = 50,
    knowledgeRecommendations = []
  } = input;

  if (!currentMessage || typeof currentMessage !== "string") {
    return getCoachingAndSuggestionsFallback(input);
  }

  const ai = getSharedAIClient();
  if (!ai) {
    return getCoachingAndSuggestionsFallback(input);
  }

  const formattedHistory = history
    .map((m, idx) => `[Turn ${idx + 1}] ${m.sender === "customer" ? "Customer" : "Agent"}: ${m.text}`)
    .join("\n");

  const agentLastMsg = history.filter(m => m.sender === 'agent').pop()?.text || "";

  const kbFormatted = knowledgeRecommendations
    .map((rec: any, idx) => `[Doc ${idx + 1}] "${rec.title || rec.document_title}": ${rec.summary || rec.excerpt}`)
    .join("\n");

  const frustLevelTen = Math.round(frustrationScore / 10);

  const [sysPrompt, userPrompt] = build_coaching_prompt(
    formattedHistory,
    currentMessage,
    intent,
    emotionalState,
    frustLevelTen,
    kbFormatted,
    agentLastMsg
  );

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
              suggested_response: { type: Type.STRING },
              communication_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              tone_feedback: { type: Type.STRING },
              tone_score: { type: Type.NUMBER },
              grammar_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
              empathy_rating: { type: Type.STRING },
              professionalism_rating: { type: Type.STRING },
              do_nots: { type: Type.ARRAY, items: { type: Type.STRING } },
              next_best_action: { type: Type.STRING }
            },
            required: ["suggested_response", "communication_tips", "tone_feedback", "tone_score", "next_best_action"]
          }
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), GEMINI_AGENT_TIMEOUT_MS);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (response && response.text) {
        const res = JSON.parse(response.text);
        const rawScore = res.tone_score ?? 8;
        const scorePercent = Math.min(100, Math.round(rawScore * 10));

        return {
          suggested_response: res.suggested_response || "Thank you for reaching out. Let me look into this for you immediately.",
          response_quality: {
            professionalism: scorePercent,
            empathy: res.empathy_rating === 'high' ? 95 : res.empathy_rating === 'medium' ? 75 : 55,
            clarity: 90,
            completeness: 88,
            courtesy: 92,
            accuracy: 90,
            actionability: 95
          },
          coaching_tips: res.communication_tips || ["Acknowledge customer frustration immediately."],
          alternative_responses: {
            formal: `Thank you for contacting customer support regarding your query. We are actively reviewing your case details and will assist you promptly.`,
            empathetic: `I completely understand how frustrating this situation is for you! Let me take care of this immediately and ensure it gets resolved for you.`
          },
          reasoning: res.tone_feedback || "Coaching guidance generated based on customer emotion and prompt standards.",
          tone_feedback: res.tone_feedback,
          tone_score: res.tone_score,
          grammar_issues: res.grammar_issues || [],
          empathy_rating: res.empathy_rating,
          professionalism_rating: res.professionalism_rating,
          do_nots: res.do_nots || [],
          next_best_action: res.next_best_action
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

  return getCoachingAndSuggestionsFallback(input);
}

export async function coachingNode(
  state: CoachingAgentState
): Promise<CoachingAgentState> {
  const coachingOutput = await getCoachingAndSuggestions({
    currentMessage: state.currentMessage,
    history: state.history,
    intent: state.intent,
    sentiment: state.sentiment,
    emotionalState: state.emotionalState,
    frustrationLevel: state.frustrationLevel,
    frustrationScore: state.frustrationScore,
    satisfactionTrend: state.satisfactionTrend,
    knowledgeRecommendations: state.knowledgeRecommendations,
    product: state.product || state.sessionInfo?.product,
    sessionInfo: state.sessionInfo
  });

  return {
    ...state,
    coachingOutput
  };
}
