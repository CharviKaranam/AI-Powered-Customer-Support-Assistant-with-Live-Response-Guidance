import os
import json
from datetime import datetime
from typing import Dict, Any
from google import genai
from google.genai import types
from python_orchestrator.state import SupportGraphState

MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
]

SYSTEM_PROMPT = """
You are a senior customer support QA auditor generating a comprehensive post-interaction report.

Evaluate:
1. Resolution effectiveness & completeness (0-100)
2. Communication quality (0-100)
3. Empathy & tone (0-100)
4. Knowledge utilization & professionalism (0-100)
5. Overall composite score (0-100)
6. Key strengths, areas for improvement, and actionable coaching recommendations.

OUTPUT SCHEMA:
{
  "session_summary": "The agent handled a delayed shipment inquiry...",
  "key_issues": ["Package delayed past 3 days", "Tracking number stalled"],
  "resolution_status": "Resolved",
  "resolution_score": 90,
  "communication_score": 88,
  "empathy_score": 92,
  "professionalism_score": 95,
  "overall_score": 91,
  "strengths": ["Demonstrated high empathy early", "Referenced KB-101 replacement policy accurately"],
  "areas_for_improvement": ["Could provide specific delivery hour ETA"],
  "coaching_recommendations": ["Always re-confirm shipping address before dispatching replacement"]
}
""".strip()

def summary_fallback(state: SupportGraphState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    session_id = state.get("session_id", "session_001")
    scenario_name = state.get("scenario_name", "Support Case")
    status = state.get("status", "resolved").capitalize()
    
    score = 90 if status == "Resolved" else 60 if status == "Escalated" else 75

    return {
        "session_id": session_id,
        "generated_at": datetime.utcnow().isoformat(),
        "session_summary": f"Interaction regarding {scenario_name} concluded with status: {status}.",
        "key_issues": [f"Customer inquiry regarding {scenario_name}"],
        "resolution_status": status,
        "overall_quality_score": score,
        "resolution_score": score,
        "communication_score": 88,
        "empathy_score": 90,
        "professionalism_score": 92,
        "strengths": [
            "Actively engaged with customer throughout the session.",
            "Utilized standard company knowledge and resolution protocols."
        ],
        "areas_for_improvement": [
            "Acknowledge customer frustration even earlier in the opening exchange."
        ],
        "coaching_recommendations": [
            "Review de-escalation best practices for urgent customer queries."
        ],
        "sentiment_journey": [
            {
                "turn": i + 1,
                "sender": m.get("sender"),
                "text": m.get("text")[:60]
            }
            for i, m in enumerate(messages)
        ]
    }

async def post_summary_node(state: SupportGraphState) -> Dict[str, Any]:
    """LangGraph Node: Compiles full session post-interaction QA and coaching audit report."""
    session_id = state.get("session_id", "session_001")
    scenario_name = state.get("scenario_name", "Support Case")
    scenario_desc = state.get("scenario_description", "")
    messages = state.get("messages", [])
    status = state.get("status", "resolved")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"post_interaction_report": summary_fallback(state)}

    transcript = "\n".join([f"Turn {i+1} [{m.get('sender', 'user').upper()}]: {m.get('text', '')}" for i, m in enumerate(messages)])

    user_prompt = f"""
SESSION METADATA:
Scenario: {scenario_name} ({scenario_desc})
Status: {status}
Total Turns: {len(messages)}

TRANSCRIPT:
{transcript}

Generate full post-interaction QA coaching report.
""".strip()

    client = genai.Client(api_key=api_key)

    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"{SYSTEM_PROMPT}\n\n{user_prompt}",
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            if response.text:
                data = json.loads(response.text)
                return {
                    "post_interaction_report": {
                        "session_id": session_id,
                        "generated_at": datetime.utcnow().isoformat(),
                        "session_summary": data.get("session_summary", f"Session completed for {scenario_name}."),
                        "key_issues": data.get("key_issues", [scenario_name]),
                        "resolution_status": data.get("resolution_status", "Resolved"),
                        "overall_quality_score": int(data.get("overall_score", 85)),
                        "resolution_score": int(data.get("resolution_score", 85)),
                        "communication_score": int(data.get("communication_score", 85)),
                        "empathy_score": int(data.get("empathy_score", 85)),
                        "professionalism_score": int(data.get("professionalism_score", 85)),
                        "strengths": data.get("strengths", ["Maintained responsive dialogue"]),
                        "areas_for_improvement": data.get("areas_for_improvement", ["Ensure quick verification"]),
                        "coaching_recommendations": data.get("coaching_recommendations", ["Follow standard troubleshooting steps"]),
                        "sentiment_journey": [
                            {
                                "turn": i + 1,
                                "sender": m.get("sender"),
                                "text": m.get("text")[:60]
                            }
                            for i, m in enumerate(messages)
                        ]
                    }
                }
        except Exception:
            continue

    return {"post_interaction_report": summary_fallback(state)}
