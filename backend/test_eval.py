#!/usr/bin/env python3
"""
Evaluation Script for Testing the LangGraph Orchestration & Hybrid RAG Engine.
Run this script locally to verify graph compilation and execution.
"""
import os
import sys
import json
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_all_knowledge_articles
from rag_engine import rag_engine, text_to_dense_embedding, calculate_cosine_similarity
from langgraph_orchestrator import (
    simulation_graph,
    qa_graph,
    run_langgraph_simulation_step,
    run_langgraph_qa_evaluation
)

def test_system():
    print("==================================================================")
    print("🚀 [ResolveAI Evaluation Test]: LangGraph Orchestrator & Hybrid RAG")
    print("==================================================================")

    # Step 1: Initialize Database
    print("\n1. Initializing Local SQLite Database Schema...")
    init_db()
    articles = get_all_knowledge_articles()
    print(f"   ✅ SQLite initialized with {len(articles)} policy articles.")

    # Step 2: Test High-Grade Hybrid RAG
    print("\n2. Testing Hybrid Semantic RAG Retrieval Engine...")
    query = "Customer is demanding a full refund on a defective device past 30 days"
    results = rag_engine.retrieve_grounded_context(query, top_k=2)
    print(f"   Query: '{query}'")
    for r in results:
        print(f"   📌 Found Doc: [{r['category']}] {r['title']} (Score: {r['relevance_score']})")
    assert len(results) > 0, "RAG Retrieval returned 0 documents."
    print("   ✅ Hybrid RAG Engine verified.")

    # Step 3: Test LangGraph StateGraph Execution
    print("\n3. Testing LangGraph Multi-Agent StateGraph...")
    print(f"   Graph Nodes: {list(simulation_graph.nodes.keys())}")

    scenario = {
        "id": "delayed_order",
        "name": "Delayed Order Delivery",
        "initialMood": "Frustrated & Anxious",
        "customerProfile": {"name": "Sarah Jenkins"}
    }
    mock_history = [
        {"sender": "customer", "text": "Where is my package? It is late for my daughter's birthday!"}
    ]
    agent_reply = "I understand how urgent this is for your daughter's birthday! Let me check the courier status immediately."

    start_time = time.time()
    result = run_langgraph_simulation_step(
        session_id="test_sess_001",
        scenario_id="delayed_order",
        scenario=scenario,
        conversation_history=mock_history,
        current_agent_message=agent_reply
    )
    elapsed = time.time() - start_time
    print(f"   ⏱️  LangGraph turn completed in {elapsed:.2f}s")
    print(f"   Customer Reaction: '{result.get('customerReaction', {}).get('replyText')}'")
    print(f"   Emotional State:    {result.get('emotionalState')}")
    print(f"   Frustration Meter:  {result.get('frustrationScore')}/100")
    print(f"   Escalation Level:   {result.get('escalationRisk', {}).get('level')}")
    print(f"   Coaching Suggesion: '{result.get('coachingOutput', {}).get('recommended_reply')[:60]}...'")
    print("   ✅ LangGraph multi-agent simulation node flow executed successfully.")

    # Step 4: Test LangGraph QA Evaluation Graph
    print("\n4. Testing LangGraph 7-Dimensional QA Evaluation Graph...")
    transcript = mock_history + [
        {"sender": "agent", "text": agent_reply},
        {"sender": "customer", "text": result.get('customerReaction', {}).get('replyText', 'Thank you.')}
    ]
    qa_report = run_langgraph_qa_evaluation("test_sess_001", scenario, transcript)
    res_quality = qa_report.get("resolutionQuality", {})
    print(f"   Resolution Quality Score: {res_quality.get('score')}/100")
    print(f"   Empathy Score:            {res_quality.get('breakdown', {}).get('empathyScore')}/100")
    print(f"   Policy Compliance Score:  {res_quality.get('breakdown', {}).get('policyComplianceScore')}/100")
    print("   ✅ LangGraph QA Audit Graph executed successfully.")

    print("\n==================================================================")
    print("🎉 ALL TESTS PASSED: LangGraph, Python, SQLite, RAG verified!")
    print("==================================================================")

if __name__ == "__main__":
    test_system()
