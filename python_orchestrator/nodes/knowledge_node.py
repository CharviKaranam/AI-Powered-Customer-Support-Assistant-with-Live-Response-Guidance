import os
import json
from typing import Dict, Any, List
from google import genai
from google.genai import types
from python_orchestrator.state import SupportGraphState
from python_orchestrator.kb import KNOWLEDGE_BASE

MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
]

SYSTEM_PROMPT = """
You are a knowledge base assistant for a customer support team.

You have been given retrieved document chunks from the company's knowledge base.
Your task is to identify which chunks are most relevant to the customer's issue and
summarize them into clear, actionable information for the support agent.

OUTPUT SCHEMA:
{
  "query_used": "search query",
  "snippets": [
    {
      "content": "The relevant information text...",
      "source": "KB-101.txt",
      "document_title": "Standard Delivery Delays & Courier Investigation",
      "relevance_score": 0.92,
      "category": "Policy",
      "retrieval_reason": "Retrieved because customer inquired about late package shipment.",
      "relevant_section_summary": "Package delayed >3 days is eligible for replacement or full refund."
    }
  ],
  "context_summary": "Customer inquiry matches standard delivery delay guidelines."
}
""".strip()

def search_kb_fallback(query: str, intent: str) -> List[Dict[str, Any]]:
    query_lower = query.lower()
    intent_lower = intent.lower()
    scored = []
    
    for doc in KNOWLEDGE_BASE:
        score = 0.2
        doc_text = f"{doc['title']} {doc['content']} {' '.join(doc['steps'])}".lower()
        
        if ("delivery" in intent_lower and doc["category"] == "delayed_order") or \
           ("refund" in intent_lower and doc["category"] == "refund_request") or \
           ("technical" in intent_lower and doc["category"] == "product_troubleshoot") or \
           ("billing" in intent_lower and doc["category"] == "billing_issue") or \
           ("account" in intent_lower and doc["category"] == "account_access"):
            score += 0.5

        for word in query_lower.split():
            if len(word) > 3 and word in doc_text:
                score += 0.1
                
        score = min(0.98, max(0.2, score))
        scored.append((doc, score))
        
    scored.sort(key=lambda x: x[1], reverse=True)
    top_hits = scored[:2]
    
    recommendations = []
    category_map = {
        "delayed_order": "Policy",
        "refund_request": "Policy",
        "product_troubleshoot": "Troubleshooting",
        "billing_issue": "FAQ",
        "account_access": "SOP"
    }
    
    for doc, s in top_hits:
        recommendations.append({
            "title": doc["title"],
            "category": category_map.get(doc["category"], "Guide"),
            "summary": doc["content"][:130] + "...",
            "excerpt": "; ".join(doc["steps"][:2]) if doc["steps"] else doc["content"][:150],
            "relevance_score": round(s, 2),
            "reasoning": f"Matched category '{doc['category']}' for intent '{intent}'."
        })
    return recommendations

async def knowledge_node(state: SupportGraphState) -> Dict[str, Any]:
    """LangGraph Node: Retrieves and summarizes relevant SOP/KB articles."""
    current_msg = state.get("current_customer_message", "")
    intent_data = state.get("intent_sentiment", {}) or {}
    intent = intent_data.get("intent", "General Query")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        recs = search_kb_fallback(current_msg, intent)
        return {
            "knowledge_recommendations": {
                "recommendations": recs,
                "context_summary": f"Identified {len(recs)} standard knowledge guidelines."
            }
        }

    chunks_text = "\n\n".join([
        f"--- KB CHUNK {doc['id']}: {doc['title']} ---\nContent: {doc['content']}\nSteps: {' | '.join(doc['steps'])}"
        for doc in KNOWLEDGE_BASE
    ])

    user_prompt = f"CUSTOMER MESSAGE: \"{current_msg}\"\nDETECTED INTENT: {intent}\n\nKNOWLEDGE BASE CHUNKS:\n{chunks_text}\n\nReturn JSON knowledge recommendations."

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
                snippets = data.get("snippets", [])
                recs = []
                for s in snippets:
                    recs.append({
                        "title": s.get("document_title", "Knowledge Guide"),
                        "category": s.get("category", "Policy"),
                        "summary": s.get("relevant_section_summary", s.get("content", "")[:120]),
                        "excerpt": s.get("content", ""),
                        "relevance_score": float(s.get("relevance_score", 0.85)),
                        "reasoning": s.get("retrieval_reason", "Matched customer context.")
                    })
                return {
                    "knowledge_recommendations": {
                        "recommendations": recs,
                        "query_used": data.get("query_used", current_msg),
                        "context_summary": data.get("context_summary", "Knowledge retrieved successfully.")
                    }
                }
        except Exception:
            continue

    recs = search_kb_fallback(current_msg, intent)
    return {
        "knowledge_recommendations": {
            "recommendations": recs,
            "context_summary": f"Retrieved {len(recs)} relevant SOP procedures."
        }
    }
