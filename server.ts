import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './src/db/store.js';
import { 
  GEMINI_PRIMARY_MODEL, 
  GEMINI_FALLBACK_MODELS, 
  GEMINI_AGENT_TIMEOUT_MS, 
  GEMINI_SUMMARY_TIMEOUT_MS, 
  getSharedAIClient,
  isQuotaExhausted,
  markQuotaExhausted
} from './src/config/geminiConfig.js';
import { 
  KNOWLEDGE_BASE, 
  INITIAL_KNOWLEDGE_BASE, 
  PRESET_KNOWLEDGE_PACKS, 
  chunkArticle, 
  performHybridRAGSearch, 
  activeVectorStore, 
  ingestDocument, 
  deleteDocument, 
  resetKnowledgeBaseToDefault, 
  cosineSimilarity, 
  generateSemanticFallbackVector 
} from './src/rag/kb.js';
import { Scenario, Message, KBArticle } from './src/types.js';
import { analyzeIntentAndSentiment } from './src/agents/intentSentimentAgent.js';
import { getKnowledgeRecommendations } from './src/agents/knowledgeRecommendationAgent.js';
import { getCoachingAndSuggestions } from './src/agents/coachingAgent.js';
import { getEscalationRisk } from './src/agents/escalationRiskAgent.js';
import { generatePostInteractionReport } from './src/agents/postInteractionSummaryAgent.js';


dotenv.config();

const app = express();
app.use(express.json());

// Initialize Gemini SDK with custom agent header
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not set in environment variables. Gemini features will fail.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Predefined simulation scenarios
const SCENARIOS: Scenario[] = [
  {
    id: 'delayed_order',
    name: 'Delayed Order Delivery',
    description: 'Customer purchased a birthday gift for their child. The delivery was scheduled for yesterday but hasn\'t arrived. The customer is anxious and frustrated.',
    difficulty: 'Medium',
    initialMood: 'Anxious & Concerned',
    initialFrustration: 'Medium',
    customerProfile: {
      name: 'Sarah Jenkins',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah'
    }
  },
  {
    id: 'refund_request',
    name: 'Out-of-Warranty Refund Request',
    description: 'Customer bought a smart speaker 45 days ago. The refund policy is strictly 30 days. The device stopped charging and they want a full refund.',
    difficulty: 'Medium',
    initialMood: 'Annoyed & Demanding',
    initialFrustration: 'Medium',
    customerProfile: {
      name: 'Marcus Chen',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus'
    }
  },
  {
    id: 'product_troubleshoot',
    name: 'Smart Hub Setup Failure',
    description: 'Customer is trying to connect a newly unboxed smart hub to their Wi-Fi router. It keeps blinking red and refusing to connect. They\'ve spent an hour troubleshooting.',
    difficulty: 'High',
    initialMood: 'Extremely Frustrated',
    initialFrustration: 'High',
    customerProfile: {
      name: 'David Vance',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=David'
    }
  },
  {
    id: 'billing_double_charge',
    name: 'Duplicate Billing Charges',
    description: 'Customer noticed two identical pending charges of $59.99 on their credit card statement. They are furious and suspect a system glitch.',
    difficulty: 'High',
    initialMood: 'Angry & Suspicious',
    initialFrustration: 'High',
    customerProfile: {
      name: 'Elena Rostova',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Elena'
    }
  },
  {
    id: 'account_lockout',
    name: 'Account Security Lockout',
    description: 'Customer was locked out of their work dashboard after typing the wrong 2FA code. They have an important presentation starting in 30 minutes.',
    difficulty: 'Easy',
    initialMood: 'Panicked & Concerned',
    initialFrustration: 'Low',
    customerProfile: {
      name: 'James Carter',
      avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=James'
    }
  }
];

// High-quality local fallbacks for offline or missing API key execution
const defaultGreetings: Record<string, string> = {
  delayed_order: "Hi, I ordered a birthday gift for my son and it was supposed to arrive yesterday, but it's still not here! I am extremely stressed about this.",
  refund_request: "Hello, I bought a smart speaker 45 days ago but it's stopped charging completely. I know your policy says 30 days, but I want a full refund or a replacement right away.",
  product_troubleshoot: "Hello, I am trying to set up my smart hub. It's just blinking red and won't connect. I've been trying for an hour and nothing works. Please help.",
  billing_double_charge: "I just checked my credit card and I was charged $59.99 TWICE for the same item! This is unacceptable, please fix this system glitch immediately.",
  account_lockout: "Hi, I'm locked out of my account due to too many 2FA attempts, but I have a huge presentation in 30 minutes! Please help me get back in!"
};

const defaultCoaching: Record<string, any> = {
  delayed_order: {
    suggestedResponse: "Hello Sarah, I understand how stressful it is to have a gift arrive late. Let me check the tracking details and see if we can expedite it or issue a status update right away.",
    coachingGuidance: "Acknowledge her anxiety and reassure her. Check the tracking number and offer real-time updates.",
    sentiment: "Negative",
    emotionalState: "Anxious",
    frustrationLevel: "Medium"
  },
  refund_request: {
    suggestedResponse: "Hello Marcus, I understand your speaker stopped charging, and I'd be happy to see how we can resolve this. Since it's past 45 days, let me check our technical troubleshooting or alternative replacement options.",
    coachingGuidance: "Stay firm but polite. The device is out of warranty, so guide the customer through diagnostic steps or standard replacement credit options.",
    sentiment: "Negative",
    emotionalState: "Annoyed",
    frustrationLevel: "Medium"
  },
  product_troubleshoot: {
    suggestedResponse: "Hello David, I'm sorry to hear you've been struggling with the smart hub setup for an hour. Let's get this connected. Let's start by performing a factory reset on the hub.",
    coachingGuidance: "Show deep empathy for his spent time. Provide clear, step-by-step diagnostic actions to reset and reconnect.",
    sentiment: "Negative",
    emotionalState: "Frustrated",
    frustrationLevel: "High"
  },
  billing_double_charge: {
    suggestedResponse: "Hello Elena, I completely understand why you're upset about seeing duplicate charges. Let's check your transactions immediately. If there was a double billing, I will void the pending duplicate right away.",
    coachingGuidance: "Acknowledge the billing error instantly. Apologize for the suspicious duplicate and locate the transaction to reverse it.",
    sentiment: "Negative",
    emotionalState: "Angry",
    frustrationLevel: "High"
  },
  account_lockout: {
    suggestedResponse: "Hello James, I hear you and understand the urgency with your presentation in 30 minutes! Let me verify your identity and unlock your 2FA security override immediately.",
    coachingGuidance: "Act with high urgency. Perform the 2FA identity check and unlock his dashboard instantly.",
    sentiment: "Negative",
    emotionalState: "Panicked",
    frustrationLevel: "Low"
  }
};

// Helper function to generate content with fallback models
async function generateContentWithFallback(params: { contents: string; config?: any }): Promise<any> {
  if (isQuotaExhausted()) {
    throw new Error("Quota cooldown active. Using local fallback.");
  }

  const modelsToTry = GEMINI_FALLBACK_MODELS;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let timer: NodeJS.Timeout | null = null;
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: params.config,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), GEMINI_AGENT_TIMEOUT_MS);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('429') || 
        errMsg.includes('RESOURCE_EXHAUSTED') || 
        errMsg.includes('quota') ||
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand')
      ) {
        markQuotaExhausted(30);
        lastError = err;
        break;
      }
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error("Failed to generate content using Gemini model");
}

