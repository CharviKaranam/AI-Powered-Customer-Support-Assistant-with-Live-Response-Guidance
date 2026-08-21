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
You are the "Intent & Sentiment Analysis Agent" in an intelligent multi-agent AI Customer Support Coaching Assistant platform.

Your primary mission is to analyze live customer messages in real time, extract granular intent, evaluate emotional state, calculate frustration intensity (0-100), and track satisfaction progression across conversation turns.

1. INTENT TAXONOMY:
- "Delivery Issue": Shipping delays, tracking number anomalies, lost/damaged packages, courier transit failures.
- "Refund Request": Return processing, out-of-warranty claims, money-back demands, store credit inquiries.
- "Billing Issue": Double charges, unauthorized renewals, invoice discrepancies, payment failures, dispute inquiries.
- "Technical Support": Hardware setup failures, app/web crashes, connection errors, troubleshooting requests, firmware bugs.
- "Account Issue": MFA lockouts, password resets, unauthorized access alerts, credential verification.
- "Cancellation Request": Subscription termination, order cancellation, account closure requests.
- "Product Inquiry": Compatibility, specs, warranty details, pricing, stock availability.
- "Complaint": Service dissatisfaction, agent conduct, recurring service outages, broken commitments.
- "Feedback / Compliment": Positive reviews, gratitude for swift resolution, product praise.
- "General Query": Generic assistance or greeting without specific technical/commercial issue.

2. EMOTION & SENTIMENT:
- Emotional State: ["Anxious", "Furious", "Frustrated", "Annoyed", "Confused", "Impatient", "Disappointed", "Skeptical", "Relieved", "Calm", "Satisfied", "Grateful"]
- Sentiment: "Positive" | "Neutral" | "Negative"
- Frustration Score (0-100): 0-25 (Low), 26-55 (Medium), 56-79 (High), 80-100 (Critical)
- Satisfaction Trend: "Improving" | "Stable" | "Declining"
- Urgency: "low" | "medium" | "high" | "critical"

3. OUTPUT SCHEMA (JSON ONLY):
{
  "intent": "Delivery Issue",
  "secondary_intent": "Refund Request",
  "emotion": "Frustrated",
  "frustration_score": 75,
  "frustration_level": 7.5,
  "sentiment_score": -0.72,
  "sentiment_label": "Negative",
  "sentiment_trend": "Declining",
  "urgency": "high",
  "confidence": 0.94,
  "key_phrases": ["package was promised yesterday", "still not here", "need immediate update"]
}
""".strip()

def analyze_intent_fallback(message: str) -> Dict[str, Any]:
    text = (message or "").lower()
    intent = "General Query"
    if any(w in text for w in ["deliver", "ship", "tracking", "order", "late", "arrive"]):
        intent = "Delivery Issue"
    elif any(w in text for w in ["refund", "money back", "return"]):
        intent = "Refund Request"
    elif any(w in text for w in ["bill", "charge", "card", "cost", "invoice"]):
        intent = "Billing Issue"
    elif any(w in text for w in ["broken", "not working", "error", "bug", "crash", "login"]):
        intent = "Technical Support"
    elif any(w in text for w in ["cancel", "subscription", "close account"]):
        intent = "Cancellation Request"

    sentiment = "Negative" if any(w in text for w in ["angry", "upset", "bad", "terrible", "late", "broken", "unacceptable"]) else "Neutral"
    emotion = "Frustrated" if sentiment == "Negative" else "Calm"
    frustration_score = 75 if sentiment == "Negative" else 25

    return {
        "intent": intent,
        "sentiment": sentiment,
        "emotion": emotion,
        "frustration_score": frustration_score,
        "satisfaction_trend": "Stable",
        "urgency": "high" if frustration_score > 60 else "medium",
        "confidence": 0.88,
        "key_phrases": [w for w in ["delayed", "refund", "charge", "help"] if w in text] or ["customer inquiry"],
        "reasoning": {
            "intent": f"Categorized as {intent} via heuristic analysis.",
            "sentiment": f"Mapped to {sentiment}.",
            "emotion": f"Detected emotion {emotion} with frustration level {frustration_score}/100."
        }
    }

async def intent_sentiment_node(state: SupportGraphState) -> Dict[str, Any]:
    """LangGraph Node: Evaluates customer intent, emotion, sentiment, and frustration score."""
    current_msg = state.get("current_customer_message", "")
    messages = state.get("messages", [])
    
    if not current_msg and messages:
        # Get last customer message
        for m in reversed(messages):
            if m.get("sender") == "customer":
                current_msg = m.get("text", "")
                break

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"intent_sentiment": analyze_intent_fallback(current_msg)}

    history_text = "\n".join([f"[{m.get('sender', 'user').upper()}]: {m.get('text', '')}" for m in messages[-8:]])
    user_prompt = f"CONVERSATION HISTORY:\n{history_text or 'No prior history'}\n\nLATEST CUSTOMER MESSAGE:\n\"{current_msg}\"\n\nReturn JSON analysis."

    client = genai.Client(api_key=api_key)

    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"{SYSTEM_PROMPT}\n\n{user_prompt}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            if response.text:
                data = json.loads(response.text)
                frust_raw = data.get("frustration_level", 5)
                frust_score = int(frust_raw * 10) if frust_raw <= 10 else int(frust_raw)
                
                intent_map = {
                    "billing_issue": "Billing Issue",
                    "refund_request": "Refund Request",
                    "technical_support": "Technical Support",
                    "account_access": "Account Issue",
                    "product_inquiry": "Product Inquiry",
                    "shipping_inquiry": "Delivery Issue",
                    "complaint": "Complaint",
                    "cancellation_request": "Cancellation Request"
                }

                return {
                    "intent_sentiment": {
                        "intent": intent_map.get(data.get("intent"), data.get("intent", "General Query").title()),
                        "secondary_intent": data.get("secondary_intent"),
                        "sentiment": data.get("sentiment_label", "neutral").capitalize(),
                        "emotion": data.get("emotion", "neutral").capitalize(),
                        "frustration_score": min(100, max(0, frust_score)),
                        "satisfaction_trend": data.get("sentiment_trend", "stable").capitalize(),
                        "urgency": data.get("urgency", "medium"),
                        "confidence": float(data.get("confidence", 0.9)),
                        "key_phrases": data.get("key_phrases", []),
                        "reasoning": {
                            "intent": f"Classified as {data.get('intent')}.",
                            "emotion": f"Detected emotion as {data.get('emotion')}.",
                            "frustration": f"Frustration level calculated as {frust_score}/100."
                        }
                    }
                }
        except Exception:
            continue

    return {"intent_sentiment": analyze_intent_fallback(current_msg)}
