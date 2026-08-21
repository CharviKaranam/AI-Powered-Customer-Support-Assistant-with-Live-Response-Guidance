from typing import List, Optional, Dict, Any, Tuple
import os
import sys
import time
import uuid

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from pydantic import BaseModel
    FASTAPI_INSTALLED = True
except ImportError:
    FASTAPI_INSTALLED = False
    # Graceful fallback definitions when running without FastAPI installed
    class BaseModel:
        def __init__(self, **data):
            for k, v in data.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__

    class FastAPI:
        def __init__(self, *args, **kwargs): pass
        def add_middleware(self, *args, **kwargs): pass
        def get(self, *args, **kwargs): return lambda f: f
        def post(self, *args, **kwargs): return lambda f: f
        def delete(self, *args, **kwargs): return lambda f: f

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail

    class CORSMiddleware: pass
    class FileResponse: pass
    def Query(*args, **kwargs): return None

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db,
    save_session,
    get_session,
    get_all_sessions,
    save_message,
    delete_session,
    clear_all_history,
    get_all_knowledge_articles,
    save_knowledge_article,
    delete_knowledge_article,
    get_database_stats,
    DB_FILE
)
from rag_engine import rag_engine
from langgraph_orchestrator import run_langgraph_simulation_step, run_langgraph_qa_evaluation

# Initialize SQLite database schema
init_db()

app = FastAPI(
    title="ResolveAI Python Backend",
    description="Python FastAPI backend powering ResolveAI Support Readiness Simulation & QA Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCENARIOS = {
    "delayed_order": {
        "id": "delayed_order",
        "name": "Delayed Order Delivery",
        "description": "Customer purchased a birthday gift for their child. The delivery was scheduled for yesterday but hasn't arrived. The customer is anxious and frustrated.",
        "difficulty": "Medium",
        "initialMood": "Anxious & Concerned",
        "initialFrustration": "Medium",
        "customerProfile": {
            "name": "Sarah Jenkins",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah"
        }
    },
    "refund_request": {
        "id": "refund_request",
        "name": "Out-of-Warranty Refund Request",
        "description": "Customer bought a smart speaker 45 days ago. The refund policy is strictly 30 days. The device stopped charging and they want a full refund.",
        "difficulty": "Medium",
        "initialMood": "Annoyed & Demanding",
        "initialFrustration": "Medium",
        "customerProfile": {
            "name": "Marcus Chen",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus"
        }
    },
    "product_troubleshoot": {
        "id": "product_troubleshoot",
        "name": "Smart Hub Setup Failure",
        "description": "Customer is trying to connect a newly unboxed smart hub to their Wi-Fi router. It keeps blinking red and refusing to connect. They've spent an hour troubleshooting.",
        "difficulty": "High",
        "initialMood": "Extremely Frustrated",
        "initialFrustration": "High",
        "customerProfile": {
            "name": "David Vance",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=David"
        }
    },
    "billing_double_charge": {
        "id": "billing_double_charge",
        "name": "Duplicate Billing Charges",
        "description": "Customer noticed two identical pending charges of $59.99 on their credit card statement. They are furious and suspect a system glitch.",
        "difficulty": "High",
        "initialMood": "Angry & Suspicious",
        "initialFrustration": "High",
        "customerProfile": {
            "name": "Elena Rostova",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Elena"
        }
    }
}

class StartChatRequest(BaseModel):
    scenarioId: str = "delayed_order"
    interactionMode: str = "simulator"

class MessageRequest(BaseModel):
    sessionId: str
    text: str
    interactionMode: str = "simulator"

class EndChatRequest(BaseModel):
    sessionId: str
    status: str = "resolved"
    summary: Optional[str] = None

class KnowledgeIngestRequest(BaseModel):
    title: str
    category: str
    content: str
    steps: Optional[List[str]] = []
    rules: Optional[List[str]] = []

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "framework": "FastAPI + Python 3.10",
        "database": "SQLite (sqlite3)",
        "ai": "Google Gemini 2.5 Flash + Text Embedding 004",
        "timestamp": int(time.time() * 1000)
    }

@app.get("/api/chat/history")
def get_chat_history():
    return get_all_sessions()

@app.get("/api/chat/session/{session_id}")
def get_chat_session(session_id: str):
    sess = get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return sess

