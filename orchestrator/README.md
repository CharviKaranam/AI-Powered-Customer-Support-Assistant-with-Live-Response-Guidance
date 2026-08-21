# LangGraph Multi-Agent Support Orchestrator

This module provides the complete, production-grade **LangGraph** multi-agent orchestration layer for the Real-Time AI Support Assistant & Coaching platform.

---

## 🏗️ LangGraph Architecture Diagram

```
                     [ START ]
                         │
                         ▼
             ┌────────────────────────┐
             │ intent_sentiment_node  │
             └───────────┬────────────┘
                         │
       ┌─────────────────┴─────────────────┐
       │ (Parallel Execution Fan-out)      │
       ▼                                   ▼
┌──────────────────────┐      ┌─────────────────────────┐
│  knowledge_retrieval │      │   escalation_risk_node  │
│      node (RAG)      │      │                         │
└──────────┬───────────┘      └────────────┬────────────┘
           │                               │
           │                      [ Conditional Edge ]
           │                     /                    \
           │          (Critical Risk)             (Standard)
           │                 /                            \
           │                ▼                              ▼
           │      ┌──────────────────┐           ┌──────────────────┐
           │      │  escalate_alert  │           │  coaching_node   │
           │      │      node        │           │                  │
           │      └────────┬─────────┘           └────────┬─────────┘
           │               │                              │
           └───────────────┼──────────────────────────────┘
                           │
                           ▼
                        [ END ]
```

---

## 📁 Package Structure

```
orchestrator/
├── __init__.py
├── requirements.txt         # LangGraph, LangChain, Google GenAI, FastAPI, Pydantic
├── state.py                 # TypedDict SupportGraphState & Pydantic validation schemas
├── kb.py                    # Knowledge base repository (SOPs, FAQs, policies)
├── graph.py                 # Master StateGraph pipeline definition & memory checkpointer
├── server.py                # FastAPI HTTP REST API endpoints
├── run_demo.py              # Standalone CLI testing runner
└── nodes/
    ├── __init__.py
    ├── intent_sentiment_node.py    # Intent, emotion, frustration & sentiment trend analysis
    ├── knowledge_node.py           # RAG retrieval & contextual summarization
    ├── escalation_node.py          # Churn probability & supervisor trigger detection
    ├── coaching_node.py            # Real-time suggestions, tone scores & next best action
    └── summary_node.py             # Post-session QA rubric & performance audit report
```

---

## 🚀 Quickstart & Execution

### 1. Install Dependencies
```bash
pip install -r orchestrator/requirements.txt
```

### 2. Set Gemini API Key
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Run Standalone LangGraph Demo Turn
```bash
python -m orchestrator.run_demo
```

### 4. Start FastAPI Server
```bash
uvicorn orchestrator.server:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🔌 API Endpoints

- **`POST /api/langgraph/orchestrate`**: Runs the complete multi-agent graph with thread state persistence.
- **`POST /api/langgraph/summary`**: Generates a comprehensive post-interaction quality assurance and agent coaching report.
- **`GET /health`**: Health status check and Gemini configuration validation.
