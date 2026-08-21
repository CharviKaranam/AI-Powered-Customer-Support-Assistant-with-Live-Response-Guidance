# ResolveAI - Real-Time AI Support Assistant & Coaching (Python)

A full-stack, enterprise-grade Customer Support AI Multi-Agent & Live Coaching platform built **100% in Python** using **LangGraph**, **FastAPI**, **Google Gemini**, and **SQLite**.

---

## 🏗️ Architecture Overview

The system runs a **LangGraph StateGraph multi-agent pipeline** on every customer turn:

```
                  ┌───────────────────────────────┐
                  │      Incoming Message         │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ 1. Intent & Sentiment Node   │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ 2. Knowledge Retrieval (RAG)  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ 3. Escalation Risk Node       │
                  └──────────────┬────────────────┘
                                 │
                   [Conditional Routing Check]
                     /                      \
      (Standard / Resolved)            (Critical Risk / Urgent)
                   /                          \
                  ▼                            ▼
┌───────────────────────────────┐  ┌───────────────────────────────┐
│ 4. Real-Time Coaching Node    │  │ 🚨 Critical Alert Trigger     │
└──────────────┬────────────────┘  └──────────────┬────────────────┘
               │                                  │
               └─────────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │  Live 3-Panel Console & DB    │
                  └───────────────────────────────┘
                                 │
                       (Session Completion)
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │ 5. Post-Summary & QA Audit    │
                  └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── main.py                      # Master FastAPI Web Application & UI Server
├── requirements.txt             # Project Python dependencies
├── resolve_ai.sqlite            # SQLite Database for message history & QA reports
└── orchestrator/
    ├── __init__.py              # Package init
    ├── state.py                 # Pydantic and TypedDict Graph state definitions
    ├── graph.py                 # LangGraph StateGraph pipeline definition
    ├── db.py                    # Python SQLite persistence layer
    ├── kb.py                    # Knowledge base repository (SOPs, FAQs, policies)
    ├── simulator.py             # Customer persona simulation engine
    ├── server.py                # Standalone FastAPI API server
    ├── run_demo.py              # Standalone CLI interactive test runner
    ├── README.md                # Orchestrator deep dive documentation
    └── nodes/
        ├── __init__.py
        ├── intent_sentiment_node.py    # Intent categorization & sentiment tracker
        ├── knowledge_node.py           # RAG retrieval & contextual summarization
        ├── escalation_node.py          # Churn probability & supervisor triggers
        ├── coaching_node.py            # Next best action & communication rubric
        └── summary_node.py             # Post-session QA performance scoring
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
Set your Gemini API Key:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Launch Full-Stack Python App
```bash
python main.py
```
Open your browser at `http://localhost:3000` to access the full interactive 3-panel console!

### 4. Run CLI Turn Simulation
```bash
python -m orchestrator.run_demo
```
