import sqlite3
import json
import os
import time
from typing import Dict, List, Any, Optional

DB_FILE = os.path.join(os.getcwd(), "resolve_ai.sqlite")

INITIAL_KNOWLEDGE_BASE = [
    {
        "id": "kb_order_delay",
        "title": "Order Delay & Expedited Shipping Policy",
        "category": "Shipping & Fulfillment",
        "content": "When a customer's package is delayed past the estimated delivery window: 1. Express sincere empathy for the inconvenience. 2. Verify tracking status in warehouse system. 3. If delay exceeds 48 business hours, issue a full refund of shipping fees ($5.99). 4. Offer a $15 promotional goodwill discount code (RESOLVE15) for their subsequent purchase. 5. If delayed over 5 business days, offer immediate free priority express replacement.",
        "steps": [
            "Acknowledge the delivery delay with genuine empathy",
            "Verify tracking updates in courier logistics portal",
            "Refund original shipping cost ($5.99) automatically",
            "Provide $15 promo coupon code RESOLVE15",
            "Offer replacement re-shipment if lost or past 5 days"
        ],
        "rules": [
            "Never blame the carrier without acknowledging customer frustration",
            "Shipping fee refund limit: up to $15.00 per order",
            "Promotional goodwill discount limit: max $20.00"
        ]
    },
    {
        "id": "kb_refund_window",
        "title": "30-Day Standard Return & Warranty Exception Policy",
        "category": "Returns & Refunds",
        "content": "Standard return and refund window is 30 days from delivery date. For requests between 31 and 60 days: 1. Inquire about hardware fault details. 2. If item is defective due to manufacturer flaw, offer a free replacement or 50% store credit cashback. 3. Strict cash refunds past 30 days require supervisor escalation approval.",
        "steps": [
            "Check purchase invoice date",
            "Inspect device issue description and troubleshooting log",
            "Offer replacement unit under 1-year limited manufacturer warranty",
            "Offer 50% store credit balance ($15-$50) if refund insisted",
            "Escalate to tier-2 supervisor if customer demands cash refund >30 days"
        ],
        "rules": [
            "Standard full refund cutoff: 30 days",
            "Warranty exchange cutoff: 365 days (1 year limited)",
            "Store credit concession ceiling: $50 without supervisor sign-off"
        ]
    },
    {
        "id": "kb_billing_dispute",
        "title": "Duplicate Charges & Payment Discrepancy Resolution",
        "category": "Billing & Payments",
        "content": "When a customer reports duplicate charges on credit card statements: 1. Explain the difference between 'Pending Pre-authorization Hold' vs 'Settled Charge'. 2. Check billing portal for matching transaction IDs. 3. If a duplicate captured charge is confirmed, initiate immediate automatic refund (2-3 business days settlement). 4. Send email confirmation receipt with ARN tracking number.",
        "steps": [
            "Verify customer billing statement and account transaction logs",
            "Distinguish between temporary bank pre-authorization and captured settlement",
            "Process immediate reversal in payment gateway if double-billed",
            "Provide ARN (Acquirer Reference Number) for customer bank reference",
            "Follow up with confirmation email within 15 minutes"
        ],
        "rules": [
            "Direct duplicate charge refunds require no supervisor approval if verified",
            "Bank hold release takes 1-3 business days depending on customer's financial institution",
            "Never ask customer to disclose full 16-digit credit card number or CVV"
        ]
    },
    {
        "id": "kb_hardware_troubleshoot",
        "title": "Smart Hub & IoT Connectivity Troubleshooting Guide",
        "category": "Technical Support",
        "content": "Step-by-step resolution for Smart Hub pairing failure: 1. Ensure Wi-Fi network is 2.4GHz (5GHz is unsupported during setup). 2. Power cycle device by unplugging for 15 seconds. 3. Hold Reset button for 10 seconds until LED blinks Amber. 4. Disable VPN on mobile phone during initial pairing. 5. If issue persists, check router firewall settings for port 8883.",
        "steps": [
            "Confirm smartphone is connected to 2.4GHz Wi-Fi band",
            "Perform hardware power cycle (15-second cold restart)",
            "Perform factory reset via pinhole button (10-second hold)",
            "Disable active VPN/private DNS on mobile device during setup",
            "Verify LED status indicator transition from Blinking Red to Solid Green"
        ],
        "rules": [
            "5GHz Wi-Fi bands are not supported for initial device pairing",
            "Device must be within 15 feet of Wi-Fi router during setup phase",
            "Offer replacement if LED remains Solid Red after 2 factory resets"
        ]
    }
]

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        scenarioId TEXT,
        scenarioTitle TEXT,
        customerName TEXT,
        status TEXT DEFAULT 'active',
        interactionMode TEXT DEFAULT 'simulator',
        startedAt INTEGER,
        endedAt INTEGER,
        summary TEXT,
        postReport TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sentiment TEXT,
        frustrationScore INTEGER,
        emotionalState TEXT,
        escalationRisk TEXT,
        coachingOutput TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        steps TEXT,
        rules TEXT,
        embedding TEXT,
        createdAt INTEGER
    )
    """)

    # Auto-migrate schema if table exists from previous runs without certain columns
    try:
        cursor.execute("ALTER TABLE knowledge_articles ADD COLUMN createdAt INTEGER")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE knowledge_articles ADD COLUMN rules TEXT")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE knowledge_articles ADD COLUMN embedding TEXT")
    except Exception:
        pass

    conn.commit()
    cursor.execute("SELECT COUNT(*) FROM knowledge_articles")
    count = cursor.fetchone()[0]
    if count == 0:
        now = int(time.time() * 1000)
        for article in INITIAL_KNOWLEDGE_BASE:
            cursor.execute(
                "INSERT INTO knowledge_articles (id, title, category, content, steps, rules, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    article["id"],
                    article["title"],
                    article["category"],
                    article["content"],
                    json.dumps(article.get("steps", [])),
                    json.dumps(article.get("rules", [])),
                    now
                )
            )
        conn.commit()

    conn.close()

# Session DB Methods
def save_session(session_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()

    post_report_json = json.dumps(session_data.get("postReport")) if session_data.get("postReport") else None

    cursor.execute("""
    INSERT INTO sessions (id, scenarioId, scenarioTitle, customerName, status, interactionMode, startedAt, endedAt, summary, postReport)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        endedAt = excluded.endedAt,
        summary = excluded.summary,
        postReport = excluded.postReport
    """, (
        session_data.get("id"),
        session_data.get("scenarioId"),
        session_data.get("scenarioTitle"),
        session_data.get("customerName"),
        session_data.get("status", "active"),
        session_data.get("interactionMode", "simulator"),
        session_data.get("startedAt", int(time.time() * 1000)),
        session_data.get("endedAt"),
        session_data.get("summary"),
        post_report_json
    ))

    conn.commit()
    conn.close()

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    session = dict(row)
    if session.get("postReport"):
        try:
            session["postReport"] = json.loads(session["postReport"])
        except Exception:
            pass

    # Fetch messages
    cursor.execute("SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", (session_id,))
    msg_rows = cursor.fetchall()
    messages = []
    for m in msg_rows:
        msg = dict(m)
        if msg.get("coachingOutput"):
            try:
                msg["coachingOutput"] = json.loads(msg["coachingOutput"])
            except Exception:
                pass
        messages.append(msg)

    session["messages"] = messages
    conn.close()
    return session

def get_all_sessions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM sessions ORDER BY startedAt DESC")
    rows = cursor.fetchall()
    sessions = []

    for r in rows:
        session = dict(r)
        if session.get("postReport"):
            try:
                session["postReport"] = json.loads(session["postReport"])
            except Exception:
                pass

        # Load messages for this session
        cursor.execute("SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC", (session["id"],))
        msg_rows = cursor.fetchall()
        msgs = []
        for m in msg_rows:
            msg = dict(m)
            if msg.get("coachingOutput"):
                try:
                    msg["coachingOutput"] = json.loads(msg["coachingOutput"])
                except Exception:
                    pass
            msgs.append(msg)

        session["messages"] = msgs
        sessions.append(session)

    conn.close()
    return sessions

def save_message(message_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()

    coaching_json = json.dumps(message_data.get("coachingOutput")) if message_data.get("coachingOutput") else None

    cursor.execute("""
    INSERT INTO messages (id, sessionId, sender, text, timestamp, sentiment, frustrationScore, emotionalState, escalationRisk, coachingOutput)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        sentiment = excluded.sentiment,
        frustrationScore = excluded.frustrationScore,
        emotionalState = excluded.emotionalState,
        escalationRisk = excluded.escalationRisk,
        coachingOutput = excluded.coachingOutput
    """, (
        message_data.get("id"),
        message_data.get("sessionId"),
        message_data.get("sender"),
        message_data.get("text"),
        message_data.get("timestamp", int(time.time() * 1000)),
        message_data.get("sentiment"),
        message_data.get("frustrationScore"),
        message_data.get("emotionalState"),
        message_data.get("escalationRisk"),
        coaching_json
    ))

    conn.commit()
    conn.close()

def delete_session(session_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE sessionId = ?", (session_id,))
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

def clear_all_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages")
    cursor.execute("DELETE FROM sessions")
    conn.commit()
    conn.close()

# Knowledge Base DB Methods
def get_all_knowledge_articles() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM knowledge_articles ORDER BY createdAt DESC")
    except Exception:
        cursor.execute("SELECT * FROM knowledge_articles")
    rows = cursor.fetchall()
    articles = []

    for r in rows:
        art = dict(r)
        if art.get("steps"):
            try:
                art["steps"] = json.loads(art["steps"])
            except Exception:
                pass
        if art.get("rules"):
            try:
                art["rules"] = json.loads(art["rules"])
            except Exception:
                pass
        if art.get("embedding"):
            try:
                art["embedding"] = json.loads(art["embedding"])
            except Exception:
                pass
        articles.append(art)

    conn.close()
    return articles

def save_knowledge_article(article_data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()

    steps_json = json.dumps(article_data.get("steps", []))
    rules_json = json.dumps(article_data.get("rules", []))
    embedding_json = json.dumps(article_data.get("embedding")) if article_data.get("embedding") else None

    cursor.execute("""
    INSERT INTO knowledge_articles (id, title, category, content, steps, rules, embedding, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        content = excluded.content,
        steps = excluded.steps,
        rules = excluded.rules,
        embedding = excluded.embedding
    """, (
        article_data.get("id"),
        article_data.get("title"),
        article_data.get("category"),
        article_data.get("content"),
        steps_json,
        rules_json,
        embedding_json,
        article_data.get("createdAt", int(time.time() * 1000))
    ))

    conn.commit()
    conn.close()

def delete_knowledge_article(article_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM knowledge_articles WHERE id = ?", (article_id,))
    conn.commit()
    conn.close()

def get_database_stats() -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM sessions")
    sessions_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM messages")
    messages_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM knowledge_articles")
    knowledge_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM sessions WHERE postReport IS NOT NULL")
    reports_count = cursor.fetchone()[0]

    conn.close()

    return {
        "databaseEngine": "Python 3 SQLite Database Engine (sqlite3)",
        "filePath": DB_FILE,
        "sessionsCount": sessions_count,
        "messagesCount": messages_count,
        "knowledgeArticlesCount": knowledge_count,
        "reportsCount": reports_count,
        "isReady": True
    }
