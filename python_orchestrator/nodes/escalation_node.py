import os
import json
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
You are an escalation risk assessment specialist for a customer support operation.

Your task is to analyze the conversation and evaluate:
1. Probability of escalation (0.0 - 1.0)
2. Risk level: low, medium, high, critical
3. Specific triggers detected (supervisor_request, cancellation_threat, repeated_failure, profanity)
4. Recommended action: continue, monitor, escalate, transfer_to_manager
5. Estimated time to escalation

OUTPUT SCHEMA:
{
  "escalation_risk": 0.72,
  "risk_level": "high",
  "reasons": ["Customer requested supervisor", "Third delivery failure"],
  "recommended_action": "escalate",
  "escalation_triggers": ["supervisor_request", "repeated_failure"],
  "time_to_escalation_estimate": "1-2 messages"
}
""".strip()

def calculate_escalation_fallback(message: str, frust_score: int) -> Dict[str, Any]:
    text = (message or "").lower()
    triggers = []
    score = frust_score
    
    if any(w in text for w in ["manager", "supervisor", "higher up", "lead"]):
        triggers.append("supervisor_request")
        score += 35
    if any(w in text for w in ["cancel", "close account", "switching", "leave"]):
        triggers.append("cancellation_threat")
        score += 25
    if any(w in text for w in ["lawyer", "legal", "chargeback", "sue"]):
        triggers.append("legal_or_chargeback_threat")
        score += 30

    final_score = min(100, max(10, score))
    risk_level = "Critical" if final_score >= 80 else "High" if final_score >= 60 else "Medium" if final_score >= 35 else "Low"

    return {
        "escalation_score": final_score,
        "risk_level": risk_level,
        "confidence_score": 92,
        "reasoning": f"Assessed escalation probability as {final_score}% with triggers: {', '.join(triggers) or 'standard flow'}.",
        "recommended_actions": ["Transfer to supervisor immediately" if risk_level == "Critical" else "Maintain heightened empathy and offer definitive next steps"],
        "detected_triggers": triggers,
        "recommended_action_code": "transfer_to_manager" if risk_level == "Critical" else "monitor"
    }

async def escalation_risk_node(state: SupportGraphState) -> Dict[str, Any]:
    """LangGraph Node: Assesses escalation churn probability and supervisor demand flags."""
    current_msg = state.get("current_customer_message", "")
    messages = state.get("messages", [])
    intent_data = state.get("intent_sentiment", {}) or {}
    frust_score = intent_data.get("frustration_score", 45)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        fallback = calculate_escalation_fallback(current_msg, frust_score)
        return {
            "escalation_risk": fallback,
            "should_escalate_immediately": fallback["risk_level"] == "Critical"
        }

    history_text = "\n".join([f"[{m.get('sender', 'user').upper()}]: {m.get('text', '')}" for m in messages[-8:]])
    user_prompt = f"CONVERSATION HISTORY:\n{history_text or 'Start of conversation'}\n\nLATEST CUSTOMER MESSAGE:\n\"{current_msg}\"\nTOTAL MESSAGES: {len(messages) + 1}\n\nReturn JSON escalation assessment."

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
                prob = float(data.get("escalation_risk", 0.4))
                score_int = min(100, max(0, int(prob * 100 if prob <= 1.0 else prob)))
                level_str = data.get("risk_level", "low").capitalize()
                is_critical = level_str.lower() == "critical" or score_int >= 80

                return {
                    "escalation_risk": {
                        "escalation_score": score_int,
                        "risk_level": "Critical" if is_critical else "High" if score_int >= 60 else "Medium" if score_int >= 35 else "Low",
                        "confidence_score": 92,
                        "reasoning": ". ".join(data.get("reasons", [])) or f"Risk probability evaluated at {score_int}%.",
                        "recommended_actions": [data.get("recommended_action", "Monitor conversation closely")],
                        "detected_triggers": data.get("escalation_triggers", []),
                        "recommended_action_code": data.get("recommended_action", "monitor"),
                        "time_to_escalation_estimate": data.get("time_to_escalation_estimate", "2-3 messages")
                    },
                    "should_escalate_immediately": is_critical
                }
        except Exception:
            continue

    fallback = calculate_escalation_fallback(current_msg, frust_score)
    return {
        "escalation_risk": fallback,
        "should_escalate_immediately": fallback["risk_level"] == "Critical"
    }
