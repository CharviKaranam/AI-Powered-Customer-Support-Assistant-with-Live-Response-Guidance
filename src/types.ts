export interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'High';
  initialMood: string;
  initialFrustration: 'Low' | 'Medium' | 'High';
  customerProfile: {
    name: string;
    avatarUrl: string;
    company?: string;
    persona?: string;
  };
}

export interface KBChunk {
  chunkId: string;
  articleId: string;
  title: string;
  category: string;
  content: string;
  chunkType: 'summary' | 'procedure' | 'exceptions' | 'general';
  tags?: string[];
  relevanceScore?: number;
}

export interface KBArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  steps: string[];
  tags?: string[];
  applicableProducts?: string[];
  authorityLevel?: string;
  maxCompensation?: string;
  lastUpdated?: string;
  sourceDoc?: string;
  chunks?: KBChunk[];
}

export interface KBEmbedding {
  id: string;
  embedding: number[];
}

export interface RAGSearchResult {
  article: KBArticle;
  score: number;
  semanticSimilarity: number;
  keywordScore: number;
  matchedChunks: KBChunk[];
  retrievalReason?: string;
}

export interface Analysis {
  intent: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  emotionalState: string;
  frustrationLevel: 'Low' | 'Medium' | 'High';
  escalationRisk: 'Low' | 'Medium' | 'High';
  coachingGuidance: string;
  responseSuggestion: string;
}

export interface Message {
  id: string;
  sessionId: string;
  sender: 'customer' | 'agent';
  text: string;
  timestamp: string;
  
  // These fields are populated for 'customer' messages
  intent?: string;
  sentiment?: 'Positive' | 'Neutral' | 'Negative';
  emotionalState?: string;
  frustrationLevel?: 'Low' | 'Medium' | 'High';
  frustrationScore?: number;
  satisfactionTrend?: 'Improving' | 'Stable' | 'Declining';
  escalationRisk?: 'Low' | 'Medium' | 'High';
  reasoningDetails?: {
    intent?: string;
    sentiment?: string;
    emotion?: string;
    frustration?: string;
    trend?: string;
  };
  
  // These fields are populated for 'customer' messages as advice for the agent
  coachingGuidance?: string;
  responseSuggestion?: string;
  relevantKnowledge?: string[]; // Titles or IDs of retrieved knowledge
  relevantArticles?: KBArticle[]; // Full retrieved knowledge base articles
  knowledgeRecommendations?: {
    title: string;
    category: 'Policy' | 'FAQ' | 'Troubleshooting' | 'Manual' | 'SOP' | 'Guide';
    summary: string;
    excerpt: string;
    relevance_score: number;
    reasoning: string;
  }[];
  coachingOutput?: {
    suggested_response: string;
    response_quality: {
      professionalism: number;
      empathy: number;
      clarity: number;
      completeness: number;
      courtesy: number;
      accuracy: number;
      actionability: number;
    };
    coaching_tips: string[];
    alternative_responses: {
      formal: string;
      empathetic: string;
    };
    reasoning: string;
  };
  escalationRiskOutput?: {
    escalation_score: number;
    risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
    confidence_score: number;
    reasoning: string;
    recommended_actions: string[];
    detected_triggers: string[];
  };
}

export type InteractionMode = 'simulator' | 'manual' | 'replay';

export interface SimulationSession {
  id: string;
  scenarioId: string;
  mode?: InteractionMode;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'resolved' | 'escalated';
  summary?: string;
}

export interface ReplayTurn {
  sender: 'customer' | 'agent';
  text: string;
}

export interface SentimentJourneyPoint {
  turn: number;
  sender: 'customer' | 'agent';
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  emotion: string;
  frustrationScore: number;
  satisfactionTrend: 'Improving' | 'Stable' | 'Declining';
  messageExcerpt: string;
}

export interface PostInteractionReport {
  sessionId: string;
  generatedAt: string;
  interactionSummary: {
    customerIssue: string;
    customerObjective: string;
    keyEvents: string[];
    actionsTaken: string[];
    finalOutcome: string;
    resolutionStatus: 'Resolved' | 'Escalated' | 'Unresolved';
    escalated: boolean;
  };
  sentimentJourney: SentimentJourneyPoint[];
  resolutionQuality: {
    score: number; // 0 to 100
    reasoning: string;
  };
  coachingRecommendations: {
    strengths: string[];
    areasForImprovement: string[];
    recommendedActions: string[];
  };
}

export interface PerformanceAnalyticsData {
  totalSessions: number;
  resolvedSessions: number;
  escalatedSessions: number;
  resolutionRate: number;
  avgResolutionQualityScore: number;
  avgEscalationRiskScore: number;
  avgTurnCount: number;
  commonEscalationTriggers: { trigger: string; count: number }[];
  knowledgeGaps: { topic: string; count: number; reason: string }[];
  improvementIndicators: {
    strengths: { name: string; count: number }[];
    areasToImprove: { name: string; count: number }[];
    sentimentProgression: { sessionLabel: string; initialFrustration: number; finalFrustration: number; qualityScore: number }[];
  };
  sessionHistoryList: Array<{
    id: string;
    date: string;
    scenarioName: string;
    mode: InteractionMode;
    status: 'active' | 'resolved' | 'escalated';
    qualityScore?: number;
    turnCount: number;
  }>;
}

