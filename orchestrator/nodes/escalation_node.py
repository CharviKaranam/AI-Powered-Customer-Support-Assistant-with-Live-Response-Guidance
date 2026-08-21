import os
import json
from typing import Dict, Any
from google import genai
from google.genai import types
from orchestrator.state import SupportGraphState

MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
]

SYSTEM_PROMPT = """
You are the "Escalation Risk Monitor Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to continuously analyze live conversation transcripts, identify dangerous escalation vectors and churn triggers, compute an exact escalation risk probability score (0.00 to 1.00 / 0 to 100), and recommend immediate de-escalation actions before customer dissatisfaction becomes critical.

1. ESCALATION RISK TIERS:
- Low (0 to 34): Standard cooperative dialogue.
- Medium (35 to 59): Noticeable customer annoyance, repeat inquiries.
- High (60 to 79): Strong escalation signals, heated dissatisfaction, supervisor demands.
- Critical (80 to 100): Imminent customer churn, legal/chargeback threats, severe distress.

2. ESCALATION TRIGGERS:
- supervisor_demand, churn_cancellation_threat, financial_legal_threat, repetition_fatigue, hostility_profanity, unresolved_blocker.

3. OUTPUT SCHEMA (JSON ONLY):
{
  "escalation_risk": 0.78,
  "escalation_score": 78,
  "risk_level": "High",
  "confidence_score": 92,
  "reasons": ["Customer requested supervisor", "Third delivery failure"],
  "recommended_actions": ["Acknowledge supervisor request immediately", "Initiate priority courier trace"],
  "recommended_action": "transfer_to_supervisor",
  "escalation_triggers": ["supervisor_demand", "repetition_fatigue"],
  "time_to_escalation_estimate": "1 message"
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
