import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from python_orchestrator.graph import support_graph, run_support_turn
from python_orchestrator.nodes.summary_node import post_summary_node
from python_orchestrator.state import SupportGraphState

load_dotenv()

app = FastAPI(
    title="Customer Support Multi-Agent LangGraph Orchestrator",
    description="Python LangGraph implementation for real-time customer support intelligence & coaching",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TurnRequest(BaseModel):
    session_id: str
    current_customer_message: str
    messages: List[Dict[str, Any]] = []
    scenario_info: Optional[Dict[str, Any]] = None

class SummaryRequest(BaseModel):
    session_id: str
    scenario_name: str
    scenario_description: Optional[str] = ""
    messages: List[Dict[str, Any]] = []
    status: Optional[str] = "resolved"

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "framework": "LangGraph (Python)",
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY"))
    }

@app.post("/api/langgraph/orchestrate")
async def orchestrate_turn(req: TurnRequest):
    """
    Runs the full LangGraph pipeline:
    Intent -> [Knowledge RAG || Escalation Risk] -> Conditional Routing -> Coaching Suggestion
    """
    try:
        final_state = await run_support_turn(
            session_id=req.session_id,
            current_customer_message=req.current_customer_message,
            messages=req.messages,
            scenario_info=req.scenario_info
        )
        return {
            "success": True,
            "session_id": req.session_id,
            "intent_sentiment": final_state.get("intent_sentiment"),
            "knowledge_recommendations": final_state.get("knowledge_recommendations"),
            "escalation_risk": final_state.get("escalation_risk"),
            "coaching_output": final_state.get("coaching_output"),
            "execution_route": final_state.get("execution_route", "standard_coaching")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LangGraph execution error: {str(e)}")

@app.post("/api/langgraph/summary")
async def generate_summary(req: SummaryRequest):
    """Generates the post-interaction QA and coaching audit report."""
    try:
        mock_state: SupportGraphState = {
            "session_id": req.session_id,
            "scenario_name": req.scenario_name,
            "scenario_description": req.scenario_description or "",
            "messages": req.messages,
            "status": req.status or "resolved"
        }
        res = await post_summary_node(mock_state)
        return {
            "success": True,
            "report": res.get("post_interaction_report")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LangGraph summary generation error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("python_orchestrator.server:app", host="0.0.0.0", port=8000, reload=True)
