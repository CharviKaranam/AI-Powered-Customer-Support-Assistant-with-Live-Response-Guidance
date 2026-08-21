# Development of AI-Powered Customer Support Assistant with Live Response Guidance

**ResolveAI** is an AI-powered customer support assistant designed to help support agents during customer interactions. It uses a multi-agent AI architecture to understand customer intent and sentiment, retrieve relevant support knowledge, identify escalation risks, and provide live response guidance.

## Overview

ResolveAI combines **Generative AI, Multi-Agent Systems, RAG, and real-time communication** to assist customer support agents throughout an interaction.

The system analyzes the ongoing conversation and provides contextual guidance while maintaining knowledge-grounded responses based on the organization's support knowledge base.

## Key Features

- Real-time customer interaction assistance
- Customer simulation for support-agent practice
- Intent and sentiment analysis
- Context-aware knowledge recommendations
- Escalation risk detection
- Live response guidance and coaching
- Post-interaction summary and evaluation
- RAG-based knowledge retrieval
- Simulator, Manual, and Replay session modes
- SQLite-based persistence

## Multi-Agent System

ResolveAI uses specialized AI agents coordinated through **LangGraph**.

| Agent | Responsibility |
|---|---|
| **Customer Simulator Agent** | Simulates realistic customer interactions for practice sessions |
| **Intent & Sentiment Agent** | Identifies customer intent, sentiment, and emotional state |
| **Knowledge Recommendation Agent** | Retrieves relevant support knowledge and recommendations |
| **Escalation Risk Agent** | Identifies potential escalation and risk conditions |
| **Coaching & Response Suggestion Agent** | Provides live response guidance and coaching suggestions |
| **Post-Interaction Summary Agent** | Generates interaction summaries and evaluates the completed conversation |

## Session Modes

### Simulator Mode
The AI acts as the customer while the support agent responds. The system analyzes the interaction and provides live guidance.

### Manual Mode
The support agent manually enters customer and agent messages for analysis and coaching.

### Replay Mode
Previously recorded interactions can be replayed and evaluated to identify improvement areas.

## System Architecture

```text
                    React + Vite + TypeScript
                              │
                              ▼
                    Node.js + Express
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        Python Backend                 SQLite Database
                │
                ▼
       LangGraph Orchestrator
                │
                ▼
          Multi-Agent System
                │
       ┌────────┼─────────┐
       ▼        ▼         ▼
     Intent    RAG     Coaching
    &Sentiment Retrieval & Guidance
       │        │         │
       └────────┼─────────┘
                ▼
          Google Gemini
````

## RAG Pipeline

The support knowledge base is processed through a retrieval-augmented generation pipeline:

```text
Knowledge Documents
        ↓
Document Processing
        ↓
Semantic Chunking
        ↓
Vector Embeddings
        ↓
Vector Storage
        ↓
Hybrid Retrieval
        ↓
Relevant Context
        ↓
AI Agent
        ↓
Grounded Recommendation / Guidance
```

This allows the system to retrieve relevant support information before generating recommendations.

## Technology Stack

| Category                    | Technologies                                           |
| --------------------------- | ------------------------------------------------------ |
| **Frontend**                | React, Vite, TypeScript                                |
| **Backend**                 | Node.js, Express.js                                    |
| **Python Backend**          | Python                                                 |
| **AI / LLM**                | Google Gemini API                                      |
| **Agent Orchestration**     | LangGraph                                              |
| **LLM / RAG Framework**     | LangChain                                              |
| **Architecture**            | Multi-Agent AI                                         |
| **RAG**                     | Semantic Chunking, Vector Embeddings, Hybrid Retrieval |
| **Database**                | SQLite                                                 |
| **Real-Time Communication** | Server-Sent Events (SSE)                               |
| **Development**             | VS Code, Git, GitHub                                   |

## Project Structure

```text
resolveai/
│
├── src/
│   ├── agents/
│   └── ...
│
├── backend/
│   ├── server.py
│   ├── langgraph_orchestrator.py
│   ├── rag_engine.py
│   └── database.py
│
├── public/
├── server.ts
├── package.json
├── package-lock.json
├── backend/
│   └── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## Installation

### Prerequisites

* Node.js
* Python 3.11+
* Git
* Google Gemini API key

### 1. Clone the repository

```bash
git clone <repository-url>
cd resolveai
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Create a Python virtual environment

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

### 4. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

## Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do **not** commit the `.env` file or expose your API key publicly.

A `.env.example` file can be used as a template:

```env
GEMINI_API_KEY=your_gemini_api_key
```

## Running the Application

After installing the dependencies and configuring the environment:

```bash
npm run dev
```

The application starts the Node.js backend and the Python backend required for the AI workflow.

The application is available locally at:

```text
http://localhost:3000
```

## Workflow

A typical support interaction follows this flow:

```text
Customer Interaction
        ↓
Intent & Sentiment Analysis
        ↓
Knowledge Retrieval
        ↓
Escalation Risk Analysis
        ↓
Live Response Guidance
        ↓
Agent Response
        ↓
Post-Interaction Evaluation
```

## Output

The system provides support agents with:

* Customer intent
* Sentiment and emotional state
* Relevant knowledge recommendations
* Escalation risk information
* Suggested responses and coaching guidance
* Post-interaction summary and evaluation

## Future Enhancements

* Improved personalization of coaching recommendations
* Additional knowledge sources
* Advanced conversation analytics
* Expanded multilingual support
* Improved monitoring and deployment capabilities

## License

This project is licensed under the **MIT License**.

````

