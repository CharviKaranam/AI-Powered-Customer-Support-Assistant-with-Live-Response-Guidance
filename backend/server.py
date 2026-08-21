import http.server
import socketserver
import json
import urllib.parse
import sys
import os
import time
import uuid
from typing import List, Optional, Dict, Any, Tuple

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
from rag_engine import rag_engine, text_to_dense_embedding
from langgraph_orchestrator import run_langgraph_simulation_step, run_langgraph_qa_evaluation

# Initialize database tables & seed data on startup
init_db()

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

class PythonApiHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, data: Any, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("X-Powered-By", "ResolveAI Python 3.10 Backend Engine")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            if path == "/api/health":
                self._send_json({
                    "status": "ok",
                    "engine": "Python 3.10 + SQLite (sqlite3)",
                    "ai": "Gemini 2.5 Flash + Text Embedding 004",
                    "timestamp": int(time.time() * 1000)
                })

            elif path == "/api/chat/history":
                sessions = get_all_sessions()
                self._send_json(sessions)

            elif path.startswith("/api/chat/session/"):
                session_id = path.replace("/api/chat/session/", "")
                session = get_session(session_id)
                if not session:
                    self._send_json({"error": "Session not found"}, 404)
                else:
                    self._send_json(session)

            elif path == "/api/knowledge":
                articles = get_all_knowledge_articles()
                self._send_json(articles)

            elif path == "/api/knowledge/search":
                q = query.get("q", [""])[0]
                articles = get_all_knowledge_articles()
                if not q:
                    self._send_json(articles[:5])
                else:
                    results = retrieve_relevant_knowledge(q, articles, top_k=5)
                    self._send_json(results)

            elif path == "/api/analytics":
                sessions = get_all_sessions()
                analytics = self._calculate_analytics(sessions)
                self._send_json(analytics)

            elif path == "/api/db/stats":
                stats = get_database_stats()
                self._send_json(stats)

            elif path == "/api/db/export":
                if not os.path.exists(DB_FILE):
                    self._send_json({"error": "Database file not found"}, 404)
                    return
                with open(DB_FILE, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/x-sqlite3")
                self.send_header("Content-Disposition", 'attachment; filename="resolve_ai.sqlite"')
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)

            else:
                self._send_json({"error": "Not Found", "path": path}, 404)

        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_len = int(self.headers.get("Content-Length", 0))
        post_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            body = json.loads(post_body)
        except Exception:
            body = {}

        try:
            if path == "/api/chat/start":
                scenario_id = body.get("scenarioId", "delayed_order")
                scenario = SCENARIOS.get(scenario_id, SCENARIOS["delayed_order"])
                interaction_mode = body.get("interactionMode", "simulator")

                session_id = f"sess_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
                session_data = {
                    "id": session_id,
                    "scenarioId": scenario_id,
                    "scenarioTitle": scenario.get("name"),
                    "customerName": scenario.get("customerProfile", {}).get("name"),
                    "status": "active",
                    "interactionMode": interaction_mode,
                    "startedAt": int(time.time() * 1000)
                }
                save_session(session_data)

                # Generate opening customer message
                first_msg_text = self._get_initial_customer_message(scenario_id)
                msg_id = f"msg_{int(time.time()*1000)}_cust"
                
                # Retrieve grounded knowledge via High-Grade Hybrid RAG
                rag_docs = rag_engine.retrieve_grounded_context(first_msg_text, top_k=3)

                first_msg = {
                    "id": msg_id,
                    "sessionId": session_id,
                    "sender": "customer",
                    "text": first_msg_text,
                    "timestamp": int(time.time() * 1000),
                    "sentiment": "Negative",
                    "frustrationScore": 65,
                    "emotionalState": scenario.get("initialMood", "Anxious"),
                    "escalationRisk": "Medium",
                    "coachingOutput": {
                        "intent": "Customer seeking delivery status and reassurance",
                        "recommended_reply": "I completely understand how important this delivery is! Let me check the real-time courier status and get this prioritized for you immediately.",
                        "alternative_responses": {
                            "formal": "Thank you for reaching out. I am reviewing the tracking log to determine the current status of your shipment.",
                            "empathetic": "I am so sorry for the worry this has caused you! Let's get this sorted out right away."
                        },
                        "policy_rules": ["Acknowledge delivery delay with empathy", "Verify carrier tracking", "Offer standard courtesy compensation if past delivery window"],
                        "compensation_suggestions": ["$15 shipping credit / expedited replacement"],
                        "tone_guidance": "Empathetic, reassuring, and immediate ownership.",
                        "what_to_avoid": "Do not quote carrier terms defensively.",
                        "escalationRisk": {"level": "Medium", "triggers": ["Imminent event or deadline"]},
                        "knowledgeRecommendations": rag_docs
                    }
                }
                save_message(first_msg)

                session = get_session(session_id)
                self._send_json(session)

            elif path == "/api/chat/message":
                session_id = body.get("sessionId")
                text = body.get("text", "")
                mode = body.get("interactionMode", "simulator")

                session = get_session(session_id)
                if not session:
                    self._send_json({"error": "Session not found"}, 404)
                    return

                scenario = SCENARIOS.get(session.get("scenarioId"), SCENARIOS["delayed_order"])
                now = int(time.time() * 1000)

                # 1. Save Agent Message
                agent_msg = {
                    "id": f"msg_{now}_agent",
                    "sessionId": session_id,
                    "sender": "agent",
                    "text": text,
                    "timestamp": now,
                    "sentiment": "Positive",
                    "frustrationScore": 0,
                    "emotionalState": "Professional"
                }
                save_message(agent_msg)

                # 2. Execute turn through LangGraph StateGraph
                history = session.get("messages", []) + [agent_msg]
                langgraph_result = run_langgraph_simulation_step(
                    session_id=session_id,
                    scenario_id=session.get("scenarioId", "delayed_order"),
                    scenario=scenario,
                    conversation_history=history,
                    current_agent_message=text
                )
                
                cust_reaction = langgraph_result.get("customerReaction", {})
                coaching = langgraph_result.get("coachingOutput", {})

                cust_now = int(time.time() * 1000) + 100
                cust_msg = {
                    "id": f"msg_{cust_now}_cust",
                    "sessionId": session_id,
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

                # Check if resolved or escalated
                if langgraph_result.get("isResolved"):
                    session["status"] = "resolved"
                    save_session(session)

                updated_session = get_session(session_id)
                self._send_json(updated_session)

            elif path == "/api/chat/end":
                session_id = body.get("sessionId")
                status = body.get("status", "resolved")
                summary = body.get("summary", "")

                session = get_session(session_id)
                if not session:
                    self._send_json({"error": "Session not found"}, 404)
                    return

                scenario = SCENARIOS.get(session.get("scenarioId"), SCENARIOS["delayed_order"])
                messages = session.get("messages", [])

                # Generate evaluation report via LangGraph QA Graph
                report = run_langgraph_qa_evaluation(session_id, scenario, messages)
                session["status"] = status
                session["endedAt"] = int(time.time() * 1000)
                session["summary"] = summary or report.get("interactionSummary", {}).get("finalOutcome", "Session concluded")
                session["postReport"] = report

                save_session(session)
                self._send_json(session)

            elif path == "/api/knowledge/ingest":
                title = body.get("title", "Custom Policy")
                category = body.get("category", "General")
                content = body.get("content", "")
                steps = body.get("steps", [])
                rules = body.get("rules", [])

                art_id = f"kb_{int(time.time()*1000)}"
                embedding = text_to_dense_embedding(f"{title} {category} {content}")

                art_data = {
                    "id": art_id,
                    "title": title,
                    "category": category,
                    "content": content,
                    "steps": steps,
                    "rules": rules,
                    "embedding": embedding,
                    "createdAt": int(time.time() * 1000)
                }
                save_knowledge_article(art_data)
                self._send_json(art_data)

            else:
                self._send_json({"error": "Not Found", "path": path}, 404)

        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            if path == "/api/chat/history":
                clear_all_history()
                self._send_json({"success": True, "message": "All history cleared successfully"})

            elif path.startswith("/api/chat/session/"):
                session_id = path.replace("/api/chat/session/", "")
                delete_session(session_id)
                self._send_json({"success": True, "sessionId": session_id})

            elif path.startswith("/api/knowledge/"):
                art_id = path.replace("/api/knowledge/", "")
                delete_knowledge_article(art_id)
                self._send_json({"success": True, "id": art_id})

            else:
                self._send_json({"error": "Not Found", "path": path}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _get_initial_customer_message(self, scenario_id: str) -> str:
        messages = {
            "delayed_order": "Hi, I ordered a birthday present for my daughter with 2-day expedited shipping. It was supposed to arrive yesterday, but the tracking still says 'In Transit'. Her party is tomorrow! Where is my order?!",
            "refund_request": "I bought this wireless speaker 45 days ago and it already completely stopped charging! I called your store and they told me returns are only 30 days. That is ridiculous for a defective product. I want my money back immediately!",
            "product_troubleshoot": "I've been trying to connect this smart hub for over an hour now. Every time I scan the QR code in the app, the LED blinks red and says 'Pairing Failed'. I'm ready to throw this out the window.",
            "billing_double_charge": "I just checked my bank statement and I see two charges of $59.99 from your company on the same day! Why was I double charged? Fix this right now and refund my money!"
        }
        return messages.get(scenario_id, "Hello, I need assistance with my recent order.")

    def _calculate_analytics(self, sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(sessions)
        resolved = sum(1 for s in sessions if s.get("status") == "resolved")
        escalated = sum(1 for s in sessions if s.get("status") == "escalated")
        active = sum(1 for s in sessions if s.get("status") == "active")

        # Extract QA scores
        scores = []
        for s in sessions:
            rep = s.get("postReport")
            if rep and "resolutionQuality" in rep:
                scores.append(rep["resolutionQuality"].get("score", 85))

        avg_score = round(sum(scores) / len(scores), 1) if scores else 87.5

        return {
            "overview": {
                "totalSessions": total,
                "resolvedCount": resolved,
                "escalatedCount": escalated,
                "activeCount": active,
                "resolutionRate": round((resolved / total * 100), 1) if total > 0 else 85.0,
                "averageQualityScore": avg_score
            },
            "recentSessions": sessions[:10],
            "database": {
                "engine": "Python 3.10 SQLite (sqlite3)",
                "file": "resolve_ai.sqlite"
            }
        }

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[Python API] {args[0]} {args[1]} -> {args[2]}\n")

def run_server(port: int = 5005):
    server_address = ("127.0.0.1", port)
    httpd = socketserver.TCPServer(server_address, PythonApiHandler)
    print(f"ResolveAI Python Backend Server running on http://127.0.0.1:{port}", flush=True)
    httpd.serve_forever()

if __name__ == "__main__":
    port = 5005
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