async function generateCustomerInitialMessage(scenario: Scenario, finalMood: string, finalDifficulty: string): Promise<string> {
  const initialPrompt = `
    You are acting as a customer in a support chat simulation. Your details:
    Customer Name: ${scenario.customerProfile.name}
    Scenario Title: ${scenario.name}
    Scenario Description: ${scenario.description}
    Initial Mood: ${finalMood}
    Difficulty: ${finalDifficulty}

    Generate the initial opening message you would send to the support team to start this conversation.
    Make it feel natural, human, and express your current issue and initial mood. Do not write a generic intro, start right with the chat text.
    Keep it short (1-3 sentences).

    Return the response in a JSON object structured exactly like this:
    {
      "customerMessage": "the greeting and problem description"
    }
  `;

  if (!process.env.GEMINI_API_KEY || isQuotaExhausted()) {
    return defaultGreetings[scenario.id] || `Hello, I'm ${scenario.customerProfile.name}. I'm having a problem regarding ${scenario.name}: ${scenario.description}`;
  }

  try {
    const response = await generateContentWithFallback({
      contents: initialPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerMessage: { type: Type.STRING }
          },
          required: ['customerMessage']
        }
      }
    });
    const parsed = JSON.parse(response.text || '{}');
    if (parsed.customerMessage) return parsed.customerMessage;
    throw new Error("Empty customerMessage field in parsed JSON");
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.info(`Initial customer greeting using local template fallback: ${errMsg.slice(0, 80)}`);
    return defaultGreetings[scenario.id] || `Hello, I'm ${scenario.customerProfile.name}. I'm having a problem regarding ${scenario.name}: ${scenario.description}`;
  }
}

async function generateInitialCoaching(scenario: Scenario, firstMessageText: string, finalMood: string, kbContextText: string): Promise<any> {
  const coachingPrompt = `
    You are an expert customer support coach. Analyze the first message from the customer and provide immediate suggested response, sentiment categorization, and actionable advice.

    Scenario: ${scenario.name}
    Customer message: "${firstMessageText}"
    Customer Mood: ${finalMood}

    Knowledge Base policies:
    ${kbContextText}

    Create a suggested professional response for the agent that is highly empathetic, addresses the core problem, and follows the retrieved policies.
    Also provide 1-2 direct coaching guidelines for how the agent should handle the opening of this specific interaction (e.g., acknowledging the frustration, clarifying details, etc.).

    Return a JSON object structured exactly like this:
    {
      "suggestedResponse": "the full recommended reply text",
      "coachingGuidance": "direct, actionable bullet point or tip for the agent",
      "sentiment": "Positive" | "Neutral" | "Negative",
      "emotionalState": "e.g. Calm, Confused, Concerned, Frustrated, Angry, Satisfied",
      "frustrationLevel": "Low" | "Medium" | "High"
    }
  `;

  if (!process.env.GEMINI_API_KEY || isQuotaExhausted()) {
    return defaultCoaching[scenario.id] || {
      suggestedResponse: `Hello ${scenario.customerProfile.name}, I understand you are having an issue regarding ${scenario.name}. Let me check our knowledge base guidelines to help you resolve this right away.`,
      coachingGuidance: "Express initial empathy, acknowledge their mood, and search the guidelines for a resolution step.",
      sentiment: "Negative",
      emotionalState: finalMood,
      frustrationLevel: "Medium"
    };
  }

  try {
    const coachingRes = await generateContentWithFallback({
      contents: coachingPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedResponse: { type: Type.STRING },
            coachingGuidance: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ['Positive', 'Neutral', 'Negative'] },
            emotionalState: { type: Type.STRING },
            frustrationLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] }
          },
          required: ['suggestedResponse', 'coachingGuidance', 'sentiment', 'emotionalState', 'frustrationLevel']
        }
      }
    });
    return JSON.parse(coachingRes.text || '{}');
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.info(`Initial coaching using local template fallback: ${errMsg.slice(0, 80)}`);
    return defaultCoaching[scenario.id] || {
      suggestedResponse: `Hello ${scenario.customerProfile.name}, I understand you are having an issue regarding ${scenario.name}. Let me check our knowledge base guidelines to help you resolve this right away.`,
      coachingGuidance: "Express initial empathy, acknowledge their mood, and search the guidelines for a resolution step.",
      sentiment: "Negative",
      emotionalState: finalMood,
      frustrationLevel: "Medium"
    };
  }
}

function simulateTurnRuleBased(scenarioId: string, agentMessage: string, history: Message[]): any {
  const agentLower = agentMessage.toLowerCase();
  
  // Basic attributes default
  let nextCustomerMessage = "";
  let intent = "Seeking Help";
  let sentiment: "Positive" | "Neutral" | "Negative" = "Negative";
  let emotionalState = "Frustrated";
  let frustrationLevel: "Low" | "Medium" | "High" = "Medium";
  let escalationRisk: "Low" | "Medium" | "High" = "Low";
  let status: "active" | "resolved" | "escalated" = "active";
  let reasoning = "Responding to the support representative.";

  // Count turns to auto-resolve or escalate if necessary
  const agentTurnCount = history.filter(m => m.sender === 'agent').length + 1;

  if (scenarioId === 'delayed_order') {
    if (agentLower.includes("sorry") || agentLower.includes("apologize") || agentLower.includes("understand")) {
      frustrationLevel = "Low";
      emotionalState = "Relieved";
      sentiment = "Neutral";
      reasoning = "The agent is showing empathy for my late order delivery, which helps calm me down.";
    }
    if (agentLower.includes("track") || agentLower.includes("ship") || agentLower.includes("delivery") || agentLower.includes("carrier") || agentLower.includes("expedite") || agentLower.includes("refund")) {
      status = "resolved";
      emotionalState = "Satisfied";
      sentiment = "Positive";
      nextCustomerMessage = "Thank you so much! I really appreciate you taking the time to check the tracking details and offering a solution.";
      reasoning = "The agent actually tracked down my order and offered a resolution.";
    } else {
      if (agentTurnCount >= 3) {
        status = "escalated";
        frustrationLevel = "High";
        escalationRisk = "High";
        emotionalState = "Angry";
        nextCustomerMessage = "You aren't giving me any straight answers. Let me talk to your manager right now.";
        reasoning = "The agent keeps repeating generic answers without helping me track my order.";
      } else {
        nextCustomerMessage = "Can you actually tell me where my order is? I need it for a birthday party!";
      }
    }
  } 
  else if (scenarioId === 'refund_request') {
    if (agentLower.includes("exception") || agentLower.includes("one-time") || agentLower.includes("approved") || agentLower.includes("refund your money")) {
      status = "resolved";
      emotionalState = "Satisfied";
      sentiment = "Positive";
      nextCustomerMessage = "Thank you so much for making an exception! I appreciate your great service.";
      reasoning = "The agent approved my out-of-warranty refund as a one-time exception.";
    } else if (agentLower.includes("replace") || agentLower.includes("store credit") || agentLower.includes("discount") || agentLower.includes("diagnostic")) {
      status = "resolved";
      emotionalState = "Calm";
      sentiment = "Neutral";
      nextCustomerMessage = "Okay, a replacement/store credit is better than nothing. Let's do that.";
      reasoning = "Although I wanted a refund, the agent offered a replacement/credit which I accept.";
    } else {
      if (agentTurnCount >= 3) {
        status = "escalated";
        frustrationLevel = "High";
        escalationRisk = "High";
        emotionalState = "Angry";
        nextCustomerMessage = "This is ridiculous. It's only 15 days out of warranty! Put me in touch with a supervisor.";
        reasoning = "The agent is refusing to make any exception or offer credit.";
      } else {
        nextCustomerMessage = "I understand the 30-day policy, but this smart speaker is brand new and completely dead! Can you please check if we can make an exception?";
      }
    }
  }
  else if (scenarioId === 'product_troubleshoot') {
    if (agentLower.includes("reset") || agentLower.includes("power") || agentLower.includes("unplug") || agentLower.includes("factory") || agentLower.includes("router")) {
      if (agentTurnCount >= 2) {
        status = "resolved";
        emotionalState = "Satisfied";
        sentiment = "Positive";
        nextCustomerMessage = "Wow, that reset step actually worked! The light turned solid green and it's connected. Thank you!";
        reasoning = "The troubleshooting reset steps guided by the agent solved the issue.";
      } else {
        nextCustomerMessage = "Okay, I am holding the reset button down now. It's blinking yellow. What should I do next?";
        frustrationLevel = "Medium";
        emotionalState = "Confused";
      }
    } else {
      if (agentTurnCount >= 3) {
        status = "escalated";
        frustrationLevel = "High";
        escalationRisk = "High";
        emotionalState = "Angry";
        nextCustomerMessage = "I've already told you I tried basic steps. This is getting nowhere. Connect me to technical escalation.";
        reasoning = "The agent is just telling me generic steps that don't help.";
      } else {
        nextCustomerMessage = "I've tried unplugging it and it still blinks red. Are there any actual setup steps we can do?";
      }
    }
  }
  else if (scenarioId === 'billing_double_charge') {
    if (agentLower.includes("refund") || agentLower.includes("void") || agentLower.includes("reverse") || agentLower.includes("remove") || agentLower.includes("charge")) {
      status = "resolved";
      emotionalState = "Satisfied";
      sentiment = "Positive";
      nextCustomerMessage = "Thank you, I see the duplicate charge has been voided. Thanks for clearing this up.";
      reasoning = "The agent found the duplicate pending charge and reversed it immediately.";
    } else {
      if (agentTurnCount >= 3) {
        status = "escalated";
        frustrationLevel = "High";
        escalationRisk = "High";
        emotionalState = "Angry";
        nextCustomerMessage = "You aren't refunding my money! I am disputing this with my credit card company and want a supervisor.";
        reasoning = "The agent is not refunding my double charge.";
      } else {
        nextCustomerMessage = "Can you actually search my account for the double charge? It shows pending twice on my credit card.";
      }
    }
  }
  else if (scenarioId === 'account_lockout') {
    if (agentLower.includes("unlock") || agentLower.includes("reset") || agentLower.includes("temp") || agentLower.includes("password") || agentLower.includes("code") || agentLower.includes("verify")) {
      status = "resolved";
      emotionalState = "Relieved";
      sentiment = "Positive";
      nextCustomerMessage = "Oh thank goodness! I can log back in now. You saved my presentation, thank you so much!";
      reasoning = "The agent unlocked my account or bypassed the 2FA lockout in time.";
    } else {
      if (agentTurnCount >= 3) {
        status = "escalated";
        frustrationLevel = "High";
        escalationRisk = "High";
        emotionalState = "Panicked";
        nextCustomerMessage = "I am going to miss my presentation. Connect me to IT or a manager immediately.";
        reasoning = "The agent is not unlocking my account quick enough.";
      } else {
        nextCustomerMessage = "Please, my presentation is in 15 minutes now! Can you unlock it or send a temporary password?";
      }
    }
  }
  else {
    if (agentLower.includes("help") || agentLower.includes("resolve") || agentLower.includes("sorry") || agentLower.includes("understand")) {
      status = "resolved";
      emotionalState = "Satisfied";
      sentiment = "Positive";
      nextCustomerMessage = "Thank you, that resolves my issue.";
      reasoning = "The agent was polite and helpful.";
    } else {
      nextCustomerMessage = "I need some actual help with this issue. What can we do?";
    }
  }

  return {
    nextCustomerMessage,
    intent,
    sentiment,
    emotionalState,
    frustrationLevel,
    escalationRisk,
    status,
    reasoning
  };
}

