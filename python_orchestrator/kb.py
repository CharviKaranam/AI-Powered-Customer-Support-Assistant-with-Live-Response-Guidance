from typing import List, Dict, Any

KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "id": "KB-101",
        "title": "Standard Delivery Delays & Courier Investigation",
        "category": "delayed_order",
        "content": "Deliveries delayed by weather or courier logistics are investigated within 24-48 business hours. If a package is more than 3 business days late, agents are authorized to issue a priority replacement or a full refund including express shipping fees.",
        "steps": [
            "Verify tracking number against carrier API",
            "Confirm shipping address with customer",
            "Issue carrier trace ticket if package stalled >48h",
            "Offer replacement shipment or instant store credit if delayed >3 days"
        ]
    },
    {
        "id": "KB-102",
        "title": "Return & Refund Policy Guidelines",
        "category": "refund_request",
        "content": "Customers can request a refund within 30 days of item receipt. Items must be in original condition with packaging. Refunds to original payment methods take 3-5 business days. Return shipping is complimentary for defective items.",
        "steps": [
            "Check order purchase date for 30-day window",
            "Generate pre-paid return label for customer",
            "Initiate refund processing upon courier first scan",
            "Send confirmation email with refund transaction ARN"
        ]
    },
    {
        "id": "KB-103",
        "title": "SmartHub Hardware Connectivity & Factory Reset",
        "category": "product_troubleshoot",
        "content": "SmartHub connectivity failure is resolved by holding the rear pinhole reset button for 10 seconds until the LED pulses amber. Ensure 2.4GHz Wi-Fi is enabled on the router with WPA2/WPA3 security.",
        "steps": [
            "Power cycle device for 30 seconds",
            "Perform factory reset (press rear button 10s)",
            "Verify router 2.4GHz SSID visibility",
            "Re-pair via mobile application under Settings -> Add Device"
        ]
    },
    {
        "id": "KB-104",
        "title": "Duplicate Charges & Billing Disputes",
        "category": "billing_issue",
        "content": "Pending authorization holds may appear as duplicate transactions. If duplicate settled charges occur, agent must verify transaction IDs in Stripe and initiate an immediate reversal. Voided authorizations clear in 24-72 hours.",
        "steps": [
            "Inspect customer billing ledger in Stripe dashboard",
            "Distinguish between pre-auth holds and captured payments",
            "Execute one-click refund for duplicate settled charge",
            "Provide customer with Stripe refund reference code"
        ]
    },
    {
        "id": "KB-105",
        "title": "Account Access & 2FA Lockout Recovery",
        "category": "account_access",
        "content": "Account lockout occurs after 5 failed password attempts. Self-service password reset email is sent instantly. For 2FA lockout, secondary email verification or security question verification is required by a Tier-1 support agent.",
        "steps": [
            "Send password reset magic link to registered email",
            "Verify identity via last 4 digits of billing card or phone SMS OTP",
            "Temporarily disable 2FA for 15 minutes to allow re-enrollment",
            "Log security audit note in customer profile"
        ]
    }
]
