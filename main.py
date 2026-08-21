import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from orchestrator.graph import run_support_turn, support_graph
from orchestrator.nodes.summary_node import post_summary_node
from orchestrator.simulator import SCENARIOS, simulate_customer_reply
from orchestrator.db import db_store
from orchestrator.kb import KNOWLEDGE_BASE
from orchestrator.state import SupportGraphState

load_dotenv()

app = FastAPI(
    title="Customer Support Multi-Agent AI Platform (Python)",
    description="Full-stack Customer Support Intelligence & Coaching platform built 100% in Python with LangGraph and FastAPI.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class CreateSessionRequest(BaseModel):
    scenarioId: str
    mode: Optional[str] = "simulator"

class SendMessageRequest(BaseModel):
    text: str
    sender: Optional[str] = "agent"

class EndSessionRequest(BaseModel):
    status: Optional[str] = "resolved"

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "runtime": "Python 3.10+",
        "orchestration": "LangGraph Multi-Agent Graph",
        "database": "SQLite (Python Store)",
        "gemini_active": bool(os.environ.get("GEMINI_API_KEY"))
    }

@app.get("/api/scenarios")
async def get_scenarios():
    return SCENARIOS

@app.get("/api/kb")
async def get_kb_articles(query: Optional[str] = None):
    if not query:
        return KNOWLEDGE_BASE
    q = query.lower()
    return [
        doc for doc in KNOWLEDGE_BASE
        if q in doc["title"].lower() or q in doc["content"].lower() or any(q in s.lower() for s in doc.get("steps", []))
    ]

@app.get("/api/analytics")
async def get_analytics():
    return db_store.get_analytics()

@app.get("/api/sessions")
async def list_sessions():
    return db_store.list_sessions()

@app.post("/api/sessions")
async def start_session(req: CreateSessionRequest):
    scenario = next((s for s in SCENARIOS if s["id"] == req.scenarioId), SCENARIOS[0])
    session_id = f"session_{uuid.uuid4().hex[:10]}"
    
    # Create session record in database
    session = db_store.create_session(session_id, scenario["id"], req.mode or "simulator")
    
    # Add initial customer message
    first_customer_msg = scenario.get("defaultGreeting", "Hello, I need help with my account.")
    
    # Run initial LangGraph analysis on opening customer message
    graph_result = await run_support_turn(
        session_id=session_id,
        current_customer_message=first_customer_msg,
        messages=[],
        scenario_info=scenario
    )
    
    intent_data = graph_result.get("intent_sentiment", {}) or {}
    coaching_data = graph_result.get("coaching_output", {}) or {}
    esc_data = graph_result.get("escalation_risk", {}) or {}
    kb_data = graph_result.get("knowledge_recommendations", {}) or {}

    msg_record = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "sessionId": session_id,
        "sender": "customer",
        "text": first_customer_msg,
        "timestamp": datetime.utcnow().isoformat(),
        "intent": intent_data.get("intent"),
        "sentiment": intent_data.get("sentiment"),
        "emotionalState": intent_data.get("emotion"),
        "frustrationLevel": "High" if intent_data.get("frustration_score", 0) > 60 else "Medium",
        "frustrationScore": intent_data.get("frustration_score", 45),
        "satisfactionTrend": intent_data.get("satisfaction_trend", "Stable"),
        "escalationRisk": esc_data.get("risk_level", "Low"),
        "reasoningDetails": intent_data.get("reasoning"),
        "coachingGuidance": "; ".join(coaching_data.get("coaching_tips", [])),
        "responseSuggestion": coaching_data.get("suggested_response"),
        "relevantKnowledge": kb_data.get("context_summary"),
        "knowledgeRecommendations": kb_data.get("recommendations"),
        "coachingOutput": coaching_data,
        "escalationRiskOutput": esc_data
    }
    
    db_store.add_message(msg_record)

    return {
        "session": session,
        "scenario": scenario,
        "messages": [msg_record],
        "latestIntelligence": {
            "intent_sentiment": intent_data,
            "coaching_output": coaching_data,
            "escalation_risk": esc_data,
            "knowledge_recommendations": kb_data
        }
    }