function simulateCoachingTurnRuleBased(scenarioId: string, customerReplyText: string, kbContextText: string): any {
  let suggestedResponse = "";
  let coachingGuidance = "";

  if (customerReplyText.includes("manager") || customerReplyText.includes("supervisor") || customerReplyText.includes("escalated")) {
    suggestedResponse = "I completely understand your desire to speak with a supervisor. Let me grab a manager for you right now, and I will share all of our notes so they can resolve this instantly.";
    coachingGuidance = "The customer has requested escalation. Politely acknowledge their request and warm-transfer them to a supervisor/manager immediately.";
  } else if (customerReplyText.includes("Thank you") || customerReplyText.includes("worked") || customerReplyText.includes("resolves")) {
    suggestedResponse = "You are very welcome! I'm so glad we could get this resolved for you. Is there anything else I can help you with today?";
    coachingGuidance = "The issue has been successfully resolved. Politely close the interaction and ask if any additional assistance is needed.";
  } else {
    if (scenarioId === 'delayed_order') {
      suggestedResponse = "I understand you're anxious about the birthday gift arriving late, Sarah. Let me check the exact carrier status, and if it's delayed, I can issue a shipping refund or check for immediate local delivery options.";
      coachingGuidance = "Validate Sarah's anxiety about her child's birthday gift. Confirm the shipping status using standard policy rules.";
    } else if (scenarioId === 'refund_request') {
      suggestedResponse = "I understand your speaker is not charging, Marcus. While we have a strict 30-day refund limit, I want to help. Let's check if we can offer a warranty replacement or troubleshooting steps to fix it.";
      coachingGuidance = "Explain the 30-day refund boundary clearly but offer a helpful path like warranty repair or a replacement smart speaker.";
    } else if (scenarioId === 'product_troubleshoot') {
      suggestedResponse = "I hear your frustration, David, setup failures can be very annoying. Let's try performing a hardware factory reset: hold the reset pin for 15 seconds until the LED flashes orange.";
      coachingGuidance = "Empathetically recognize his 1-hour troubleshooting time. Guide him carefully through a full hardware reset of the hub.";
    } else if (scenarioId === 'billing_double_charge') {
      suggestedResponse = "I understand your concern about being duplicate charged, Elena. Let me look up your billing history. If there's a duplicate pending transaction, we will void and reverse it immediately.";
      coachingGuidance = "Reassure Elena that duplicate charges are usually temporary holds and will be voided. Investigate her account details.";
    } else if (scenarioId === 'account_lockout') {
      suggestedResponse = "I understand the extreme urgency with your presentation starting in 30 minutes, James. Let's get you unlocked. Can you confirm the secondary email address or phone number on your file?";
      coachingGuidance = "Act with high speed. Ask James for immediate verification details so you can reset his security lockout right away.";
    } else {
      suggestedResponse = "I understand your concern and would be glad to help look into this for you. Let's work together to resolve it step-by-step.";
      coachingGuidance = "Acknowledge the customer's emotions, maintain a warm professional tone, and offer a clear next step.";
    }
  }

  return {
    suggestedResponse,
    coachingGuidance
  };
}

// In-memory vector embedding store for RAG
const kbEmbeddings: { articleId: string; chunkId?: string; values: number[] }[] = [];

// Helper function to fetch embeddings with immediate semantic fallback
async function getEmbedding(text: string): Promise<number[]> {
  // If no Gemini API key is configured or quota cooldown is active, immediately return deterministic semantic vector
  if (!process.env.GEMINI_API_KEY || isQuotaExhausted()) {
    return generateSemanticFallbackVector(text);
  }

  const modelsToTry = ['gemini-embedding-2-preview', 'text-embedding-004'];

  for (const modelName of modelsToTry) {
    let timer: NodeJS.Timeout | null = null;
    try {
      // 2.5s timeout promise to prevent any hanging calls
      const embedPromise = ai.models.embedContent({
        model: modelName,
        contents: text,
      });

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Embedding request timed out')), 2500);
      });

      const response: any = await Promise.race([embedPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      
      if (response) {
        if (response.embedding && response.embedding.values) {
          return response.embedding.values;
        }
        if (response.embeddings) {
          if (Array.isArray(response.embeddings) && response.embeddings.length > 0) {
            const first = response.embeddings[0];
            if (first && first.values) return first.values;
          } else if (response.embeddings.values) {
            return response.embeddings.values;
          }
        }
        if (Array.isArray(response.values)) {
          return response.values;
        }
        for (const key of Object.keys(response)) {
          if (response[key] && Array.isArray(response[key].values)) {
            return response[key].values;
          }
        }
      }
    } catch {
      // Fall through to next model or fallback
    }
  }

  // Stable high-dimensional semantic vector fallback
  return generateSemanticFallbackVector(text);
}

