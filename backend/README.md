# ResolveAI Python & LangGraph Backend

This folder contains the complete **Python Backend**, **LangGraph Multi-Agent Orchestrator**, and **SQLite SQL Database Engine** for the ResolveAI Support Readiness Simulation & QA Engine.

---

## 🏗️ Architecture & Orchestration Overview

```
                        [ Agent Message ]
                                |
                                v
               +----------------------------------+
               |  LangGraph Workflow StateGraph   |
               +----------------------------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
[ Node: Vector RAG ]                         [ Node: Customer Persona ]
(Retrieves Policy Excerpts)                  (Simulates Dynamic Emotion)
        |                                               |
        +-----------------------+-----------------------+
                                |
                                v
                [ Node: Escalation & Risk Evaluator ]
                (Triggers Warning & Intervention)
                                |
                                v
                [ Node: Copilot Coaching & Tone ]
                (Recommends Formal & Empathetic Tone)
                                |
                                v
                [ Node: SQLite State Consolidator ]
                (Persists Turn in resolve_ai.sqlite)
```

---

## 🚀 Running the Python Backend Locally

### Method 1: LangGraph & FastAPI (Full Multi-Agent Pipeline)
Run the complete LangGraph orchestrated backend with automatic Swagger / OpenAPI docs (`/docs`):

```bash
# 1. Install dependencies (including LangGraph & LangChain)
pip install -r backend/requirements.txt

# 2. Set your Gemini API Key
export GEMINI_API_KEY="your-gemini-api-key"

# 3. Start the FastAPI + LangGraph server
uvicorn backend.main_fastapi:app --reload --port 5005
```

---

### Method 2: Zero Dependencies (Built-in Standard Library)
You can run the Python backend with **no extra pip installations** using standard Python 3:

```bash
# From project root:
export GEMINI_API_KEY="your-gemini-api-key"
python3 backend/server.py 5005
```

---

## 🧠 LangGraph Multi-Agent Orchestrator (`langgraph_orchestrator.py`)

1. **`SimulationState`**: Typed state object tracking `session_id`, `conversation_history`, `retrieved_knowledge`, `customer_reaction`, `escalation_risk`, and `coaching_guidance`.
2. **`StateGraph` Nodes**:
   - `retrieve_knowledge_node`: Vector Cosine similarity retrieval over company policies.
   - `customer_persona_node`: LLM roleplay node reacting with emotional authenticity.
   - `sentiment_and_escalation_node`: Escalation risk and frustration calculation node.
   - `copilot_coaching_node`: Multi-tone generation node (Empathetic, Formal).
   - `finalize_turn_node`: State serialization and SQLite commitment.
3. **`QAEvaluationState` & Graph**: 7-dimensional QA evaluation scoring (Empathy, Policy Compliance, Efficiency, Professionalism, Solution Completeness).

---

## 🗄️ SQL Database Architecture (`database.py`)
- **Engine**: SQLite3 (`sqlite3` standard library)
- **Local File**: `resolve_ai.sqlite` (created automatically in project root)
- **Tables**:
  - `sessions`: Stores session ID, scenario, customer profile, resolution status, timestamps, and 7-dimensional QA evaluation reports.
  - `messages`: Stores individual dialogue turns, sender roles, timestamps, emotion/sentiment, frustration meters, escalation risk levels, and copilot suggestions.
  - `knowledge_articles`: Stores policy articles, categories, action steps, rules, and vector embeddings.