@app.get("/api/sessions/{session_id}")
async def get_session_details(session_id: str):
    session = db_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db_store.get_messages(session_id)
    scenario = next((s for s in SCENARIOS if s["id"] == session.get("scenarioId")), SCENARIOS[0])
    return {
        "session": session,
        "scenario": scenario,
        "messages": messages
    }

@app.post("/api/sessions/{session_id}/message")
async def send_agent_message(session_id: str, req: SendMessageRequest):
    session = db_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    scenario = next((s for s in SCENARIOS if s["id"] == session.get("scenarioId")), SCENARIOS[0])
    history = db_store.get_messages(session_id)

    # 1. Record Agent Message
    agent_msg = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "sessionId": session_id,
        "sender": req.sender or "agent",
        "text": req.text,
        "timestamp": datetime.utcnow().isoformat()
    }
    db_store.add_message(agent_msg)
    history.append(agent_msg)

    # 2. Simulate Customer Response
    simulated_customer_text = await simulate_customer_reply(
        scenario_id=scenario["id"],
        agent_message=req.text,
        conversation_history=history
    )

    # 3. Run Python LangGraph Orchestration on new Customer turn
    graph_result = await run_support_turn(
        session_id=session_id,
        current_customer_message=simulated_customer_text,
        messages=history,
        scenario_info=scenario
    )

    intent_data = graph_result.get("intent_sentiment", {}) or {}
    coaching_data = graph_result.get("coaching_output", {}) or {}
    esc_data = graph_result.get("escalation_risk", {}) or {}
    kb_data = graph_result.get("knowledge_recommendations", {}) or {}

    customer_msg = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        "sessionId": session_id,
        "sender": "customer",
        "text": simulated_customer_text,
        "timestamp": datetime.utcnow().isoformat(),
        "intent": intent_data.get("intent"),
        "sentiment": intent_data.get("sentiment"),
        "emotionalState": intent_data.get("emotion"),
        "frustrationLevel": "High" if intent_data.get("frustration_score", 0) > 60 else "Medium",
        "frustrationScore": intent_data.get("frustration_score", 35),
        "satisfactionTrend": intent_data.get("satisfaction_trend", "Improving"),
        "escalationRisk": esc_data.get("risk_level", "Low"),
        "reasoningDetails": intent_data.get("reasoning"),
        "coachingGuidance": "; ".join(coaching_data.get("coaching_tips", [])),
        "responseSuggestion": coaching_data.get("suggested_response"),
        "relevantKnowledge": kb_data.get("context_summary"),
        "knowledgeRecommendations": kb_data.get("recommendations"),
        "coachingOutput": coaching_data,
        "escalationRiskOutput": esc_data
    }
    db_store.add_message(customer_msg)

    return {
        "agentMessage": agent_msg,
        "customerMessage": customer_msg,
        "latestIntelligence": {
            "intent_sentiment": intent_data,
            "coaching_output": coaching_data,
            "escalation_risk": esc_data,
            "knowledge_recommendations": kb_data
        }
    }

@app.post("/api/sessions/{session_id}/end")
async def end_session(session_id: str, req: EndSessionRequest):
    session = db_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    scenario = next((s for s in SCENARIOS if s["id"] == session.get("scenarioId")), SCENARIOS[0])
    messages = db_store.get_messages(session_id)

    graph_state: SupportGraphState = {
        "session_id": session_id,
        "scenario_name": scenario["name"],
        "scenario_description": scenario["description"],
        "messages": messages,
        "status": req.status or "resolved"
    }

    report_result = await post_summary_node(graph_state)
    report = report_result.get("post_interaction_report", {})

    db_store.update_session_status(
        session_id=session_id,
        status=req.status or "resolved",
        summary=report.get("session_summary"),
        post_report=report
    )

    return {
        "success": True,
        "status": req.status or "resolved",
        "report": report
    }

