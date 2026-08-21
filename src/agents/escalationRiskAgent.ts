import { GoogleGenAI, Type } from "@google/genai";
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  getSharedAIClient,
  markQuotaExhausted
} from "../config/geminiConfig.js";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface EscalationRiskOutput {
  escalation_score: number; // 0 to 100
  risk_level: RiskLevel;
  confidence_score: number; // 0 to 100
  reasoning: string;
  recommended_actions: string[];
  detected_triggers: string[];
  recommended_action_code?: string;
  time_to_escalation_estimate?: string;
}

export interface ConversationMessage {
  sender: "customer" | "agent" | string;
  text: string;
  timestamp?: string;
  [key: string]: any;
}

export interface EscalationRiskInput {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  sentiment?: string;
  emotionalState?: string;
  frustrationScore?: number;
  satisfactionTrend?: string;
  sessionInfo?: any;
}

export interface EscalationRiskState {
  currentMessage: string;
  history?: ConversationMessage[];
  intent?: string;
  sentiment?: string;
  emotionalState?: string;
  frustrationScore?: number;
  satisfactionTrend?: string;
  sessionInfo?: any;
  escalationOutput?: EscalationRiskOutput;
  [key: string]: any;
}

// System Prompt defined as per Vidzai AI Customer Support Coaching Assistant specification
export const ESCALATION_SYSTEM_PROMPT = `
You are the "Escalation Risk Monitor Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to continuously analyze live conversation transcripts, identify dangerous escalation vectors and churn triggers, compute an exact escalation risk probability score (0.00 to 1.00 / 0 to 100), and recommend immediate de-escalation actions before customer dissatisfaction becomes critical.

======================================================================
1. ESCALATION RISK SCORING & TIERS
======================================================================
- Low (0 to 34 / 0.00 - 0.34): Standard cooperative dialogue; questions answered smoothly, no churn or supervisor threats.
- Medium (35 to 59 / 0.35 - 0.59): Noticeable customer annoyance, repeat inquiries, minor impatience; manageable with active empathy and clear policy explanation.
- High (60 to 79 / 0.60 - 0.79): Strong escalation signals, heated dissatisfaction, multiple failed attempts, demands for concessions or supervisor involvement; requires swift intervention.
- Critical (80 to 100 / 0.80 - 1.00): Imminent risk of customer loss, aggressive hostility, explicit threats (legal counsel, credit card chargebacks, social media backlash, regulatory complaints), or absolute demand to speak with executive management.

======================================================================
2. ESCALATION TRIGGERS TO DETECT & FLAG
======================================================================
Identify specific conversational patterns:
- "supervisor_demand": "let me speak to your manager", "escalate this", "supervisor now", "transfer me"
- "churn_cancellation_threat": "cancelling my subscription", "taking my business elsewhere", "closing my account", "switching to a competitor"
- "financial_legal_threat": "chargeback with my credit card", "disputing the transaction", "calling my lawyer", "filing a BBB complaint", "reporting to consumer protection"
- "repetition_fatigue": "this is the 3rd time I contacted you", "already told you this", "waiting for 2 hours", "no one is listening"
- "hostility_profanity": Insults, extreme sarcasm, aggressive typography (ALL CAPS, multi-exclamation).
- "unresolved_blocker": Mission-critical business presentation, lost perishable goods, security lockout with impending deadline.

======================================================================
3. RECOMMENDED ACTIONS & INTERVENTION STRATEGIES
======================================================================
- "continue": Normal conversational progression.
- "monitor": Increase empathetic tone and provide explicit milestones.
- "de_escalate": Offer immediate goodwill concession (e.g. shipping refund, one-time policy exception, expedited diagnostic).
- "transfer_to_supervisor": Initiate a warm transfer to a supervisor/tier-2 team with full context briefing.

======================================================================
4. OUTPUT JSON SCHEMA (STRICT REQUIREMENT: VALID JSON ONLY)
======================================================================
{
  "escalation_risk": 0.78,
  "escalation_score": 78,
  "risk_level": "High",
  "confidence_score": 92,
  "reasons": [
    "Customer explicitly requested to speak to a manager after multiple unanswered delivery questions.",
    "Time-sensitive child birthday gift is 24 hours overdue."
  ],
  "recommended_actions": [
    "Acknowledge the supervisor request immediately without arguing.",
    "Offer to initiate a priority courier trace while preparing warm transfer notes."
  ],
  "escalation_triggers": [
    "supervisor_demand",
    "repetition_fatigue"
  ],
  "recommended_action_code": "transfer_to_supervisor",
  "time_to_escalation_estimate": "1 message"
}
`.trim();

export function build_escalation_prompt(
  conversation_history: string,
  customer_message: string,
  message_count: number
): [string, string] {
  const user = `
CONVERSATION HISTORY:
${conversation_history || "Conversation just started."}

LATEST CUSTOMER MESSAGE: "${customer_message}"
TOTAL MESSAGES IN CONVERSATION: ${message_count}

Assess escalation risk and provide your recommendation.
`.trim();

  return [ESCALATION_SYSTEM_PROMPT, user];
}

