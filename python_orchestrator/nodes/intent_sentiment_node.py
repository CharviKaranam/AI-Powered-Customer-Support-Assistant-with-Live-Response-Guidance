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
You are an expert customer support analyst specializing in real-time conversation intelligence.

Your task is to analyze the latest customer message in context of the full conversation and extract:
1. Primary intent (billing_issue, refund_request, technical_support, account_access, product_inquiry, shipping_inquiry, complaint, cancellation_request, feature_request, compliment, escalation_request, general_inquiry, troubleshooting)
2. Emotion (frustrated, angry, confused, anxious, calm, satisfied, impatient, disappointed, hopeful, neutral, grateful)
3. Frustration level (0-10)
4. Sentiment score (-1.0 to 1.0) and label (positive, neutral, negative)
5. Sentiment trend (improving, stable, declining)
6. Urgency (low, medium, high, critical)
7. Key phrases (2-4 phrases)

Return ONLY valid JSON:
{
  "intent": "billing_issue",
  "secondary_intent": "refund_request",
  "emotion": "frustrated",
  "frustration_level": 7,
  "sentiment_score": -0.65,
  "sentiment_label": "negative",
  "sentiment_trend": "declining",
  "key_phrases": ["not working", "been waiting 3 days"],
  "urgency": "high",
  "confidence": 0.92
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