@app.post("/api/chat/start")
def start_chat_session(req: StartChatRequest):
    scenario = SCENARIOS.get(req.scenarioId, SCENARIOS["delayed_order"])
    session_id = f"sess_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    
    session_data = {
        "id": session_id,
        "scenarioId": req.scenarioId,
        "scenarioTitle": scenario.get("name"),
        "customerName": scenario.get("customerProfile", {}).get("name"),
        "status": "active",
        "interactionMode": req.interactionMode,
        "startedAt": int(time.time() * 1000)
    }
    save_session(session_data)

    initial_messages = {
        "delayed_order": "Hi, I ordered a birthday present for my daughter with 2-day expedited shipping. It was supposed to arrive yesterday, but the tracking still says 'In Transit'. Her party is tomorrow! Where is my order?!",
        "refund_request": "I bought this wireless speaker 45 days ago and it already completely stopped charging! I called your store and they told me returns are only 30 days. That is ridiculous for a defective product. I want my money back immediately!",
        "product_troubleshoot": "I've been trying to connect this smart hub for over an hour now. Every time I scan the QR code in the app, the LED blinks red and says 'Pairing Failed'. I'm ready to throw this out the window.",
        "billing_double_charge": "I just checked my bank statement and I see two charges of $59.99 from your company on the same day! Why was I double charged? Fix this right now and refund my money!"
    }
    first_text = initial_messages.get(req.scenarioId, "Hello, I need assistance with my recent order.")

    # Retrieve grounded knowledge via High-Grade Hybrid RAG
    rag_docs = rag_engine.retrieve_grounded_context(first_text, top_k=3)

    # Initial coaching payload
    first_msg = {
        "id": f"msg_{int(time.time()*1000)}_cust",
        "sessionId": session_id,
        "sender": "customer",
        "text": first_text,
        "timestamp": int(time.time() * 1000),
        "sentiment": "Negative",
        "frustrationScore": 65,
        "emotionalState": scenario.get("initialMood", "Anxious"),
        "escalationRisk": "Medium",
        "coachingOutput": {
            "intent": "Customer seeking delivery status and reassurance",
            "recommended_reply": "I completely understand how important this delivery is for your daughter's birthday! Let me check the real-time courier status and get this prioritized for you immediately.",
            "alternative_responses": {
                "formal": "Thank you for reaching out. I am reviewing the tracking log to determine the current status of your shipment.",
                "empathetic": "I am so sorry for the worry this has caused you! Let's get this sorted out right away."
            },
            "policy_rules": ["Acknowledge delivery delay with empathy", "Verify carrier tracking", "Offer standard courtesy compensation if past delivery window"],
            "compensation_suggestions": ["$15 shipping credit / expedited replacement"],
            "tone_guidance": "Empathetic, reassuring, and immediate ownership.",
            "what_to_avoid": "Do not quote carrier terms defensively.",
            "escalationRisk": {"level": "Medium", "triggers": ["Birthday event impending"]},
            "knowledgeRecommendations": rag_docs
        }
    }
    save_message(first_msg)
    return get_session(session_id)

@app.post("/api/chat/message")
def post_chat_message(req: MessageRequest):
    session = get_session(req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    scenario = SCENARIOS.get(session.get("scenarioId"), SCENARIOS["delayed_order"])
    now = int(time.time() * 1000)

    # 1. Save agent message to SQLite
    agent_msg = {
        "id": f"msg_{now}_agent",
        "sessionId": req.sessionId,
        "sender": "agent",
        "text": req.text,
        "timestamp": now,
        "sentiment": "Positive",
        "frustrationScore": 0,
        "emotionalState": "Professional"
    }
    save_message(agent_msg)

    # 2. Execute turn through LangGraph StateGraph
    history = session.get("messages", []) + [agent_msg]
    langgraph_result = run_langgraph_simulation_step(
        session_id=req.sessionId,
        scenario_id=session.get("scenarioId", "delayed_order"),
        scenario=scenario,
        conversation_history=history,
        current_agent_message=req.text
    )

    cust_reaction = langgraph_result.get("customerReaction", {})
    coaching = langgraph_result.get("coachingOutput", {})

    cust_now = int(time.time() * 1000) + 100
    cust_msg = {
        "id": f"msg_{cust_now}_cust",
        "sessionId": req.sessionId,
        "sender": "customer",
        "text": cust_reaction.get("replyText", "Thank you for looking into this."),
        "timestamp": cust_now,
        "sentiment": cust_reaction.get("sentiment", "Neutral"),
        "frustrationScore": cust_reaction.get("frustrationScore", 35),
        "emotionalState": cust_reaction.get("emotionalState", "Calm"),
        "escalationRisk": langgraph_result.get("escalationRisk", {}).get("level", "Low"),
        "coachingOutput": coaching
    }
    save_message(cust_msg)

    if langgraph_result.get("isResolved"):
        session["status"] = "resolved"
        save_session(session)

    return get_session(req.sessionId)

@app.post("/api/chat/end")
def end_chat_session(req: EndChatRequest):
    session = get_session(req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    scenario = SCENARIOS.get(session.get("scenarioId"), SCENARIOS["delayed_order"])
    messages = session.get("messages", [])

    # Execute QA evaluation through LangGraph QA Graph
    report = run_langgraph_qa_evaluation(req.sessionId, scenario, messages)

    session["status"] = req.status
    session["endedAt"] = int(time.time() * 1000)
    session["summary"] = req.summary or report.get("interactionSummary", {}).get("finalOutcome", "Session concluded")
    session["postReport"] = report

    save_session(session)
    return session

@app.get("/api/knowledge")
def get_knowledge():
    return get_all_knowledge_articles()

@app.post("/api/knowledge/ingest")
def ingest_knowledge(req: KnowledgeIngestRequest):
    art_id = f"kb_{int(time.time()*1000)}"
    embedding = get_text_embedding(f"{req.title} {req.category} {req.content}")
    art_data = {
        "id": art_id,
        "title": req.title,
        "category": req.category,
        "content": req.content,
        "steps": req.steps or [],
        "rules": req.rules or [],
        "embedding": embedding,
        "createdAt": int(time.time() * 1000)
    }
    save_knowledge_article(art_data)
    return art_data

@app.get("/api/db/stats")
def get_db_stats():
    return get_database_stats()

@app.get("/api/db/export")
def export_db_file():
    if not os.path.exists(DB_FILE):
        raise HTTPException(status_code=404, detail="Database file not found")
    return FileResponse(DB_FILE, media_type="application/x-sqlite3", filename="resolve_ai.sqlite")

@app.delete("/api/chat/history")
def delete_all_history():
    clear_all_history()
    return {"success": True, "message": "All history cleared"}

@app.delete("/api/chat/session/{session_id}")
def delete_single_session(session_id: str):
    delete_session(session_id)
    return {"success": True, "sessionId": session_id}