const MODELS_TO_TRY = GEMINI_FALLBACK_MODELS;

export function getEscalationRiskFallback(
  input: EscalationRiskInput
): EscalationRiskOutput {
  const textLower = (input.currentMessage || "").toLowerCase();
  const frustScore = input.frustrationScore ?? 50;

  const triggers: string[] = [];
  let score = Math.min(100, Math.max(0, frustScore));

  if (textLower.includes("supervisor") || textLower.includes("manager") || textLower.includes("higher up")) {
    triggers.push("supervisor_request");
    score += 35;
  }
  if (textLower.includes("cancel") || textLower.includes("close account") || textLower.includes("switching")) {
    triggers.push("cancellation_mention");
    score += 25;
  }
  if (textLower.includes("refund") || textLower.includes("chargeback") || textLower.includes("sue")) {
    triggers.push("refund_or_legal_threat");
    score += 20;
  }

  score = Math.min(100, Math.max(10, score));

  let riskLevel: RiskLevel = "Low";
  if (score >= 80) riskLevel = "Critical";
  else if (score >= 60) riskLevel = "High";
  else if (score >= 35) riskLevel = "Medium";

  return {
    escalation_score: score,
    risk_level: riskLevel,
    confidence_score: 90,
    reasoning: `Risk score evaluated at ${score}/100 based on detected triggers: ${triggers.join(", ")}.`,
    recommended_actions: riskLevel === "Critical" ? ["Transfer to supervisor immediately"] : ["Monitor conversation closely", "Increase empathy"],
    detected_triggers: triggers,
    recommended_action_code: riskLevel === "Critical" ? "transfer_to_manager" : "monitor"
  };
}

export async function getEscalationRisk(
  input: EscalationRiskInput
): Promise<EscalationRiskOutput> {
  const { currentMessage, history = [] } = input;

  if (!currentMessage || typeof currentMessage !== "string") {
    return getEscalationRiskFallback(input);
  }

  const ai = getSharedAIClient();
  if (!ai) {
    return getEscalationRiskFallback(input);
  }

  const formattedHistory = history
    .map((m, idx) => `[Turn ${idx + 1}] ${m.sender === "customer" ? "Customer" : "Agent"}: ${m.text}`)
    .join("\n");

  const [sysPrompt, userPrompt] = build_escalation_prompt(formattedHistory, currentMessage, history.length + 1);
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
              escalation_risk: { type: Type.NUMBER },
              risk_level: { type: Type.STRING },
              reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommended_action: { type: Type.STRING },
              escalation_triggers: { type: Type.ARRAY, items: { type: Type.STRING } },
              time_to_escalation_estimate: { type: Type.STRING }
            },
            required: ["escalation_risk", "risk_level", "reasons", "recommended_action", "escalation_triggers"]
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
        const prob = typeof res.escalation_risk === 'number' ? res.escalation_risk : 0.5;
        const scoreInt = Math.min(100, Math.max(0, Math.round(prob <= 1 ? prob * 100 : prob)));

        let mappedRiskLevel: RiskLevel = "Low";
        const levelLower = (res.risk_level || "").toLowerCase();
        if (levelLower.includes("critical") || scoreInt >= 80) mappedRiskLevel = "Critical";
        else if (levelLower.includes("high") || scoreInt >= 60) mappedRiskLevel = "High";
        else if (levelLower.includes("medium") || scoreInt >= 35) mappedRiskLevel = "Medium";

        const actionMap: Record<string, string> = {
          continue: "Situation is manageable, continue conversation normally.",
          monitor: "Increasing risk; be more empathetic and solution-focused.",
          escalate: "Transfer to senior agent or specialist.",
          transfer_to_manager: "Customer explicitly requested or situation demands manager transfer."
        };

        const recommendedText = actionMap[res.recommended_action] || res.recommended_action || "Monitor conversation closely.";

        return {
          escalation_score: scoreInt,
          risk_level: mappedRiskLevel,
          confidence_score: 92,
          reasoning: (res.reasons && res.reasons.length > 0)
            ? res.reasons.join(". ")
            : `Escalation probability ${prob.toFixed(2)} based on conversation analysis.`,
          recommended_actions: [recommendedText],
          detected_triggers: res.escalation_triggers || [],
          recommended_action_code: res.recommended_action,
          time_to_escalation_estimate: res.time_to_escalation_estimate
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

  return getEscalationRiskFallback(input);
}

export async function escalationRiskNode(
  state: EscalationRiskState
): Promise<EscalationRiskState> {
  const escalationOutput = await getEscalationRisk({
    currentMessage: state.currentMessage,
    history: state.history,
    intent: state.intent,
    sentiment: state.sentiment,
    emotionalState: state.emotionalState,
    frustrationScore: state.frustrationScore,
    satisfactionTrend: state.satisfactionTrend,
    sessionInfo: state.sessionInfo
  });

  return {
    ...state,
    escalationOutput
  };
}