// Build RAG Index on Startup (Instant vector indexing with high-dimensional embeddings)
async function buildRAGIndex() {
  try {
    // 1. Sync from SQLite if present
    const storedArticles = db.listKnowledgeArticles();
    if (storedArticles.length > 0) {
      for (const art of storedArticles) {
        const idx = KNOWLEDGE_BASE.findIndex(k => k.id === art.id);
        if (idx >= 0) {
          KNOWLEDGE_BASE[idx] = art;
        } else {
          KNOWLEDGE_BASE.push(art);
        }
      }
    } else {
      // Seed SQLite with INITIAL_KNOWLEDGE_BASE
      db.seedKnowledgeArticlesIfEmpty(INITIAL_KNOWLEDGE_BASE);
    }

    // 2. Vectorize all articles and chunks immediately
    activeVectorStore.length = 0;
    kbEmbeddings.length = 0;

    for (const article of KNOWLEDGE_BASE) {
      const chunks = chunkArticle(article);
      for (const chunk of chunks) {
        const vector = generateSemanticFallbackVector(chunk.content);
        activeVectorStore.push({
          id: chunk.chunkId,
          articleId: article.id,
          chunkId: chunk.chunkId,
          title: chunk.title,
          content: chunk.content,
          category: chunk.category,
          tags: chunk.tags || article.tags || [],
          vector,
          chunkType: chunk.chunkType
        });
        kbEmbeddings.push({ articleId: article.id, chunkId: chunk.chunkId, values: vector });
      }
    }
    console.log(`Successfully indexed ${KNOWLEDGE_BASE.length} articles (${activeVectorStore.length} chunks) in RAG vector store.`);

    // If Gemini key is available, optionally upgrade vectors in the background without blocking
    if (process.env.GEMINI_API_KEY) {
      setTimeout(async () => {
        try {
          for (let i = 0; i < Math.min(activeVectorStore.length, 10); i++) {
            const item = activeVectorStore[i];
            const liveVector = await getEmbedding(item.content);
            if (liveVector && liveVector.length > 0) {
              item.vector = liveVector;
              const kbIdx = kbEmbeddings.findIndex(e => e.chunkId === item.chunkId);
              if (kbIdx >= 0) kbEmbeddings[kbIdx].values = liveVector;
            }
          }
        } catch (e) {
          console.warn('Background Gemini vector enhancement skipped:', e);
        }
      }, 1000);
    }
  } catch (e) {
    console.error('Error building RAG vector index:', e);
  }
}

// RAG Search Retrieval Helper for internal agents and sessions
async function retrieveRelevantArticles(customerQuery: string): Promise<KBArticle[]> {
  try {
    const results = await performHybridRAGSearch(customerQuery, {
      topK: 3,
      minScore: 0.05,
      embeddingFunction: getEmbedding
    });
    if (results.length > 0) {
      return results.map(r => r.article);
    }
    return KNOWLEDGE_BASE.slice(0, 2);
  } catch (e) {
    console.error('retrieveRelevantArticles failed:', e);
    return KNOWLEDGE_BASE.slice(0, 2);
  }
}

// Knowledge Base Ingestion and Retrieval Endpoints
app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/knowledge/articles', (req, res) => {
  const articlesWithStats = KNOWLEDGE_BASE.map(a => ({
    ...a,
    chunkCount: chunkArticle(a).length
  }));
  res.json(articlesWithStats);
});

app.get('/api/knowledge/packs', (req, res) => {
  res.json(PRESET_KNOWLEDGE_PACKS);
});

app.get('/api/knowledge/search', async (req, res) => {
  const query = (req.query.q as string) || '';
  const category = (req.query.category as string) || undefined;
  const topK = parseInt((req.query.limit as string) || '5', 10);

  if (!query.trim()) {
    return res.json(KNOWLEDGE_BASE.map(a => ({
      article: a,
      score: 1.0,
      semanticSimilarity: 1.0,
      keywordScore: 1.0,
      matchedChunks: chunkArticle(a),
      retrievalReason: 'Browsing all active policies.'
    })));
  }

  try {
    const results = await performHybridRAGSearch(query, {
      topK,
      category,
      minScore: 0.05,
      embeddingFunction: getEmbedding
    });
    return res.json(results);
  } catch (err: any) {
    console.error('Knowledge Search RAG failed:', err);
    return res.status(500).json({ error: 'RAG Search failed' });
  }
});

