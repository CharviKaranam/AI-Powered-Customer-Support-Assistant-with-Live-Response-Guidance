import os
from typing import List, Dict, Any
from google import genai
from google.genai import types

MODELS_TO_TRY = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
]

SCENARIOS: List[Dict[str, Any]] = [
    {
        "id": "delayed_order",
        "name": "Delayed Order Delivery",
        "description": "Customer purchased a birthday gift for their child. The delivery was scheduled for yesterday but hasn't arrived. The customer is anxious and frustrated.",
        "difficulty": "Medium",
        "initialMood": "Anxious & Concerned",
        "initialFrustration": "Medium",
        "customerProfile": {
            "name": "Sarah Jenkins",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah"
        },
        "defaultGreeting": "Hi, I ordered a birthday gift for my son and it was supposed to arrive yesterday, but it's still not here! I am extremely stressed about this."
    },
    {
        "id": "refund_request",
        "name": "Out-of-Warranty Refund Request",
        "description": "Customer bought a smart speaker 45 days ago. The refund policy is strictly 30 days. The device stopped charging and they want a full refund.",
        "difficulty": "Medium",
        "initialMood": "Annoyed & Demanding",
        "initialFrustration": "Medium",
        "customerProfile": {
            "name": "Marcus Chen",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Marcus"
        },
        "defaultGreeting": "Hello, I bought a smart speaker 45 days ago but it's stopped charging completely. I know your policy says 30 days, but I want a full refund or a replacement right away."
    },
    {
        "id": "product_troubleshoot",
        "name": "Smart Hub Setup Failure",
        "description": "Customer is trying to connect a newly unboxed smart hub to their Wi-Fi router. It keeps blinking red and refusing to connect. They've spent an hour troubleshooting.",
        "difficulty": "High",
        "initialMood": "Extremely Frustrated",
        "initialFrustration": "High",
        "customerProfile": {
            "name": "David Vance",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=David"
        },
        "defaultGreeting": "Hello, I am trying to set up my smart hub. It's just blinking red and won't connect. I've been trying for an hour and nothing works. Please help."
    },
    {
        "id": "billing_double_charge",
        "name": "Duplicate Billing Charges",
        "description": "Customer noticed two identical pending charges of $59.99 on their credit card statement. They are furious and suspect a system glitch.",
        "difficulty": "High",
        "initialMood": "Angry & Suspicious",
        "initialFrustration": "High",
        "customerProfile": {
            "name": "Elena Rostova",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=Elena"
        },
        "defaultGreeting": "I just checked my credit card and I was charged $59.99 TWICE for the same item! This is unacceptable, please fix this system glitch immediately."
    },
    {
        "id": "account_lockout",
        "name": "Account Security Lockout",
        "description": "Customer was locked out of their work dashboard after typing the wrong 2FA code. They have an important presentation starting in 30 minutes.",
        "difficulty": "Easy",
        "initialMood": "Panicked & Concerned",
        "initialFrustration": "Low",
        "customerProfile": {
            "name": "James Carter",
            "avatarUrl": "https://api.dicebear.com/7.x/adventurer/svg?seed=James"
        },
        "defaultGreeting": "Hi, I'm locked out of my account due to too many 2FA attempts, but I have a huge presentation in 30 minutes! Please help me get back in!"
    }
]

async def simulate_customer_reply(
    scenario_id: str,
    agent_message: str,
    conversation_history: List[Dict[str, Any]]
) -> str:
    """Generates the next customer response adhering strictly to persona and emotion."""
    scenario = next((s for s in SCENARIOS if s["id"] == scenario_id), SCENARIOS[0])
    api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return f"Thank you for the update. My order number is #ORD-9821. How soon can this be completed?"

    client = genai.Client(api_key=api_key)

    transcript = "\n".join([
        f"[{m.get('sender', 'user').upper()}]: {m.get('text', '')}"
        for m in conversation_history[-6:]
    ])

    system_instruction = f"""
You are the "Customer Simulator Agent" roleplaying realistically as {scenario['customerProfile']['name']}.

[SCENARIO CONTEXT]:
- Problem Description: "{scenario['description']}"
- Initial Emotional State: {scenario['initialMood']}
- Simulation Difficulty: {scenario['difficulty']}

[BEHAVIORAL & PSYCHOLOGICAL DYNAMICS]:
- Stay 100% in character as a real human customer. Never reveal you are an AI or break character.
- Natural human typing style: Keep messages concise (1-3 sentences), direct, and emotionally authentic.
- Emotional Progression:
  * De-escalation: If the support agent demonstrates active empathy, validates your stress, cites company policy with care, and takes concrete resolution action (e.g. issues refund, runs live diagnostics, voids charges, initiates priority courier trace), your frustration decreases, and you express relief and satisfaction.
  * Escalation: If the agent provides canned robotic replies, repeats generic questions, shows indifference, or refuses to help, increase your frustration, express impatience, and demand to speak with a supervisor or threaten cancellation/chargeback.
- Specifics: If the agent asks for order number, email, or device details, provide realistic mock details (e.g. Order #ORD-9821, email sarah.j@email.com).
""".strip()

    prompt = f"CONVERSATION SO FAR:\n{transcript}\n\n[AGENT JUST SAID]: \"{agent_message}\"\n\nYOUR REPLY AS {scenario['customerProfile']['name']}:"

    for model_name in MODELS_TO_TRY:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=f"{system_instruction}\n\n{prompt}"
            )
            if response.text:
                return response.text.strip().replace('"', '')
        except Exception:
            continue

    return "Thank you for looking into this. Please let me know the exact confirmation code once it's done."
