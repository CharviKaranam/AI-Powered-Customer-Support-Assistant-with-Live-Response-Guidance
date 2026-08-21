import { GoogleGenAI, Type } from '@google/genai';
import { Message, Scenario, PostInteractionReport, SentimentJourneyPoint } from '../types.js';
import { 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_SUMMARY_TIMEOUT_MS, 
  getSharedAIClient,
  markQuotaExhausted
} from '../config/geminiConfig.js';

// System Prompt defined as per Vidzai AI Customer Support Coaching Assistant specification
export const SUMMARY_SYSTEM_PROMPT = `
You are the "Post-Interaction Summary Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to conduct an automated, end-to-end quality assurance (QA) assessment of a completed customer support session. You will review the full chronological transcript, turn-by-turn agent actions, and real-time sentiment snapshots to synthesize an executive summary, generate a customer sentiment journey timeline, compute multi-dimensional performance scores (0-100), and formulate targeted developmental coaching recommendations.

======================================================================
1. PERFORMANCE EVALUATION RUBRIC (0 to 100)
======================================================================
- resolution_score (Resolution Completeness & Effectiveness):
  * 90-100: Issue completely resolved, policy explained clearly, customer confirmed satisfaction.
  * 70-89: Issue resolved with minor delays or small information gaps.
  * 40-69: Partially resolved; follow-up action or ticket required.
  * 0-39: Unresolved, customer departed frustrated, or unmanaged escalation.

- communication_score (Clarity & Intent Handling):
  * Precision of language, avoidance of confusing jargon, direct answering of customer questions.

- empathy_score (Emotional Intelligence & Tone):
  * Sincere emotional validation, active listening, reassuring phrasing, absence of dismissive statements.

- professionalism_score (Knowledge Base Adherence & Protocol):
  * Accurate application of corporate policy, procedural compliance, avoidance of forbidden statements.

- overall_score (Composite Resolution Quality Score):
  * Mathematically weighted score: 20% Intent Handling + 20% Tone & Empathy + 20% Knowledge Adherence + 20% Escalation Avoidance + 20% Resolution Completeness.

======================================================================
2. OUTPUT COMPONENTS
======================================================================
- session_summary: Comprehensive 2-3 paragraph overview describing customer issue, agent interventions, and final outcome.
- key_issues: Array of core root causes and pain points identified during the call.
- resolution_status: "resolved" | "partially_resolved" | "unresolved" | "escalated"
- sentiment_journey: Chronological array tracking sentiment score (-1.0 to 1.0) and emotional state per message turn.
- strengths: 2-4 specific positive competencies exhibited by the representative.
- areas_for_improvement: 2-4 concrete behavioral or operational skills requiring improvement.
- coaching_recommendations: 3 numbered, actionable pedagogical steps for agent mentoring.
- knowledge_articles_used: List of knowledge base files referenced or utilized during the session.

======================================================================
3. OUTPUT JSON SCHEMA (STRICT REQUIREMENT: VALID JSON ONLY)
======================================================================
{
  "session_summary": "The customer contacted support regarding an overdue birthday gift delivery. The agent actively listened, validated the customer's anxiety, and cross-referenced the carrier tracking database. The agent initiated an expedited trace and offered a shipping fee waiver, successfully de-escalating the customer and achieving resolution.",
  "key_issues": [
    "Courier transit delay on time-sensitive order",
    "Customer anxiety over impending birthday event",
    "Lack of automated transit exception notification"
  ],
  "resolution_status": "resolved",
  "resolution_score": 92.0,
  "communication_score": 90.0,
  "empathy_score": 95.0,
  "professionalism_score": 94.0,
  "overall_score": 92.8,
  "sentiment_journey": [
    {"message_index": 0, "sentiment_score": -0.85, "emotion": "anxious", "role": "customer"},
    {"message_index": 1, "sentiment_score": -0.40, "emotion": "frustrated", "role": "customer"},
    {"message_index": 2, "sentiment_score": 0.30, "emotion": "relieved", "role": "customer"},
    {"message_index": 3, "sentiment_score": 0.85, "emotion": "grateful", "role": "customer"}
  ],
  "intent_timeline": [
    {"message_index": 0, "intent": "Delivery Issue", "timestamp": "2026-08-14T10:00:00Z"}
  ],
  "escalation_occurred": false,
  "coaching_recommendations": [
    "1. Continue using customer's first name early in the conversation to build human rapport.",
    "2. Proactively offer tracking SMS alerts so the customer does not need to check manual portals.",
    "3. Practice transitioning smoothly from empathy statements into concrete carrier trace workflows."
  ],
  "strengths": [
    "Exemplary empathy and active listening during opening turn",
    "Swift application of the shipping delay exception policy",
    "Clear and definitive resolution timeline provided"
  ],
  "areas_for_improvement": [
    "Could have proactively offered email updates for courier checkpoints",
    "Confirm customer address before triggering replacement units"
  ],
  "knowledge_articles_used": [
    "Standard Delivery Delays & Courier Investigation",
    "Refund & Replacement Policy"
  ]
}
`.trim();