# Interactive Single Page Web Console
HTML_PAGE = """<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ResolveAI - Real-Time AI Support Assistant & Coaching (Python)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak] { display: none !important; }
    .custom-scroll::-webkit-scrollbar { width: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: #0f172a; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  </style>
</head>
<body class="h-full flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white" x-data="supportApp()" x-init="initApp()" x-cloak>
  
  <!-- Header Bar -->
  <header class="bg-slate-800/90 backdrop-blur border-b border-slate-700 px-6 py-3.5 flex items-center justify-between z-20 shrink-0">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 text-white font-bold text-lg">
        <i data-lucide="bot" class="w-6 h-6"></i>
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="font-bold text-lg text-white tracking-tight">ResolveAI Console</h1>
          <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Python LangGraph Engine
          </span>
        </div>
        <p class="text-xs text-slate-400">Real-Time Multi-Agent Customer Support & Live Coaching</p>
      </div>
    </div>

    <!-- Scenario Selector & Action Controls -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">
        <i data-lucide="layers" class="w-4 h-4 text-slate-400"></i>
        <select class="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer" x-model="selectedScenarioId" @change="startNewSession(selectedScenarioId)">
          <template x-for="s in scenarios" :key="s.id">
            <option :value="s.id" x-text="s.name + ' (' + s.difficulty + ')'" class="bg-slate-800 text-slate-200"></option>
          </template>
        </select>
      </div>

      <button @click="openAnalyticsModal()" class="px-3 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-600 flex items-center gap-1.5 transition">
        <i data-lucide="bar-chart-2" class="w-4 h-4 text-indigo-400"></i>
        Analytics
      </button>

      <button @click="endActiveSession('resolved')" :disabled="!activeSession || activeSession.status !== 'active'" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-medium text-white shadow-sm flex items-center gap-1.5 transition">
        <i data-lucide="check-circle" class="w-4 h-4"></i>
        Resolve Case
      </button>

      <button @click="endActiveSession('escalated')" :disabled="!activeSession || activeSession.status !== 'active'" class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-medium text-white shadow-sm flex items-center gap-1.5 transition">
        <i data-lucide="alert-triangle" class="w-4 h-4"></i>
        Escalate
      </button>
    </div>
  </header>

  <!-- 3-Panel Main Layout -->
  <main class="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
    
    <!-- LEFT PANEL: Customer Chat Timeline (5 cols) -->
    <section class="col-span-12 lg:col-span-5 border-r border-slate-800 flex flex-col bg-slate-900/50">
      
      <!-- Customer Persona Header Card -->
      <div class="p-4 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img :src="currentScenario?.customerProfile?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Customer'" class="w-10 h-10 rounded-full border-2 border-indigo-500/50 bg-slate-700" alt="Avatar">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm text-slate-100" x-text="currentScenario?.customerProfile?.name || 'Customer'"></span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium" x-text="latestIntel.intent_sentiment?.emotion || currentScenario?.initialMood || 'Active'"></span>
            </div>
            <span class="text-xs text-slate-400 truncate max-w-xs block" x-text="currentScenario?.name"></span>
          </div>
        </div>

        <!-- Frustration Meter -->
        <div class="text-right">
          <div class="text-[11px] text-slate-400 font-medium">Frustration Score</div>
          <div class="flex items-center gap-1.5 justify-end">
            <div class="w-20 bg-slate-700 h-2 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   :class="frustrationScore > 65 ? 'bg-rose-500' : frustrationScore > 35 ? 'bg-amber-500' : 'bg-emerald-500'"
                   :style="'width: ' + frustrationScore + '%'"></div>
            </div>
            <span class="text-xs font-bold font-mono" :class="frustrationScore > 65 ? 'text-rose-400' : frustrationScore > 35 ? 'text-amber-400' : 'text-emerald-400'" x-text="frustrationScore + '/100'"></span>
          </div>
        </div>
      </div>

      <!-- Messages Timeline -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll" id="chat-stream">
        <template x-for="msg in messages" :key="msg.id">
          <div class="flex flex-col" :class="msg.sender === 'agent' ? 'items-end' : 'items-start'">
            
            <div class="flex items-center gap-2 mb-1 px-1">
              <span class="text-[11px] font-semibold" :class="msg.sender === 'agent' ? 'text-indigo-400' : 'text-emerald-400'" x-text="msg.sender === 'agent' ? 'Support Agent (You)' : (currentScenario?.customerProfile?.name || 'Customer')"></span>
              <span class="text-[10px] text-slate-500" x-text="formatTime(msg.timestamp)"></span>
              
              <template x-if="msg.sender === 'customer' && msg.intent">
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700" x-text="msg.intent"></span>
              </template>
            </div>

            <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed"
                 :class="msg.sender === 'agent' 
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-none'">
              <p x-text="msg.text"></p>
            </div>

            <template x-if="msg.sender === 'customer' && msg.sentiment">
              <div class="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-400">
                <span>Sentiment: <strong :class="msg.sentiment === 'Positive' ? 'text-emerald-400' : msg.sentiment === 'Negative' ? 'text-rose-400' : 'text-slate-300'" x-text="msg.sentiment"></strong></span>
                <span>•</span>
                <span>Emotion: <strong class="text-slate-200" x-text="msg.emotionalState || 'Calm'"></strong></span>
              </div>
            </template>
          </div>
        </template>

        <div x-show="isWaitingReply" class="flex items-center gap-2 text-xs text-slate-400 italic p-2">
          <span class="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          <span>Customer is typing response...</span>
        </div>
      </div>

      <!-- Agent Input Bar -->
      <div class="p-3 border-t border-slate-800 bg-slate-800/60">
        <form @submit.prevent="sendMessage()" class="flex items-center gap-2">
          <input type="text" x-model="agentInput" :disabled="isWaitingReply || activeSession?.status !== 'active'" placeholder="Type your response to the customer..." class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition">
          
          <button type="button" @click="applySuggestedResponse()" :disabled="!latestIntel.coaching_output?.suggested_response" title="Insert AI Suggested Response" class="p-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-indigo-300 rounded-xl transition">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
          </button>

          <button type="submit" :disabled="!agentInput.trim() || isWaitingReply || activeSession?.status !== 'active'" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium text-sm rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition">
            <span>Send</span>
            <i data-lucide="send" class="w-4 h-4"></i>
          </button>
        </form>
      </div>
    </section>

    <!-- CENTER PANEL: Real-time AI Coaching Assistant (4 cols) -->
    <section class="col-span-12 lg:col-span-4 border-r border-slate-800 flex flex-col bg-slate-900/30 overflow-y-auto custom-scroll p-4 space-y-4">
      
      <!-- Panel Title -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <i data-lucide="award" class="w-4 h-4"></i>
          </div>
          <h2 class="text-sm font-bold text-white uppercase tracking-wider">Live Coaching Assistant</h2>
        </div>
        <span class="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">LangGraph Node</span>
      </div>

      <!-- Suggested Response Card -->
      <div class="p-4 rounded-xl bg-slate-800/70 border border-indigo-500/30 shadow-md relative overflow-hidden">
        <div class="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
            <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            Recommended Response
          </span>
          <button @click="applySuggestedResponse()" class="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition">
            <i data-lucide="copy" class="w-3 h-3"></i>
            Use This
          </button>
        </div>

        <p class="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 font-sans" x-text="latestIntel.coaching_output?.suggested_response || 'Waiting for customer message to formulate response guidance...'"></p>

        <!-- Response Quality Rubric -->
        <div class="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/60 text-center">
          <div class="bg-slate-900/40 p-1.5 rounded">
            <div class="text-[10px] text-slate-400">Empathy</div>
            <div class="text-xs font-bold text-emerald-400" x-text="(latestIntel.coaching_output?.response_quality?.empathy || 92) + '%'"></div>
          </div>
          <div class="bg-slate-900/40 p-1.5 rounded">
            <div class="text-[10px] text-slate-400">Clarity</div>
            <div class="text-xs font-bold text-indigo-400" x-text="(latestIntel.coaching_output?.response_quality?.clarity || 90) + '%'"></div>
          </div>
          <div class="bg-slate-900/40 p-1.5 rounded">
            <div class="text-[10px] text-slate-400">Professionalism</div>
            <div class="text-xs font-bold text-violet-400" x-text="(latestIntel.coaching_output?.response_quality?.professionalism || 94) + '%'"></div>
          </div>
        </div>
      </div>

      <!-- Actionable Coaching Guidance -->
      <div class="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2.5">
        <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <i data-lucide="compass" class="w-3.5 h-3.5 text-amber-400"></i>
          Key Communication Tips
        </span>
        <ul class="space-y-1.5 text-xs text-slate-300">
          <template x-for="tip in (latestIntel.coaching_output?.coaching_tips || ['Acknowledge customer emotions first before policy.', 'Provide concrete timeline for resolution steps.'])" :key="tip">
            <li class="flex items-start gap-2 bg-slate-900/50 p-2 rounded border border-slate-800">
              <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
              <span x-text="tip"></span>
            </li>
          </template>
        </ul>
      </div>

      <!-- Next Best Action -->
      <div class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50">
        <span class="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">Next Best Action</span>
        <p class="text-xs text-slate-200" x-text="latestIntel.coaching_output?.next_best_action || 'Review customer account and confirm order details.'"></p>
      </div>

      <!-- Do Nots / Guardrails -->
      <div class="p-3 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-1">
        <span class="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">Guardrails & Things to Avoid</span>
        <ul class="text-xs text-rose-200/90 space-y-1 list-disc list-inside">
          <template x-for="item in (latestIntel.coaching_output?.do_nots || ['Avoid saying there is nothing we can do.', 'Do not quote policy defensively.'])" :key="item">
            <li x-text="item"></li>
          </template>
        </ul>
      </div>
    </section>

    <!-- RIGHT PANEL: RAG Knowledge & Escalation Risk (3 cols) -->
    <section class="col-span-12 lg:col-span-3 flex flex-col bg-slate-900/70 overflow-y-auto custom-scroll p-4 space-y-4">
      
      <!-- Escalation Risk Card -->
      <div class="p-4 rounded-xl border transition-all"
           :class="escalationRiskLevel === 'Critical' ? 'bg-rose-950/40 border-rose-600/60' : escalationRiskLevel === 'High' ? 'bg-amber-950/40 border-amber-600/60' : 'bg-slate-800/50 border-slate-700'">
        
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                :class="escalationRiskLevel === 'Critical' ? 'text-rose-400' : escalationRiskLevel === 'High' ? 'text-amber-400' : 'text-slate-300'">
            <i data-lucide="shield-alert" class="w-4 h-4"></i>
            Escalation Risk
          </span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                :class="escalationRiskLevel === 'Critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : escalationRiskLevel === 'High' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'"
                x-text="escalationRiskLevel"></span>
        </div>

        <p class="text-xs text-slate-300 mb-2 leading-relaxed" x-text="latestIntel.escalation_risk?.reasoning || 'Risk is within normal parameters.'"></p>

        <template x-if="latestIntel.escalation_risk?.detected_triggers?.length">
          <div class="flex flex-wrap gap-1 mt-2">
            <template x-for="t in latestIntel.escalation_risk.detected_triggers" :key="t">
              <span class="text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/60 font-mono" x-text="t"></span>
            </template>
          </div>
        </template>
      </div>

      <!-- Knowledge Base RAG Search & Snippets -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <i data-lucide="book-open" class="w-4 h-4 text-indigo-400"></i>
            Relevant Knowledge (RAG)
          </span>
          <span class="text-[10px] text-slate-400" x-text="(latestIntel.knowledge_recommendations?.recommendations?.length || 0) + ' articles'"></span>
        </div>

        <!-- Article Snippets -->
        <div class="space-y-2.5">
          <template x-for="art in (latestIntel.knowledge_recommendations?.recommendations || defaultKb)" :key="art.title">
            <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-slate-600 transition">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-bold text-slate-100 truncate max-w-[160px]" x-text="art.title"></span>
                <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" x-text="Math.round(art.relevance_score * 100) + '% match'"></span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2" x-text="art.summary"></p>
              <div class="text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800 font-mono" x-text="art.excerpt"></div>
            </div>
          </template>
        </div>
      </div>

    </section>
  </main>

  <!-- Post-Interaction QA Report Modal -->
  <div x-show="showReportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" style="display: none;">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto custom-scroll shadow-2xl space-y-4">
      
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <i data-lucide="file-check" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Post-Interaction QA Audit Report</h3>
            <p class="text-xs text-slate-400" x-text="'Session: ' + (latestReport?.session_id || activeSession?.id)"></p>
          </div>
        </div>
        <button @click="showReportModal = false" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>

      <!-- Score Summary -->
      <div class="grid grid-cols-4 gap-3 text-center">
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400 uppercase">Overall Quality</div>
          <div class="text-xl font-bold text-indigo-400" x-text="(latestReport?.overall_quality_score || 91) + '/100'"></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400 uppercase">Empathy</div>
          <div class="text-xl font-bold text-emerald-400" x-text="(latestReport?.empathy_score || 92) + '/100'"></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400 uppercase">Resolution</div>
          <div class="text-xl font-bold text-violet-400" x-text="(latestReport?.resolution_score || 88) + '/100'"></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400 uppercase">Status</div>
          <div class="text-sm font-bold mt-1 text-emerald-300" x-text="latestReport?.resolution_status || 'Resolved'"></div>
        </div>
      </div>

      <!-- Executive Summary -->
      <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-1">
        <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Executive Summary</span>
        <p class="text-xs text-slate-200 leading-relaxed" x-text="latestReport?.session_summary || 'Interaction successfully completed.'"></p>
      </div>

      <!-- Strengths & Coaching -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl space-y-1.5">
          <span class="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i> Strengths</span>
          <ul class="text-xs text-slate-300 space-y-1 list-disc list-inside">
            <template x-for="s in (latestReport?.strengths || ['High empathy throughout conversation'])" :key="s">
              <li x-text="s"></li>
            </template>
          </ul>
        </div>

        <div class="bg-indigo-950/20 border border-indigo-800/40 p-3 rounded-xl space-y-1.5">
          <span class="text-xs font-bold text-indigo-300 flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i> Coaching Recommendations</span>
          <ul class="text-xs text-slate-300 space-y-1 list-disc list-inside">
            <template x-for="c in (latestReport?.coaching_recommendations || ['Follow standard replacement protocols'])" :key="c">
              <li x-text="c"></li>
            </template>
          </ul>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button @click="showReportModal = false; startNewSession(selectedScenarioId)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/20 transition">
          Start Next Practice Scenario
        </button>
      </div>
    </div>
  </div>

  <!-- Analytics Modal -->
  <div x-show="showAnalyticsModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" style="display: none;">
    <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto custom-scroll shadow-2xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="pie-chart" class="w-5 h-5 text-indigo-400"></i>
          Performance & CSAT Intelligence Dashboard
        </h3>
        <button @click="showAnalyticsModal = false" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>

      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400">Resolution Rate</div>
          <div class="text-xl font-bold text-emerald-400" x-text="(analyticsData?.resolutionRate || 92.5) + '%'"></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400">Avg CSAT</div>
          <div class="text-xl font-bold text-amber-400" x-text="(analyticsData?.csatScore || 4.8) + ' / 5.0'"></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
          <div class="text-[10px] text-slate-400">Avg Response Quality</div>
          <div class="text-xl font-bold text-indigo-400" x-text="(analyticsData?.avgResponseQuality || 91.4) + '%'"></div>
        </div>
      </div>

      <div class="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
        <span class="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">Intent Distribution</span>
        <div class="space-y-2">
          <template x-for="item in (analyticsData?.intentDistribution || [])" :key="item.name">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-300" x-text="item.name"></span>
              <span class="font-mono text-indigo-400 font-bold" x-text="item.value + '%'"></span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <script>
    function supportApp() {
      return {
        scenarios: [],
        selectedScenarioId: 'delayed_order',
        currentScenario: null,
        activeSession: null,
        messages: [],
        agentInput: '',
        isWaitingReply: false,
        latestIntel: {},
        frustrationScore: 45,
        escalationRiskLevel: 'Low',
        showReportModal: false,
        showAnalyticsModal: false,
        latestReport: null,
        analyticsData: null,
        defaultKb: [
          {
            title: "Standard Delivery Delays & Courier Investigation",
            summary: "Guidelines for packages delayed past 3 business days.",
            excerpt: "Issue priority replacement or refund after courier scan trace.",
            relevance_score: 0.94
          }
        ],

        async initApp() {
          try {
            const res = await fetch('/api/scenarios');
            this.scenarios = await res.json();
            if (this.scenarios.length > 0) {
              this.selectedScenarioId = this.scenarios[0].id;
              await this.startNewSession(this.selectedScenarioId);
            }
          } catch (e) {
            console.error('Init error:', e);
          }
          this.$nextTick(() => { lucide.createIcons(); });
        },

        async startNewSession(scenarioId) {
          try {
            this.isWaitingReply = true;
            const res = await fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scenarioId: scenarioId, mode: 'simulator' })
            });
            const data = await res.json();
            this.activeSession = data.session;
            this.currentScenario = data.scenario;
            this.messages = data.messages || [];
            this.updateIntelligence(data.latestIntelligence);
            this.isWaitingReply = false;
            this.scrollToBottom();
          } catch (e) {
            this.isWaitingReply = false;
            console.error('Start session error:', e);
          }
          this.$nextTick(() => { lucide.createIcons(); });
        },

        async sendMessage() {
          if (!this.agentInput.trim() || !this.activeSession || this.isWaitingReply) return;
          const text = this.agentInput.trim();
          this.agentInput = '';

          const optimisticAgentMsg = {
            id: 'temp_' + Date.now(),
            sessionId: this.activeSession.id,
            sender: 'agent',
            text: text,
            timestamp: new Date().toISOString()
          };
          this.messages.push(optimisticAgentMsg);
          this.isWaitingReply = true;
          this.scrollToBottom();

          try {
            const res = await fetch(`/api/sessions/${this.activeSession.id}/message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: text, sender: 'agent' })
            });
            const data = await res.json();
            
            // Replace optimistic with server response
            this.messages = this.messages.filter(m => m.id !== optimisticAgentMsg.id);
            this.messages.push(data.agentMessage);
            this.messages.push(data.customerMessage);
            this.updateIntelligence(data.latestIntelligence);
          } catch (e) {
            console.error('Message error:', e);
          } finally {
            this.isWaitingReply = false;
            this.scrollToBottom();
          }
          this.$nextTick(() => { lucide.createIcons(); });
        },

        applySuggestedResponse() {
          if (this.latestIntel.coaching_output?.suggested_response) {
            this.agentInput = this.latestIntel.coaching_output.suggested_response;
          }
        },

        async endActiveSession(status) {
          if (!this.activeSession) return;
          try {
            const res = await fetch(`/api/sessions/${this.activeSession.id}/end`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: status })
            });
            const data = await res.json();
            this.latestReport = data.report;
            this.showReportModal = true;
          } catch (e) {
            console.error('End session error:', e);
          }
          this.$nextTick(() => { lucide.createIcons(); });
        },

        async openAnalyticsModal() {
          try {
            const res = await fetch('/api/analytics');
            this.analyticsData = await res.json();
            this.showAnalyticsModal = true;
          } catch (e) {
            console.error('Analytics error:', e);
          }
          this.$nextTick(() => { lucide.createIcons(); });
        },

        updateIntelligence(intel) {
          if (!intel) return;
          this.latestIntel = intel;
          if (intel.intent_sentiment?.frustration_score !== undefined) {
            this.frustrationScore = intel.intent_sentiment.frustration_score;
          }
          if (intel.escalation_risk?.risk_level) {
            this.escalationRiskLevel = intel.escalation_risk.risk_level;
          }
        },

        scrollToBottom() {
          this.$nextTick(() => {
            const el = document.getElementById('chat-stream');
            if (el) el.scrollTop = el.scrollHeight;
            lucide.createIcons();
          });
        },

        formatTime(isoStr) {
          if (!isoStr) return '';
          try {
            const d = new Date(isoStr);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            return '';
          }
        }
      }
    }
  </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    return HTMLResponse(content=HTML_PAGE)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