app.post('/api/knowledge/test-rag', async (req, res) => {
  try {
    const { query, category } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string is required' });
    }
    const results = await performHybridRAGSearch(query, {
      topK: 4,
      category,
      minScore: 0.01,
      embeddingFunction: getEmbedding
    });

    const totalChunks = activeVectorStore.length;
    return res.json({
      query,
      totalIndexedArticles: KNOWLEDGE_BASE.length,
      totalIndexedChunks: totalChunks,
      matches: results
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Test RAG failed' });
  }
});

app.post('/api/knowledge/ingest', async (req, res) => {
  try {
    const { 
      title, 
      category, 
      content, 
      steps, 
      tags, 
      applicableProducts, 
      authorityLevel, 
      maxCompensation,
      sourceDoc 
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const newId = `KB-${(category ? category.slice(0, 3).toUpperCase() : 'GEN')}-${Date.now().toString().slice(-4)}`;
    
    // Parse steps if string
    let parsedSteps: string[] = [];
    if (Array.isArray(steps)) {
      parsedSteps = steps.filter(Boolean);
    } else if (typeof steps === 'string') {
      parsedSteps = steps.split('\n').map(s => s.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean);
    }

    if (parsedSteps.length === 0) {
      parsedSteps = [
        'Verify customer identity and context',
        'Review and apply authorized policy rules',
        'Provide transparent explanation and resolution options'
      ];
    }

    // Parse tags if string
    let parsedTags: string[] = [];
    if (Array.isArray(tags)) {
      parsedTags = tags;
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    if (parsedTags.length === 0) {
      parsedTags = [category || 'general', 'support', 'policy'];
    }

    const newArticle: KBArticle = {
      id: newId,
      title: title.trim(),
      category: category ? category.trim().toLowerCase().replace(/\s+/g, '_') : 'general_support',
      content: content.trim(),
      steps: parsedSteps,
      tags: parsedTags,
      applicableProducts: Array.isArray(applicableProducts) ? applicableProducts : ['All Products'],
      authorityLevel: authorityLevel || 'Tier 1 Frontline Support',
      maxCompensation: maxCompensation || undefined,
      lastUpdated: new Date().toISOString().split('T')[0],
      sourceDoc: sourceDoc || `${newId.toLowerCase()}.md`
    };

    // Save to SQLite
    db.saveKnowledgeArticle(newArticle);

    // Ingest into active in-memory knowledge base
    ingestDocument(newArticle);

    // Chunk and index in vector store
    const chunks = chunkArticle(newArticle);
    for (const chunk of chunks) {
      const vector = await getEmbedding(chunk.content);
      activeVectorStore.push({
        id: chunk.chunkId,
        articleId: newArticle.id,
        chunkId: chunk.chunkId,
        title: chunk.title,
        content: chunk.content,
        category: chunk.category,
        tags: chunk.tags || newArticle.tags || [],
        vector,
        chunkType: chunk.chunkType
      });
      kbEmbeddings.push({ articleId: newArticle.id, chunkId: chunk.chunkId, values: vector });
    }

    return res.json({ 
      success: true, 
      article: newArticle, 
      chunksIndexed: chunks.length,
      totalArticles: KNOWLEDGE_BASE.length,
      totalChunks: activeVectorStore.length,
      message: `Knowledge base document "${newArticle.title}" successfully ingested, chunked (${chunks.length} chunks), and indexed into RAG vector store.` 
    });
  } catch (err: any) {
    console.error('KB Ingestion failed:', err);
    return res.status(500).json({ error: 'Failed to ingest knowledge document: ' + err.message });
  }
});

app.post('/api/knowledge/load-pack', async (req, res) => {
  try {
    const { packId } = req.body;
    const pack = PRESET_KNOWLEDGE_PACKS.find(p => p.id === packId);
    if (!pack) {
      return res.status(404).json({ error: 'Preset knowledge pack not found' });
    }

    let addedCount = 0;
    for (const art of pack.articles) {
      db.saveKnowledgeArticle(art);
      ingestDocument(art);
      const chunks = chunkArticle(art);
      for (const chunk of chunks) {
        if (!activeVectorStore.some(v => v.chunkId === chunk.chunkId)) {
          const vector = await getEmbedding(chunk.content);
          activeVectorStore.push({
            id: chunk.chunkId,
            articleId: art.id,
            chunkId: chunk.chunkId,
            title: chunk.title,
            content: chunk.content,
            category: chunk.category,
            tags: chunk.tags || art.tags || [],
            vector,
            chunkType: chunk.chunkType
          });
          kbEmbeddings.push({ articleId: art.id, chunkId: chunk.chunkId, values: vector });
        }
      }
      addedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully loaded knowledge pack "${pack.name}" (${addedCount} articles).`,
      totalArticles: KNOWLEDGE_BASE.length,
      totalChunks: activeVectorStore.length
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load knowledge pack: ' + err.message });
  }
});

app.delete('/api/knowledge/articles/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteDocument(id);
  db.deleteKnowledgeArticle(id);

  // Remove from activeVectorStore & kbEmbeddings
  for (let i = activeVectorStore.length - 1; i >= 0; i--) {
    if (activeVectorStore[i].articleId === id) {
      activeVectorStore.splice(i, 1);
    }
  }
  for (let i = kbEmbeddings.length - 1; i >= 0; i--) {
    if (kbEmbeddings[i].articleId === id) {
      kbEmbeddings.splice(i, 1);
    }
  }

  return res.json({ success: true, message: `Article ${id} deleted from RAG index.` });
});

app.post('/api/knowledge/reset', async (req, res) => {
  try {
    resetKnowledgeBaseToDefault();
    for (const art of INITIAL_KNOWLEDGE_BASE) {
      db.saveKnowledgeArticle(art);
    }
    await buildRAGIndex();
    return res.json({ 
      success: true, 
      message: 'Knowledge base reset to official enterprise dataset.',
      totalArticles: KNOWLEDGE_BASE.length,
      totalChunks: activeVectorStore.length 
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset knowledge base: ' + err.message });
  }
});

// Dedicated endpoint for Intent & Sentiment Analysis Agent
app.post('/api/agents/intent-sentiment', async (req, res) => {
  try {
    const { currentMessage, history = [], sessionInfo = {} } = req.body;
    if (!currentMessage || typeof currentMessage !== 'string') {
      return res.status(400).json({ error: 'currentMessage string is required' });
    }
    const result = await analyzeIntentAndSentiment({
      currentMessage,
      history,
      sessionInfo
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Intent & Sentiment Analysis Agent execution error:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// Dedicated endpoint for Knowledge Recommendation Agent
app.post('/api/agents/knowledge-recommendations', async (req, res) => {
  try {
    const { currentMessage, history = [], intent, product, sessionInfo = {} } = req.body;
    if (!currentMessage || typeof currentMessage !== 'string') {
      return res.status(400).json({ error: 'currentMessage string is required' });
    }
    const result = await getKnowledgeRecommendations({
      currentMessage,
      history,
      intent,
      product,
      sessionInfo
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Knowledge Recommendation Agent execution error:', err);
    return res.status(500).json({ error: err.message || 'Knowledge recommendation search failed' });
  }
});

// Dedicated endpoint for Coaching & Response Suggestion Agent
app.post('/api/agents/coaching-suggestions', async (req, res) => {
  try {
    const { currentMessage, history = [], intent, sentiment, emotionalState, frustrationLevel, frustrationScore, satisfactionTrend, knowledgeRecommendations = [], product, sessionInfo = {} } = req.body;
    if (!currentMessage || typeof currentMessage !== 'string') {
      return res.status(400).json({ error: 'currentMessage string is required' });
    }
    const result = await getCoachingAndSuggestions({
      currentMessage,
      history,
      intent,
      sentiment,
      emotionalState,
      frustrationLevel,
      frustrationScore,
      satisfactionTrend,
      knowledgeRecommendations,
      product,
      sessionInfo
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Coaching & Response Suggestion Agent execution error:', err);
    return res.status(500).json({ error: err.message || 'Coaching generation failed' });
  }
});

// Build standard list of scenarios endpoint
app.get('/api/scenarios', (req, res) => {
  res.json(SCENARIOS);
});

// Create session and generate opening customer message
app.post('/api/simulation/start', async (req, res) => {
  const { scenarioId, difficulty, sentiment } = req.body;

  let selectedScenario: Scenario | undefined;
  if (scenarioId && scenarioId !== 'any') {
    selectedScenario = SCENARIOS.find(s => s.id === scenarioId);
  } else {
    const matchesDifficulty = (sc: Scenario, lvl: string) => {
      if (!lvl || lvl === 'Any' || lvl === 'All') return true;
      return sc.difficulty.toLowerCase() === lvl.toLowerCase();
    };

    const matchesSentiment = (sc: Scenario, mood: string) => {
      if (!mood || mood === 'Any' || mood === 'All') return true;
      return sc.initialMood.toLowerCase().includes(mood.toLowerCase());
    };

    const candidates = SCENARIOS.filter(sc => matchesDifficulty(sc, difficulty) && matchesSentiment(sc, sentiment));
    if (candidates.length > 0) {
      selectedScenario = candidates[Math.floor(Math.random() * candidates.length)];
    } else {
      selectedScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    }
  }

  if (!selectedScenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  const scenario = selectedScenario;
  const finalDifficulty = (difficulty && difficulty !== 'Any' && difficulty !== 'All') ? difficulty : scenario.difficulty;
  const finalMood = (sentiment && sentiment !== 'Any' && sentiment !== 'All') ? sentiment : scenario.initialMood;
  const sessionMode: 'simulator' | 'manual' | 'replay' = req.body.mode || 'simulator';

  try {
    const session = await db.createSession(scenario.id, sessionMode);

    // Generate or use initial message
    let firstMessageText = req.body.customGreeting || "";
    if (!firstMessageText) {
      firstMessageText = await generateCustomerInitialMessage(scenario, finalMood, finalDifficulty);
    }

    // 1. Run Intent, Knowledge, RAG, and Escalation Risk Agents in parallel for instant session start
    const sessionInfoObj = {
      scenarioName: scenario.name,
      scenarioDescription: scenario.description,
      customerName: scenario.customerProfile.name,
      persona: finalMood
    };

    const [
      intentSentimentAnalysis,
      knowledgeRecs,
      relevantArticles,
      escalationRiskOutput
    ] = await Promise.all([
      analyzeIntentAndSentiment({
        currentMessage: firstMessageText,
        history: [],
        sessionInfo: sessionInfoObj
      }),
      getKnowledgeRecommendations({
        currentMessage: firstMessageText,
        history: [],
        sessionInfo: sessionInfoObj
      }),
      retrieveRelevantArticles(firstMessageText),
      getEscalationRisk({
        currentMessage: firstMessageText,
        history: [],
        sessionInfo: sessionInfoObj
      })
    ]);

    const frustLevel: 'Low' | 'Medium' | 'High' = 
      intentSentimentAnalysis.frustration_score > 70 ? 'High' :
      intentSentimentAnalysis.frustration_score > 35 ? 'Medium' : 'Low';

    // 2. Coaching & Response Suggestion Agent with gathered context
    const coachingSuggestions = await getCoachingAndSuggestions({
      currentMessage: firstMessageText,
      history: [],
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      sessionInfo: sessionInfoObj
    });

    // Store opening customer message with all 4 agent outputs
    const initialCustomerMessage = db.addMessage({
      sessionId: session.id,
      sender: 'customer',
      text: firstMessageText,
      intent: intentSentimentAnalysis.intent || scenario.name,
      sentiment: intentSentimentAnalysis.sentiment || 'Negative',
      emotionalState: intentSentimentAnalysis.emotion || finalMood,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      escalationRisk: escalationRiskOutput.risk_level === 'Critical' ? 'High' : escalationRiskOutput.risk_level === 'High' ? 'High' : escalationRiskOutput.risk_level === 'Medium' ? 'Medium' : 'Low',
      reasoningDetails: intentSentimentAnalysis.reasoning,
      coachingGuidance: coachingSuggestions.coaching_tips.slice(0, 2).join(' ') || 'Acknowledge customer feelings and offer clear support.',
      responseSuggestion: coachingSuggestions.suggested_response,
      relevantKnowledge: relevantArticles.map(a => a.title),
      relevantArticles: relevantArticles,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingOutput: coachingSuggestions,
      escalationRiskOutput: escalationRiskOutput
    });

    return res.json({
      session,
      initialMessage: initialCustomerMessage,
      message: initialCustomerMessage,
      customerMessage: initialCustomerMessage,
      intentSentimentAnalysis,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingSuggestions,
      escalationRiskOutput
    });
  } catch (err: any) {
    console.error('Failed to start simulation:', err);
    return res.status(500).json({ error: 'Failed to initialize simulation session: ' + err.message });
  }
});

// Simulator helper functions with embedded try-catch and offline fallback capabilities
const SIMULATOR_SYSTEM_PROMPT = `
You are the "Customer Simulator Agent" in the Vidzai AI Customer Support Training Platform.
You are roleplaying realistically as a human customer chatting with a customer support representative via live text. You are NOT an AI assistant.

[1. CORE IDENTITY & PARAMETERS]
- Customer Persona: {persona}
- Simulation Difficulty: {difficulty}
- Current Emotional State: {emotion_state}
- Support Topic / Problem: {topic}

[2. BEHAVIORAL & PSYCHOLOGICAL DYNAMICS]
- Stay strictly in character as a human customer.
- Type in natural, conversational sentences (1-3 sentences max).
- If the representative requests verification details (email, order number, device model), provide realistic details (e.g. Order #ORD-9821, email sarah.j@email.com).
- Emotional Progression:
  * When the agent shows genuine empathy, validates your frustration, and takes concrete resolution action (such as issuing a refund, voiding a double charge, running diagnostic steps, or initiating an express courier trace), your frustration decreases, emotional state transitions towards "Relieved" / "Satisfied", and you accept the resolution.
  * When the agent repeats generic canned phrases, ignores your frustration, or gives unhelpful generic answers, your frustration score rises, and you demand a supervisor or threaten cancellation.

[3. RESOLUTION RULES]
- When the agent successfully addresses your core issue and takes concrete action, acknowledge the resolution with relief and set "is_resolved": true.
- Return ONLY valid JSON.

CONVERSATION SO FAR:
{conversation_history}

OUTPUT SCHEMA:
{
  "message": "Your next response as the customer",
  "persona": "{persona}",
  "emotion_state": "{emotion_state}",
  "is_resolved": false,
  "satisfaction_level": 3
}
`.trim();

function build_simulator_prompt(
  persona: string,
  difficulty: string,
  topic: string,
  emotion_state: string,
  conversation_history: string
): [string, string] {
  const sys = SIMULATOR_SYSTEM_PROMPT
    .replace('{persona}', persona)
    .replace('{difficulty}', difficulty)
    .replace('{emotion_state}', emotion_state)
    .replace('{topic}', topic)
    .replace('{conversation_history}', conversation_history || "No messages yet. Start the conversation.");

  const user = `Generate the next customer message. Persona: ${persona}. Difficulty: ${difficulty}. Scenario: ${topic}. Current emotion: ${emotion_state}.`;
  return [sys, user];
}

async function simulateCustomerTurn(scenario: Scenario, historyText: string, agentMessage: string, history: Message[]): Promise<any> {
  const persona = scenario.customerProfile.persona || scenario.initialMood || 'calm';
  const difficulty = scenario.difficulty || 'Medium';
  const topic = scenario.name;
  const emotionState = scenario.initialMood || 'concerned';

  const [sysPrompt, userPrompt] = build_simulator_prompt(persona, difficulty, topic, emotionState, historyText);
  const fullPrompt = `${sysPrompt}\n\n${userPrompt}`;

  if (!process.env.GEMINI_API_KEY || isQuotaExhausted()) {
    return simulateTurnRuleBased(scenario.id, agentMessage, history);
  }

  try {
    const simResponse = await generateContentWithFallback({
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            persona: { type: Type.STRING },
            emotion_state: { type: Type.STRING },
            is_resolved: { type: Type.BOOLEAN },
            satisfaction_level: { type: Type.NUMBER }
          },
          required: ['message', 'is_resolved', 'emotion_state']
        }
      }
    });

    if (simResponse.text) {
      const parsed = JSON.parse(simResponse.text);
      const isResolved = Boolean(parsed.is_resolved);
      const isEscalated = (parsed.emotion_state || '').toLowerCase() === 'angry' && !isResolved;

      return {
        nextCustomerMessage: parsed.message || (isResolved ? "Thank you so much, that solved my issue!" : "Could you please help me with this?"),
        intent: isResolved ? "Declaring Resolution" : "Seeking Assistance",
        sentiment: isResolved ? "Positive" : parsed.emotion_state === 'angry' ? "Negative" : "Neutral",
        emotionalState: parsed.emotion_state || (isResolved ? "Satisfied" : "Concerned"),
        frustrationLevel: parsed.emotion_state === 'angry' ? "High" : isResolved ? "Low" : "Medium",
        escalationRisk: isEscalated ? "High" : "Low",
        status: isResolved ? "resolved" : isEscalated ? "escalated" : "active",
        reasoning: `Customer evaluated response: is_resolved=${isResolved}, emotion_state=${parsed.emotion_state}.`
      };
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.info(`Customer turn simulation using local rule-based engine: ${errMsg.slice(0, 80)}`);
    return simulateTurnRuleBased(scenario.id, agentMessage, history);
  }

  return simulateTurnRuleBased(scenario.id, agentMessage, history);
}

async function generateCoachingTurn(scenario: Scenario, customerReplyText: string, parsedSim: any, kbContextText: string, historyText: string): Promise<any> {
  const coachingPrompt = `
    You are an expert customer support coach. Analyze the customer's response and current emotional state, and provide actionable tips and a professional response suggestion for the Support Agent.

    Scenario: ${scenario.name}
    Customer message: "${customerReplyText}"
    Customer Emotional State: ${parsedSim.emotionalState}
    Customer Frustration Level: ${parsedSim.frustrationLevel}
    Customer Escalation Risk: ${parsedSim.escalationRisk}

    Knowledge Base policies:
    ${kbContextText}

    Conversation history:
    ${historyText}
    Customer: ${customerReplyText}

    Generate:
    1. A professional, highly empathetic suggested response. Keep it concise, natural, and helpful.
    2. Clear, short coaching guidance (1-2 sentences) on how the agent should proceed (e.g. focus on refund steps, acknowledge anger, etc.).

    Return a JSON object structured exactly like this:
    {
      "suggestedResponse": "the text reply suggested for the agent",
      "coachingGuidance": "actionable tip for the agent"
    }
  `;

  if (!process.env.GEMINI_API_KEY || isQuotaExhausted()) {
    return simulateCoachingTurnRuleBased(scenario.id, customerReplyText, kbContextText);
  }

  try {
    const coachingRes = await generateContentWithFallback({
      contents: coachingPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedResponse: { type: Type.STRING },
            coachingGuidance: { type: Type.STRING }
          },
          required: ['suggestedResponse', 'coachingGuidance']
        }
      }
    });
    return JSON.parse(coachingRes.text || '{}');
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.info(`Coaching turn generation using local fallback: ${errMsg.slice(0, 80)}`);
    return simulateCoachingTurnRuleBased(scenario.id, customerReplyText, kbContextText);
  }
}

// Process Support Agent message and generate next Customer message + Analysis
app.post('/api/simulation/message', async (req, res) => {
  const { sessionId, messageText } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const scenario = SCENARIOS.find(s => s.id === session.scenarioId) || SCENARIOS[0];
  const history = db.getMessagesForSession(sessionId);

  try {
    // 1. Add Support Agent message to database
    const agentMsg = db.addMessage({
      sessionId,
      sender: 'agent',
      text: messageText
    });

    // 2. Format history for simulator prompt
    const historyText = history.map(m => `${m.sender === 'customer' ? 'Customer' : 'Support Agent'}: ${m.text}`).join('\n') + `\nSupport Agent: ${messageText}`;

    // 3. Run Gemini simulation logic (uses local fallback if offline/no key)
    const parsedSim = await simulateCustomerTurn(scenario, historyText, messageText, history);
    const status = parsedSim.status as 'active' | 'resolved' | 'escalated';
    let customerReplyText = parsedSim.nextCustomerMessage;

    if (status === 'resolved' && !customerReplyText) {
      customerReplyText = "Thank you so much! That completely solves my problem. I appreciate your prompt help.";
    } else if (status === 'escalated' && !customerReplyText) {
      customerReplyText = "This is not acceptable. I would like to speak with a supervisor or manager immediately.";
    }

    // Update session status in DB
    db.updateSessionStatus(sessionId, status, parsedSim.reasoning);

    const updatedHistory = [...history, agentMsg];

    // 4. Run Intent, Knowledge, and Escalation Risk Agents in parallel for fast turn execution
    const historyMapped = updatedHistory.map(m => ({ sender: m.sender, text: m.text }));
    const sessionInfoObj = {
      scenarioName: scenario.name,
      scenarioDescription: scenario.description,
      customerName: scenario.customerProfile.name,
      persona: scenario.initialMood
    };

    const [
      intentSentimentAnalysis,
      knowledgeRecs,
      relevantArticles,
      escalationRiskOutput
    ] = await Promise.all([
      analyzeIntentAndSentiment({
        currentMessage: customerReplyText,
        history: historyMapped,
        sessionInfo: sessionInfoObj
      }),
      getKnowledgeRecommendations({
        currentMessage: customerReplyText,
        history: historyMapped,
        sessionInfo: sessionInfoObj
      }),
      retrieveRelevantArticles(customerReplyText),
      getEscalationRisk({
        currentMessage: customerReplyText,
        history: historyMapped,
        sessionInfo: sessionInfoObj
      })
    ]);

    const frustLevel: 'Low' | 'Medium' | 'High' = 
      intentSentimentAnalysis.frustration_score > 70 ? 'High' :
      intentSentimentAnalysis.frustration_score > 35 ? 'Medium' : 'Low';

    // 5. Execute Coaching & Response Suggestion Agent with gathered context
    const coachingSuggestions = await getCoachingAndSuggestions({
      currentMessage: customerReplyText,
      history: historyMapped,
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      sessionInfo: sessionInfoObj
    });

    // 8. Save customer message with all agent outputs
    const customerMsg = db.addMessage({
      sessionId,
      sender: 'customer',
      text: customerReplyText,
      intent: intentSentimentAnalysis.intent || parsedSim.intent,
      sentiment: intentSentimentAnalysis.sentiment || parsedSim.sentiment,
      emotionalState: intentSentimentAnalysis.emotion || parsedSim.emotionalState,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      escalationRisk: escalationRiskOutput.risk_level === 'Critical' ? 'High' : escalationRiskOutput.risk_level === 'High' ? 'High' : escalationRiskOutput.risk_level === 'Medium' ? 'Medium' : 'Low',
      reasoningDetails: intentSentimentAnalysis.reasoning,
      coachingGuidance: coachingSuggestions.coaching_tips.slice(0, 2).join(' '),
      responseSuggestion: coachingSuggestions.suggested_response,
      relevantKnowledge: relevantArticles.map(a => a.title),
      relevantArticles: relevantArticles,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingOutput: coachingSuggestions,
      escalationRiskOutput: escalationRiskOutput
    });

    return res.json({
      agentMessage: agentMsg,
      customerMessage: customerMsg,
      sessionStatus: status,
      reasoning: parsedSim.reasoning,
      intentSentimentAnalysis,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingSuggestions,
      escalationRiskOutput
    });
  } catch (err: any) {
    console.error('Failed to process message turn:', err);
    return res.status(500).json({ error: 'Failed to process message turn: ' + err.message });
  }
});

// Manual Mode: Representative manually sends a customer message or an agent reply
app.post('/api/sessions/:sessionId/manual-message', async (req, res) => {
  const { sessionId } = req.params;
  const { sender, text } = req.body; // sender: 'customer' | 'agent'
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const scenario = SCENARIOS.find(s => s.id === session.scenarioId) || SCENARIOS[0];
  const history = db.getMessagesForSession(sessionId);

  try {
    if (sender === 'agent') {
      const agentMsg = db.addMessage({
        sessionId,
        sender: 'agent',
        text
      });
      return res.json({ message: agentMsg });
    }

    // Sender is customer -> run full 4-agent analysis pipeline
    const historyForAgents = history.map(m => ({ sender: m.sender, text: m.text }));
    const replaySessionInfo = {
      scenarioName: scenario.name,
      scenarioDescription: scenario.description,
      customerName: scenario.customerProfile.name
    };

    const [
      intentSentimentAnalysis,
      knowledgeRecs,
      relevantArticles,
      escalationRiskOutput
    ] = await Promise.all([
      analyzeIntentAndSentiment({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      }),
      getKnowledgeRecommendations({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      }),
      retrieveRelevantArticles(text),
      getEscalationRisk({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      })
    ]);

    const frustLevel: 'Low' | 'Medium' | 'High' = 
      intentSentimentAnalysis.frustration_score > 70 ? 'High' :
      intentSentimentAnalysis.frustration_score > 35 ? 'Medium' : 'Low';

    const coachingSuggestions = await getCoachingAndSuggestions({
      currentMessage: text,
      history: historyForAgents,
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      sessionInfo: replaySessionInfo
    });

    const customerMsg = db.addMessage({
      sessionId,
      sender: 'customer',
      text,
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      escalationRisk: escalationRiskOutput.risk_level === 'Critical' ? 'High' : escalationRiskOutput.risk_level === 'High' ? 'High' : escalationRiskOutput.risk_level === 'Medium' ? 'Medium' : 'Low',
      reasoningDetails: intentSentimentAnalysis.reasoning,
      coachingGuidance: coachingSuggestions.coaching_tips.slice(0, 2).join(' '),
      responseSuggestion: coachingSuggestions.suggested_response,
      relevantKnowledge: relevantArticles.map(a => a.title),
      relevantArticles: relevantArticles,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingOutput: coachingSuggestions,
      escalationRiskOutput: escalationRiskOutput
    });

    return res.json({
      message: customerMsg,
      intentSentimentAnalysis,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingSuggestions,
      escalationRiskOutput
    });
  } catch (err: any) {
    console.error("Failed to process manual customer message:", err);
    return res.status(500).json({ error: "Failed to process manual message: " + err.message });
  }
});

// Replay Mode: Process single turn from transcript
app.post('/api/sessions/:sessionId/replay-turn', async (req, res) => {
  const { sessionId } = req.params;
  const { sender, text } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const scenario = SCENARIOS.find(s => s.id === session.scenarioId) || SCENARIOS[0];
  const history = db.getMessagesForSession(sessionId);

  try {
    if (sender === 'agent') {
      const agentMsg = db.addMessage({
        sessionId,
        sender: 'agent',
        text
      });
      return res.json({ 
        message: agentMsg,
        agentMessage: agentMsg,
        customerMessage: agentMsg
      });
    }

    const historyForAgents = history.map(m => ({ sender: m.sender, text: m.text }));
    const replaySessionInfo = {
      scenarioName: scenario.name,
      scenarioDescription: scenario.description,
      customerName: scenario.customerProfile.name
    };

    const [
      intentSentimentAnalysis,
      knowledgeRecs,
      relevantArticles,
      escalationRiskOutput
    ] = await Promise.all([
      analyzeIntentAndSentiment({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      }),
      getKnowledgeRecommendations({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      }),
      retrieveRelevantArticles(text),
      getEscalationRisk({
        currentMessage: text,
        history: historyForAgents,
        sessionInfo: replaySessionInfo
      })
    ]);

    const frustLevel: 'Low' | 'Medium' | 'High' = 
      intentSentimentAnalysis.frustration_score > 70 ? 'High' :
      intentSentimentAnalysis.frustration_score > 35 ? 'Medium' : 'Low';

    const coachingSuggestions = await getCoachingAndSuggestions({
      currentMessage: text,
      history: historyForAgents,
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      sessionInfo: replaySessionInfo
    });

    const customerMsg = db.addMessage({
      sessionId,
      sender: 'customer',
      text,
      intent: intentSentimentAnalysis.intent,
      sentiment: intentSentimentAnalysis.sentiment,
      emotionalState: intentSentimentAnalysis.emotion,
      frustrationLevel: frustLevel,
      frustrationScore: intentSentimentAnalysis.frustration_score,
      satisfactionTrend: intentSentimentAnalysis.satisfaction_trend,
      escalationRisk: escalationRiskOutput.risk_level === 'Critical' ? 'High' : escalationRiskOutput.risk_level === 'High' ? 'High' : escalationRiskOutput.risk_level === 'Medium' ? 'Medium' : 'Low',
      reasoningDetails: intentSentimentAnalysis.reasoning,
      coachingGuidance: coachingSuggestions.coaching_tips.slice(0, 2).join(' '),
      responseSuggestion: coachingSuggestions.suggested_response,
      relevantKnowledge: relevantArticles.map(a => a.title),
      relevantArticles: relevantArticles,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingOutput: coachingSuggestions,
      escalationRiskOutput: escalationRiskOutput
    });

    return res.json({
      message: customerMsg,
      customerMessage: customerMsg,
      agentMessage: customerMsg,
      intentSentimentAnalysis,
      knowledgeRecommendations: knowledgeRecs.knowledge_recommendations,
      coachingSuggestions,
      escalationRiskOutput
    });
  } catch (err: any) {
    console.error("Failed to process replay turn:", err);
    return res.status(500).json({ error: "Failed to process replay turn: " + err.message });
  }
});


// End session and trigger Post-Interaction Summary Agent
app.post('/api/sessions/:sessionId/end', async (req, res) => {
  const { sessionId } = req.params;
  const { status = 'resolved', summary = '' } = req.body;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const updatedSession = db.updateSessionStatus(sessionId, status as 'resolved' | 'escalated', summary);
    const scenario = SCENARIOS.find(s => s.id === session.scenarioId) || SCENARIOS[0];
    const messages = db.getMessagesForSession(sessionId);

    const report = await generatePostInteractionReport(
      sessionId,
      scenario,
      messages,
      status as 'resolved' | 'escalated'
    );

    db.savePostReport(sessionId, report);

    return res.json({ session: updatedSession, report });
  } catch (err: any) {
    console.error("Failed to end session and generate post-interaction report:", err);
    return res.status(500).json({ error: "Failed to generate report: " + err.message });
  }
});

// Fetch post-interaction report for a session
app.get('/api/sessions/:sessionId/post-report', async (req, res) => {
  const { sessionId } = req.params;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    let report = db.getPostReport(sessionId);
    if (!report) {
      const scenario = SCENARIOS.find(s => s.id === session.scenarioId) || SCENARIOS[0];
      const messages = db.getMessagesForSession(sessionId);
      report = await generatePostInteractionReport(
        sessionId,
        scenario,
        messages,
        session.status === 'active' ? 'resolved' : session.status
      );
      db.savePostReport(sessionId, report);
    }
    return res.json(report);
  } catch (err: any) {
    console.error("Failed to fetch post-interaction report:", err);
    return res.status(500).json({ error: "Failed to fetch report: " + err.message });
  }
});

// Get Performance Analytics Dashboard Data
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = db.getPerformanceAnalytics();
    return res.json(analytics);
  } catch (err: any) {
    console.error("Failed to fetch performance analytics:", err);
    return res.status(500).json({ error: "Failed to fetch analytics: " + err.message });
  }
});

// Retrieve message log for session
app.get('/api/simulation/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = db.getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const messages = db.getMessagesForSession(sessionId);
  return res.json({ session, messages });
});

// Get session history list
app.get('/api/history', (req, res) => {
  const sessions = db.listSessions();
  const enhanced = sessions.map(s => {
    const scenario = SCENARIOS.find(sc => sc.id === s.scenarioId);
    const messages = db.getMessagesForSession(s.id);
    return {
      ...s,
      scenarioName: scenario?.name || s.scenarioId,
      customerName: scenario?.customerProfile?.name || 'Customer',
      messageCount: messages.length
    };
  });
  return res.json(enhanced);
});

// Delete specific session history item
app.delete('/api/history/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const deleted = db.deleteSession(sessionId);
  if (!deleted) {
    return res.status(404).json({ error: 'Session not found' });
  }
  return res.json({ success: true, message: 'Session deleted successfully' });
});

// Clear all simulation session history
app.delete('/api/history', (req, res) => {
  db.clearAll();
  return res.json({ success: true, message: 'All history cleared successfully' });
});

// SQL Database Info and Stats
app.get('/api/db/stats', (req, res) => {
  try {
    const stats = db.getDatabaseStats();
    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch database stats: ' + err.message });
  }
});

// Export SQLite database file directly
app.get('/api/db/export', (req, res) => {
  try {
    const buffer = db.exportSqliteBuffer();
    if (!buffer) {
      return res.status(500).json({ error: 'Database buffer unavailable' });
    }
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', 'attachment; filename="resolve_ai.sqlite"');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to export SQLite database: ' + err.message });
  }
});

// Serve Vite dev server or production build files
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  // Launch Python backend process using .venv or system python
  try {
    const candidates = [
      path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
      path.join(process.cwd(), '.venv', 'bin', 'python'),
      path.join(process.cwd(), '..', '.venv', 'Scripts', 'python.exe'),
      path.join(process.cwd(), '..', '.venv', 'bin', 'python'),
      process.platform === 'win32' ? 'python' : 'python3',
      'python',
      'python3'
    ];

    let pythonCmd = 'python3';
    for (const cand of candidates) {
      if (cand.includes(path.sep) && fs.existsSync(cand)) {
        pythonCmd = cand;
        break;
      }
    }

    const pythonScript = path.join(process.cwd(), 'backend', 'server.py');
    if (fs.existsSync(pythonScript)) {
      const pythonProc = spawn(pythonCmd, [pythonScript, '5005'], {
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      pythonProc.stdout?.on('data', (data) => {
        console.log(`[Python Backend] ${data.toString().trim()}`);
      });

      pythonProc.stderr?.on('data', (data) => {
        const errStr = data.toString().trim();
        if (!errStr.includes('not found') && !errStr.includes('No such file') && !errStr.includes('Python was not found')) {
          console.error(`[Python Backend Error] ${errStr}`);
        }
      });

      pythonProc.on('error', (err) => {
        console.log('[Python Backend] Standalone Python process note:', err.message);
      });
    }
  } catch (err: any) {
    console.log('[Python Backend] Python initialization skipped:', err.message);
  }

  // Build RAG embeddings index on server startup
  await buildRAGIndex();

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('.', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('.', 'dist', 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('ResolveAI server successfully listening on http://0.0.0.0:3000');
  });
}

start();