export function build_summary_prompt(
  conversation_transcript: string,
  session_metadata: Record<string, any>,
  analysis_snapshots: string
): [string, string] {
  const user = `
SESSION METADATA:
- Mode: ${session_metadata.mode || 'unknown'}
- Agent: ${session_metadata.agent_name || 'Support Representative'}
- Customer Persona: ${session_metadata.customer_persona || 'unknown'}
- Topic: ${session_metadata.topic || 'General support'}
- Total Messages: ${session_metadata.message_count || 0}
- Duration: ${session_metadata.duration || 'unknown'}

FULL CONVERSATION TRANSCRIPT:
${conversation_transcript}

AI ANALYSIS SNAPSHOTS (per message):
${analysis_snapshots || "No analysis data available."}

Generate the complete coaching report.
`.trim();

  return [SUMMARY_SYSTEM_PROMPT, user];
}

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export function buildFallbackReport(
  sessionId: string,
  scenario: Scenario,
  history: Message[],
  sessionStatus: 'resolved' | 'escalated' | 'active'
): PostInteractionReport {
  const customerMsgs = history.filter(m => m.sender === 'customer');
  const agentMsgs = history.filter(m => m.sender === 'agent');
  const isEscalated = sessionStatus === 'escalated' || customerMsgs.some(m => m.escalationRisk === 'High' || m.frustrationLevel === 'High');

  const sentimentJourney: SentimentJourneyPoint[] = history.map((m, idx) => ({
    turn: idx + 1,
    sender: m.sender,
    sentiment: m.sentiment || (m.sender === 'customer' ? 'Negative' : 'Neutral'),
    emotion: m.emotionalState || (m.sender === 'customer' ? 'Concerned' : 'Professional'),
    frustrationScore: m.frustrationScore ?? (m.frustrationLevel === 'High' ? 85 : m.frustrationLevel === 'Medium' ? 50 : 20),
    satisfactionTrend: m.satisfactionTrend || (isEscalated ? 'Declining' : 'Improving'),
    messageExcerpt: m.text.length > 60 ? m.text.slice(0, 57) + '...' : m.text
  }));

  let qualityScore = 75;
  if (sessionStatus === 'resolved') qualityScore += 15;
  if (isEscalated) qualityScore -= 25;
  qualityScore = Math.max(10, Math.min(100, qualityScore));

  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    interactionSummary: {
      customerIssue: scenario.description || 'Customer support query regarding product or order service.',
      customerObjective: `Resolve issue regarding ${scenario.name}`,
      keyEvents: [
        `Customer initiated conversation regarding ${scenario.name}`,
        `Agent exchanged ${agentMsgs.length} messages addressing the customer query`,
        isEscalated ? 'Conversation experienced high escalation risk' : 'Customer issue reached resolution'
      ],
      actionsTaken: agentMsgs.map(m => m.text.slice(0, 80) + '...').slice(0, 3),
      finalOutcome: sessionStatus === 'resolved'
        ? 'Successfully resolved customer issue through empathetic assistance and knowledge policy guidelines.'
        : isEscalated
        ? 'Customer escalated interaction requesting supervisor/manager review.'
        : 'Session concluded with ongoing assistance provided.',
      resolutionStatus: sessionStatus === 'resolved' ? 'Resolved' : isEscalated ? 'Escalated' : 'Unresolved',
      escalated: isEscalated
    },
    sentimentJourney,
    resolutionQuality: {
      score: qualityScore,
      reasoning: sessionStatus === 'resolved'
        ? `High resolution quality (${qualityScore}/100) due to successful resolution.`
        : `Resolution quality score evaluated at ${qualityScore}/100 based on interaction flow.`
    },
    coachingRecommendations: {
      strengths: [
        'Maintained active communication and addressed customer messages promptly.',
        'Leveraged knowledge base guidance and offered structured troubleshooting.'
      ],
      areasForImprovement: [
        'Acknowledge customer frustration even earlier in the interaction.',
        'Ensure clear and definitive next steps are provided in the opening turn.'
      ],
      recommendedActions: [
        'Review standard de-escalation scripts for frustrated customer scenarios.',
        'Incorporate immediate policy-aligned resolutions in early conversation turns.'
      ]
    }
  };
}

