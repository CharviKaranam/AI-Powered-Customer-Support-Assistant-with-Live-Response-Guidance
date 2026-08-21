import asyncio
import os
import json
from python_orchestrator.graph import run_support_turn

async def main():
    print("=" * 70)
    print("🚀 Running LangGraph Multi-Agent Support Orchestrator (Python)")
    print("=" * 70)
    
    session_id = "test-session-langgraph-101"
    customer_message = "My SmartHub order KB-101 hasn't arrived in 4 days and tracking hasn't updated! I need this resolved or I want my money back."
    
    scenario_info = {
        "name": "SmartHub Delivery Delays",
        "description": "Customer order stalled in transit for 4 days",
        "customer_name": "Elena Rostova",
        "product": "SmartHub Gen 2",
        "persona": "frustrated",
        "difficulty": "Medium"
    }
    
    messages = [
        {"sender": "customer", "text": "Hello, I am checking on my recent order."},
        {"sender": "agent", "text": "Hello Elena! I would be happy to check that for you. What is your order number?"},
        {"sender": "customer", "text": customer_message}
    ]
    
    print(f"\n[Incoming Customer Message]: \"{customer_message}\"")
    print("\n⏳ Executing LangGraph state graph...")
    
    result = await run_support_turn(
        session_id=session_id,
        current_customer_message=customer_message,
        messages=messages,
        scenario_info=scenario_info
    )
    
    print("\n" + "=" * 70)
    print("📊 1. INTENT & SENTIMENT ANALYSIS NODE OUTPUT:")
    print(json.dumps(result.get("intent_sentiment"), indent=2))
    
    print("\n" + "=" * 70)
    print("📚 2. KNOWLEDGE BASE RAG NODE OUTPUT:")
    print(json.dumps(result.get("knowledge_recommendations"), indent=2))
    
    print("\n" + "=" * 70)
    print("⚠️ 3. ESCALATION RISK ASSESSMENT NODE OUTPUT:")
    print(json.dumps(result.get("escalation_risk"), indent=2))
    
    print("\n" + "=" * 70)
    print("💡 4. REAL-TIME COACHING AGENT NODE OUTPUT:")
    print(json.dumps(result.get("coaching_output"), indent=2))
    print("=" * 70)
    print("✅ LangGraph orchestration completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
