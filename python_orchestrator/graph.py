from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from python_orchestrator.state import SupportGraphState
from python_orchestrator.nodes.intent_sentiment_node import intent_sentiment_node
from python_orchestrator.nodes.knowledge_node import knowledge_node
from python_orchestrator.nodes.escalation_node import escalation_risk_node
from python_orchestrator.nodes.coaching_node import coaching_node
from python_orchestrator.nodes.summary_node import post_summary_node

def route_after_escalation_check(state: SupportGraphState) -> Literal["coaching", "escalate_alert"]:
    """Conditional Edge: Determines if critical risk triggers immediate supervisor routing."""
    if state.get("should_escalate_immediately", False):
        return "escalate_alert"
    return "coaching"

async def escalate_alert_node(state: SupportGraphState) -> Dict[str, Any]:
    """Node: Executed when escalation risk reaches Critical (manager transfer requested)."""
    esc_data = state.get("escalation_risk", {}) or {}
    return {
        "execution_route": "emergency_supervisor_escalation",
        "coaching_output": {
            "suggested_response": "I completely understand the urgency of your request. I am immediately transferring your case to a Senior Support Supervisor along with our complete chat history.",
            "response_quality": {
                "professionalism": 98,
                "empathy": 98,
                "clarity": 95,
                "completeness": 92,
                "courtesy": 98,
                "accuracy": 95,
                "actionability": 98
            },
            "coaching_tips": [
                "Acknowledge customer demand for management immediately without resistance.",
                "Do not attempt further troubleshooting; initiate warm transfer."
            ],
            "reasoning": f"Critical escalation triggered due to: {esc_data.get('reasoning')}",
            "tone_feedback": "Maintain calm, non-defensive demeanor during supervisor handoff.",
            "tone_score": 9.0,
            "empathy_rating": "high",
            "professionalism_rating": "high",
            "do_nots": ["Do not argue or delay the transfer", "Do not repeat questions already answered"],
            "next_best_action": "Execute 1-click warm transfer to Support Supervisor Queue."
        }
    }

def create_support_orchestration_graph():
    """
    Constructs the exact LangGraph Multi-Agent Orchestration Workflow:
    
            [START]
               │
               ▼
        [intent_sentiment]
          /            \
         / (Parallel)   \
        ▼                ▼
    [knowledge]    [escalation_risk]
        \                /
         \              / (Conditional Branch)
          ▼            ▼
     [route: coaching OR escalate_alert]
               │
               ▼
             [END]
    """
    workflow = StateGraph(SupportGraphState)

    # 1. Register Graph Nodes
    workflow.add_node("intent_sentiment", intent_sentiment_node)
    workflow.add_node("knowledge_retrieval", knowledge_node)
    workflow.add_node("escalation_risk", escalation_risk_node)
    workflow.add_node("coaching", coaching_node)
    workflow.add_node("escalate_alert", escalate_alert_node)
    workflow.add_node("post_summary", post_summary_node)

    # 2. Wire Graph Edges
    # Start -> Intent & Sentiment Analysis
    workflow.add_edge(START, "intent_sentiment")

    # Fan-out: Parallel execution of Knowledge Retrieval (RAG) and Escalation Risk assessment
    workflow.add_edge("intent_sentiment", "knowledge_retrieval")
    workflow.add_edge("intent_sentiment", "escalation_risk")

    # Fan-in: Wait for both Knowledge & Escalation analysis before proceeding
    workflow.add_conditional_edges(
        "escalation_risk",
        route_after_escalation_check,
        {
            "coaching": "coaching",
            "escalate_alert": "escalate_alert"
        }
    )
    workflow.add_edge("knowledge_retrieval", "coaching")

    # Final outputs route to END
    workflow.add_edge("coaching", END)
    workflow.add_edge("escalate_alert", END)
    workflow.add_edge("post_summary", END)

    # Compile Graph with In-Memory Checkpointer for session persistence
    memory = MemorySaver()
    compiled_app = workflow.compile(checkpointer=memory)
    return compiled_app

# Singleton instance of compiled graph
support_graph = create_support_orchestration_graph()

async def run_support_turn(
    session_id: str,
    current_customer_message: str,
    messages: list,
    scenario_info: dict = None
) -> SupportGraphState:
    """Executes a single conversational coaching turn through the LangGraph pipeline."""
    scenario_info = scenario_info or {}
    
    initial_state: SupportGraphState = {
        "session_id": session_id,
        "scenario_name": scenario_info.get("name", "Support Chat"),
        "scenario_description": scenario_info.get("description", ""),
        "customer_name": scenario_info.get("customer_name", "Valued Customer"),
        "product_name": scenario_info.get("product", "Smart Device"),
        "persona": scenario_info.get("persona", "neutral"),
        "difficulty": scenario_info.get("difficulty", "Medium"),
        "messages": messages,
        "current_customer_message": current_customer_message,
        "turn_count": len(messages) + 1,
        "status": "active"
    }

    config = {"configurable": {"thread_id": session_id}}
    final_state = await support_graph.ainvoke(initial_state, config=config)
    return final_state