export async function generatePostInteractionReport(
  sessionId: string,
  scenario: Scenario,
  history: Message[],
  sessionStatus: 'resolved' | 'escalated' | 'active'
): Promise<PostInteractionReport> {
  const fallback = buildFallbackReport(sessionId, scenario, history, sessionStatus);

  const ai = getSharedAIClient();
  if (!ai || history.length === 0) {
    return fallback;
  }

  const transcript = history
    .map((m, i) => `Turn ${i + 1} [${m.sender.toUpperCase()}]: ${m.text}`)
    .join('\n');

  const metadata = {
    mode: 'simulation',
    agent_name: 'Support Representative',
    customer_persona: scenario.customerProfile.persona || scenario.initialMood || 'customer',
    topic: scenario.name,
    message_count: history.length,
    duration: `${history.length * 2} minutes`
  };

  const snapshots = history.map((m, i) =>
    `Turn ${i+1} (${m.sender}): Intent=${m.intent || 'N/A'}, Emotion=${m.emotionalState || 'N/A'}, FrustrationScore=${m.frustrationScore ?? 'N/A'}`
  ).join('\n');

  const [sysPrompt, userPrompt] = build_summary_prompt(transcript, metadata, snapshots);
  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      session_summary: { type: Type.STRING },
      key_issues: { type: Type.ARRAY, items: { type: Type.STRING } },
      resolution_status: { type: Type.STRING },
      resolution_score: { type: Type.NUMBER },
      communication_score: { type: Type.NUMBER },
      empathy_score: { type: Type.NUMBER },
      professionalism_score: { type: Type.NUMBER },
      overall_score: { type: Type.NUMBER },
      escalation_occurred: { type: Type.BOOLEAN },
      coaching_recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      areas_for_improvement: { type: Type.ARRAY, items: { type: Type.STRING } },
      knowledge_articles_used: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["session_summary", "key_issues", "resolution_status", "overall_score", "coaching_recommendations", "strengths", "areas_for_improvement"]
  };

  const models = GEMINI_FALLBACK_MODELS;

  for (const modelName of models) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), GEMINI_SUMMARY_TIMEOUT_MS);
      });

      const res = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (res && res.text) {
        const parsed = JSON.parse(res.text);

        const statusMapped = parsed.resolution_status === 'resolved' ? 'Resolved' : parsed.resolution_status === 'escalated' ? 'Escalated' : 'Unresolved';

        return {
          sessionId,
          generatedAt: new Date().toISOString(),
          interactionSummary: {
            customerIssue: parsed.session_summary || fallback.interactionSummary.customerIssue,
            customerObjective: scenario.description || `Resolve ${scenario.name}`,
            keyEvents: parsed.key_issues || fallback.interactionSummary.keyEvents,
            actionsTaken: history.filter(m => m.sender === 'agent').map(m => m.text.slice(0, 80) + '...'),
            finalOutcome: parsed.session_summary || fallback.interactionSummary.finalOutcome,
            resolutionStatus: statusMapped,
            escalated: Boolean(parsed.escalation_occurred)
          },
          sentimentJourney: fallback.sentimentJourney,
          resolutionQuality: {
            score: Math.max(0, Math.min(100, Math.round(parsed.overall_score ?? parsed.resolution_score ?? fallback.resolutionQuality.score))),
            reasoning: `Overall Score: ${parsed.overall_score ?? 80}. Resolution: ${parsed.resolution_score ?? 80}, Communication: ${parsed.communication_score ?? 80}, Empathy: ${parsed.empathy_score ?? 80}, Professionalism: ${parsed.professionalism_score ?? 80}.`
          },
          coachingRecommendations: {
            strengths: parsed.strengths || fallback.coachingRecommendations.strengths,
            areasForImprovement: parsed.areas_for_improvement || fallback.coachingRecommendations.areasForImprovement,
            recommendedActions: parsed.coaching_recommendations || fallback.coachingRecommendations.recommendedActions
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
    }
  }

  return fallback;
}
