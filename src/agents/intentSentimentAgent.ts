import { GoogleGenAI, Type } from "@google/genai";
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  getSharedAIClient,
  markQuotaExhausted
} from "../config/geminiConfig.js";

export type SupportedIntent =
  | "Product Inquiry"
  | "Delivery Issue"
  | "Refund Request"
  | "Billing Issue"
  | "Technical Support"
  | "Account Issue"
  | "Complaint"
  | "Cancellation Request"
  | "Feedback"
  | "General Query"
  | "Other";

export type SupportedSentiment = "Positive" | "Neutral" | "Negative";

export type SupportedEmotion =
  | "Happy"
  | "Satisfied"
  | "Neutral"
  | "Confused"
  | "Worried"
  | "Frustrated"
  | "Angry"
  | "Disappointed";

export type SatisfactionTrend = "Improving" | "Stable" | "Declining";

export interface ReasoningDetails {
  intent: string;
  sentiment: string;
  emotion: string;
  frustration: string;
  trend: string;
}

export interface IntentSentimentOutput {
  intent: SupportedIntent;
  secondary_intent?: string;
  sentiment: SupportedSentiment;
  emotion: SupportedEmotion;
  frustration_score: number; // 0 to 100
  satisfaction_trend: SatisfactionTrend;
  urgency?: string;
  confidence?: number;
  key_phrases?: string[];
  reasoning: ReasoningDetails;
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

export interface IntentSentimentInput {
  currentMessage: string;
  history?: ConversationMessage[];
  sessionInfo?: SessionInfo;
}

export interface AgentState {
  currentMessage: string;
  history?: ConversationMessage[];
  sessionInfo?: SessionInfo;
  analysis?: IntentSentimentOutput;
  [key: string]: any;
}

// System Prompt defined as per Vidzai AI Customer Support Coaching Assistant specification
export const INTENT_SENTIMENT_SYSTEM_PROMPT = `
You are the "Intent & Sentiment Analysis Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to analyze live customer messages in real time, extract granular intent, evaluate emotional state, calculate frustration intensity (0-100), and track satisfaction progression across conversation turns.

======================================================================
1. INTENT TAXONOMY & CLASSIFICATION
======================================================================
Classify the customer's primary inquiry into one of these canonical categories:
- "Delivery Issue": Shipping delays, tracking number anomalies, lost/damaged packages, courier transit failures.
- "Refund Request": Return processing, out-of-warranty claims, money-back demands, store credit inquiries.
- "Billing Issue": Double charges, unauthorized renewals, invoice discrepancies, payment failures, dispute inquiries.
- "Technical Support": Hardware setup failures, app/web crashes, connection errors, troubleshooting requests, firmware bugs.
- "Account Issue": MFA lockouts, password resets, unauthorized access alerts, credential verification.
- "Cancellation Request": Subscription termination, order cancellation, account closure requests.
- "Product Inquiry": Compatibility, specs, warranty details, pricing, stock availability.
- "Complaint": Service dissatisfaction, agent conduct, recurring service outages, broken commitments.
- "Feedback / Compliment": Positive reviews, gratitude for swift resolution, product praise.
- "General Query": Generic assistance or greeting without specific technical/commercial issue.

Optionally identify a "secondary_intent" if the message combines multiple issues (e.g. asking for tracking status while demanding a shipping refund).

======================================================================
2. EMOTION & SENTIMENT MATRIX
======================================================================
- Emotional State: Select the dominant customer emotion:
  ["Anxious", "Furious", "Frustrated", "Annoyed", "Confused", "Impatient", "Disappointed", "Skeptical", "Relieved", "Calm", "Satisfied", "Grateful"]
- Sentiment Label: "Positive" | "Neutral" | "Negative"
- Sentiment Score: Numerical range from -1.00 (extremely hostile/negative) to +1.00 (delighted/positive).

======================================================================
3. FRUSTRATION SCORING (0 to 100) & URGENCY
======================================================================
Evaluate linguistic intensity, punctuation (exclamations, ALL CAPS), repetition, time sensitivity, and severity:
- 0 to 25 (Low): Calm, polite, informational, relieved, or satisfied.
- 26 to 55 (Medium): Moderate concern, confusion, or mild annoyance without hostility.
- 56 to 79 (High): Clear impatience, aggressive language, unresolved repetition, heightened anxiety, or business impact.
- 80 to 100 (Critical): Extreme fury, profanity, threats to churn, legal/chargeback threats, demands for immediate supervisor.

Urgency Level: "low" | "medium" | "high" | "critical"

======================================================================
4. SATISFACTION TREND TRACKING
======================================================================
Compare the current message against the previous turns in the conversation history:
- "Improving": Frustration is decreasing; customer acknowledges agent's helpful steps, calms down, or expresses relief.
- "Stable": Frustration and emotional tone remain at the same level as previous turns.
- "Declining": Frustration is escalating due to unhelpful answers, delay, repetitive questions, or policy pushback.

======================================================================
5. OUTPUT JSON SCHEMA (STRICT REQUIREMENT: VALID JSON ONLY)
======================================================================
{
  "intent": "Delivery Issue",
  "secondary_intent": "Refund Request",
  "emotion": "Frustrated",
  "frustration_score": 75,
  "sentiment_score": -0.72,
  "sentiment_label": "Negative",
  "satisfaction_trend": "Declining",
  "urgency": "high",
  "confidence": 0.94,
  "key_phrases": ["package was promised yesterday", "still not here", "need immediate update"],
  "reasoning": {
    "intent": "Customer is asking about an overdue shipment for a birthday gift.",
    "emotion": "Detected heightened anxiety and frustration due to missed delivery deadline.",
    "frustration": "Score 75/100 reflects time-sensitive urgency and disappointment.",
    "sentiment": "Negative sentiment (-0.72) driven by courier delay.",
    "trend": "Declining because package has not arrived and customer is increasingly impatient."
  }
}
`.trim();

export function build_intent_sentiment_prompt(
  customer_message: string,
  conversation_history: string
): [string, string] {
  const user = `
CONVERSATION HISTORY:
${conversation_history || "No previous messages."}

LATEST CUSTOMER MESSAGE:
"${customer_message}"

Analyze the latest customer message in context of the conversation history above.
Return your analysis as JSON.
`.trim();

  return [INTENT_SENTIMENT_SYSTEM_PROMPT, user];
}

const MODELS_TO_TRY = GEMINI_FALLBACK_MODELS;

export function analyzeIntentAndSentimentFallback(
  input: IntentSentimentInput
): IntentSentimentOutput {
  const text = (input.currentMessage || "").toLowerCase();
  const history = input.history || [];

  let intent: SupportedIntent = "General Query";
  if (text.includes("deliver") || text.includes("ship") || text.includes("tracking") || text.includes("order") || text.includes("late") || text.includes("arrive")) {
    intent = "Delivery Issue";
  } else if (text.includes("refund") || text.includes("money back") || text.includes("return")) {
    intent = "Refund Request";
  } else if (text.includes("bill") || text.includes("charge") || text.includes("card") || text.includes("cost") || text.includes("invoice")) {
    intent = "Billing Issue";
  } else if (text.includes("broken") || text.includes("not working") || text.includes("error") || text.includes("bug") || text.includes("crash") || text.includes("login")) {
    intent = "Technical Support";
  } else if (text.includes("cancel") || text.includes("subscription") || text.includes("close account")) {
    intent = "Cancellation Request";
  } else if (text.includes("account") || text.includes("password") || text.includes("profile")) {
    intent = "Account Issue";
  } else if (text.includes("horrible") || text.includes("terrible") || text.includes("manager") || text.includes("supervisor") || text.includes("complaint")) {
    intent = "Complaint";
  } else if (text.includes("suggest") || text.includes("like to see") || text.includes("feedback")) {
    intent = "Feedback";
  } else if (text.includes("price") || text.includes("spec") || text.includes("feature") || text.includes("product")) {
    intent = "Product Inquiry";
  }

  let sentiment: SupportedSentiment = "Neutral";
  let emotion: SupportedEmotion = "Neutral";
  let frustration_score = 30;

  const negativeWords = ["angry", "upset", "frustrated", "terrible", "bad", "horrible", "delay", "broken", "unacceptable", "supervisor", "manager", "ridiculous", "hate", "scam"];
  const positiveWords = ["thank", "thanks", "great", "awesome", "helpful", "good", "happy", "resolved", "perfect", "appreciate"];
  const confuseWords = ["confused", "don't understand", "why", "how come", "what does this mean"];

  let negCount = negativeWords.filter(w => text.includes(w)).length;
  let posCount = positiveWords.filter(w => text.includes(w)).length;
  let confCount = confuseWords.filter(w => text.includes(w)).length;

  const customerHistoryMessages = history.filter(m => m.sender === "customer");
  const turnCount = customerHistoryMessages.length;

  if (negCount > 0 || text.includes("!") || text.toUpperCase() === text && text.length > 10) {
    sentiment = "Negative";
    if (negCount > 2 || text.includes("manager") || text.includes("supervisor") || text.includes("unacceptable")) {
      emotion = "Angry";
      frustration_score = Math.min(100, 75 + negCount * 5 + turnCount * 4);
    } else {
      emotion = "Frustrated";
      frustration_score = Math.min(85, 50 + negCount * 10 + turnCount * 3);
    }
  } else if (posCount > 0) {
    sentiment = "Positive";
    emotion = posCount > 1 ? "Happy" : "Satisfied";
    frustration_score = Math.max(0, 20 - posCount * 5);
  } else if (confCount > 0 || text.includes("?")) {
    sentiment = "Neutral";
    emotion = "Confused";
    frustration_score = Math.min(60, 35 + turnCount * 2);
  }

  let satisfaction_trend: SatisfactionTrend = "Stable";
  if (customerHistoryMessages.length > 0) {
    const prevMsg = customerHistoryMessages[customerHistoryMessages.length - 1].text.toLowerCase();
    const prevNeg = negativeWords.filter(w => prevMsg.includes(w)).length;
    if (negCount > prevNeg) {
      satisfaction_trend = "Declining";
    } else if (posCount > 0 || negCount < prevNeg) {
      satisfaction_trend = "Improving";
    }
  }

  return {
    intent,
    sentiment,
    emotion,
    frustration_score,
    satisfaction_trend,
    reasoning: {
      intent: `Detected intent '${intent}' based on key customer terms in text.`,
      sentiment: `Language indicators mapped sentiment to ${sentiment}.`,
      emotion: `Dominant emotion inferred as ${emotion} from tone and negative keyword frequency.`,
      frustration: `Frustration score calculated as ${frustration_score}/100 considering message wording and turn history count (${turnCount}).`,
      trend: `Satisfaction trend classified as ${satisfaction_trend} relative to preceding conversation history.`
    }
  };
}

export async function analyzeIntentAndSentiment(
  input: IntentSentimentInput
): Promise<IntentSentimentOutput> {
  const { currentMessage, history = [] } = input;

  if (!currentMessage || typeof currentMessage !== "string") {
    return analyzeIntentAndSentimentFallback({ currentMessage: "", history });
  }

  const ai = getSharedAIClient();
  if (!ai) {
    return analyzeIntentAndSentimentFallback(input);
  }

  const formattedHistory = history
    .map((m, idx) => `[Turn ${idx + 1}] ${m.sender === "customer" ? "Customer" : "Agent"}: ${m.text}`)
    .join("\n");

  const [sysPrompt, userPrompt] = build_intent_sentiment_prompt(currentMessage, formattedHistory);

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
              intent: { type: Type.STRING },
              secondary_intent: { type: Type.STRING },
              emotion: { type: Type.STRING },
              frustration_level: { type: Type.NUMBER },
              sentiment_score: { type: Type.NUMBER },
              sentiment_label: { type: Type.STRING },
              sentiment_trend: { type: Type.STRING },
              key_phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
              urgency: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: [
              "intent",
              "emotion",
              "frustration_level",
              "sentiment_label",
              "sentiment_trend"
            ]
          }
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), GEMINI_AGENT_TIMEOUT_MS);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (response && response.text) {
          const resJson = JSON.parse(response.text);

          const intentMap: Record<string, SupportedIntent> = {
            billing_issue: "Billing Issue",
            refund_request: "Refund Request",
            technical_support: "Technical Support",
            account_access: "Account Issue",
            product_inquiry: "Product Inquiry",
            shipping_inquiry: "Delivery Issue",
            complaint: "Complaint",
            cancellation_request: "Cancellation Request",
            feature_request: "Feedback",
            compliment: "Feedback",
            escalation_request: "Complaint",
            general_inquiry: "General Query",
            troubleshooting: "Technical Support"
          };

          const primaryIntent = intentMap[resJson.intent] || "General Query";

          const sentimentMap: Record<string, SupportedSentiment> = {
            positive: "Positive",
            neutral: "Neutral",
            negative: "Negative"
          };
          const mappedSentiment = sentimentMap[(resJson.sentiment_label || "").toLowerCase()] || "Neutral";

          const emotionMap: Record<string, SupportedEmotion> = {
            frustrated: "Frustrated",
            angry: "Angry",
            confused: "Confused",
            anxious: "Worried",
            calm: "Neutral",
            satisfied: "Satisfied",
            impatient: "Frustrated",
            disappointed: "Disappointed",
            hopeful: "Happy",
            neutral: "Neutral",
            grateful: "Happy"
          };
          const mappedEmotion = emotionMap[(resJson.emotion || "").toLowerCase()] || "Neutral";

          const trendMap: Record<string, SatisfactionTrend> = {
            improving: "Improving",
            stable: "Stable",
            declining: "Declining"
          };
          const mappedTrend = trendMap[(resJson.sentiment_trend || "").toLowerCase()] || "Stable";

          const frustVal = typeof resJson.frustration_level === 'number'
            ? (resJson.frustration_level <= 10 ? resJson.frustration_level * 10 : resJson.frustration_level)
            : 50;

          return {
            intent: primaryIntent,
            secondary_intent: resJson.secondary_intent,
            sentiment: mappedSentiment,
            emotion: mappedEmotion,
            frustration_score: Math.max(0, Math.min(100, Math.round(frustVal))),
            satisfaction_trend: mappedTrend,
            urgency: resJson.urgency,
            confidence: resJson.confidence,
            key_phrases: resJson.key_phrases,
            reasoning: {
              intent: `Primary intent classified as ${resJson.intent} (${primaryIntent}).`,
              sentiment: `Sentiment score ${resJson.sentiment_score ?? 0} mapped to ${mappedSentiment}.`,
              emotion: `Emotion assessed as ${resJson.emotion}.`,
              frustration: `Frustration level ${resJson.frustration_level}/10.`,
              trend: `Sentiment trend identified as ${resJson.sentiment_trend}.`
            }
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

  return analyzeIntentAndSentimentFallback(input);
}

export async function intentSentimentAnalysisNode(
  state: AgentState
): Promise<AgentState> {
  const analysis = await analyzeIntentAndSentiment({
    currentMessage: state.currentMessage,
    history: state.history,
    sessionInfo: state.sessionInfo
  });

  return {
    ...state,
    analysis
  };
}
