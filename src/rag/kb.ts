import { KBArticle, KBChunk, RAGSearchResult } from '../types.js';

// Realistic, comprehensive enterprise customer support knowledge base
export const INITIAL_KNOWLEDGE_BASE: KBArticle[] = [
  {
    id: 'KB-SHP-001',
    category: 'delayed_order',
    title: 'Carrier Transit Delays, Status Scans & Investigation SLA',
    sourceDoc: 'shipping_carrier_operations_sop.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: '$5.99 Shipping Refund or $15 Coupon',
    lastUpdated: '2026-08-01',
    applicableProducts: ['All Physical Orders', 'Hardware Devices', 'Smart Hubs', 'Accessories'],
    tags: ['shipping', 'carrier', 'delay', 'transit', 'ups', 'fedex', 'usps', 'tracking', 'scan', 'eta'],
    content: 'Carrier transit delays can occur due to severe weather, hub sorting congestion, customs clearances, or address validation holds. Support agents must verify the latest carrier scan timestamp in the internal fulfillment portal. If a package has shown no transit movement for more than 48 business hours, an automated carrier inquiry ticket is initiated. Always reassure the customer, confirm their delivery address, and provide direct carrier tracking links.',
    steps: [
      'Query the order number in the fulfillment database and verify the carrier tracking identifier.',
      'Check the latest scan timestamp; explain that carrier scan updates often batch every 24-48 hours.',
      'Confirm the recipient address on file to rule out delivery address discrepancies.',
      'If the tracking has shown zero movement for >48 hours, file a carrier trace request in CRM.',
      'Assure the customer that the order is tracked and set a follow-up alert for 24 hours.'
    ]
  },
  {
    id: 'KB-SHP-002',
    category: 'delayed_order',
    title: 'Goodwill Compensation Framework for Shipping Delays',
    sourceDoc: 'shipping_compensation_matrix.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: '$15 Coupon Code (RESOLVE15) or $5.99 Express Shipping Refund',
    lastUpdated: '2026-08-05',
    applicableProducts: ['All Physical Orders', 'Express Shipping Orders'],
    tags: ['compensation', 'goodwill', 'coupon', 'delayed_order', 'discount', 'refund_shipping', 'late_delivery'],
    content: 'When an order fails to arrive within the guaranteed delivery window or causes significant customer friction (e.g. birthday gifts, holiday events), frontline agents have pre-authorized discretion to provide instant goodwill compensation without requiring supervisor sign-off. If express shipping was paid, immediately refund the $5.99 shipping fee. For standard shipping delays, issue a $15 discount coupon code (RESOLVE15) for their next purchase.',
    steps: [
      'Validate that the order delivery date has surpassed the estimated delivery window.',
      'Acknowledge the customer frustration empathetically and apologize for the inconvenience.',
      'If customer paid for Expedited/Express shipping, issue an immediate $5.99 shipping fee refund in Stripe.',
      'If customer used standard shipping or needs compensation for urgency, provide coupon code RESOLVE15 ($15 off).',
      'Log the compensation code in CRM interaction notes under "Shipping Goodwill Credit".'
    ]
  },
  {
    id: 'KB-RET-001',
    category: 'refund_request',
    title: 'Standard 30-Day Return & Full Cash Refund Policy',
    sourceDoc: 'returns_refunds_policy_2026.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: '100% Original Transaction Amount',
    lastUpdated: '2026-07-15',
    applicableProducts: ['All Physical Hardware', 'Smart Speakers', 'Smart Hubs', 'Sensors'],
    tags: ['refund', 'return', '30_days', 'prepaid_label', 'rma', 'full_refund', 'unopened'],
    content: 'Customers are eligible for a 100% full refund to their original payment method for items returned within 30 calendar days of confirmed carrier delivery. Items must be in original condition with included accessories and power adapters. Return shipping is 100% covered by the company; agents generate and email a prepaid digital shipping label (QR code / printable PDF). Refunds are credited back to the customer bank within 3 to 5 business days after warehouse scanning.',
    steps: [
      'Verify the delivery timestamp in the order CRM to confirm it falls within the 30-day window.',
      'Confirm customer has the original device and essential packaging components.',
      'Generate a prepaid Return Merchandise Authorization (RMA) shipping label in the returns portal.',
      'Email the prepaid return shipping label and instructions to the customer verified email.',
      'Explain that the refund is automatically disbursed within 3-5 business days of return receipt.'
    ]
  },
  {
    id: 'KB-RET-002',
    category: 'refund_request',
    title: 'Out-of-Warranty & Opened Device Exception Matrix',
    sourceDoc: 'warranty_exceptions_guide.md',
    authorityLevel: 'Tier 1 Frontline & Tier 2 Senior',
    maxCompensation: 'Up to 50% Store Credit or Direct Hardware Exchange',
    lastUpdated: '2026-07-28',
    applicableProducts: ['Smart Speakers', 'Smart Hubs', 'Sensors', 'Electronics'],
    tags: ['out_of_warranty', 'store_credit', 'exchange', 'exception', 'opened_box', 'partial_refund'],
    content: 'For products between 31 and 90 days past purchase or devices that are opened and used, direct cash refunds cannot be processed automatically. Support representatives are authorized to offer two immediate resolution paths: (1) Free hardware warranty exchange for a brand-new identical unit, or (2) Store credit voucher worth up to 50% of the original retail purchase value. Escalation to a supervisor is reserved only for repeat defective unit failures.',
    steps: [
      'Politely inform the customer of the 30-day full cash refund limitation in a warm, respectful tone.',
      'Check if the device has a manufacturing defect and offer a direct warranty hardware replacement.',
      'If the customer prefers compensation without returning, offer up to 50% store credit cashback.',
      'If customer accepts store credit, issue promo gift code via the billing dashboard.',
      'Escalate to Tier 2 Lead only if customer rejects both options and demands a cash exception.'
    ]
  },
  {
    id: 'KB-TRB-001',
    category: 'product_troubleshoot',
    title: 'Smart Home Hub Factory Reset & Diagnostic Power Cycle',
    sourceDoc: 'hardware_hub_troubleshooting_guide.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Free Warranty Replacement if Hardware Dead',
    lastUpdated: '2026-08-02',
    applicableProducts: ['Smart Home Hub V2/V3', 'IoT Bridge'],
    tags: ['smart_hub', 'factory_reset', 'led', 'blinking_red', 'power_cycle', 'pinhole', 'offline', 'boot'],
    content: 'When the Smart Home Hub displays a blinking red or solid amber LED light and fails to pair with the mobile application, it indicates a corrupted network cache or failed handshake. A full factory reset restores device firmware to default state and clears stale DHCP leases. The procedure requires disconnecting the power adapter, holding the rear pinhole reset button for 15 continuous seconds while reconnecting power, and waiting for the LED to pulse blue.',
    steps: [
      'Instruct the customer to disconnect the power adapter from the rear of the Smart Hub.',
      'Locate the recessed pinhole reset button on the bottom or rear casing of the hub.',
      'Using a paperclip or SIM ejector tool, press and firmly hold the reset button.',
      'While holding the button, re-insert the power cable and continue holding for 15 seconds.',
      'Release the button when the LED indicator flashes solid amber, then wait for the pulsing blue pairing mode.'
    ]
  },
  {
    id: 'KB-TRB-002',
    category: 'product_troubleshoot',
    title: 'Wi-Fi Network Frequency Compatibility (2.4GHz vs 5GHz)',
    sourceDoc: 'wifi_mesh_network_sop.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'N/A (Technical Guidance)',
    lastUpdated: '2026-07-20',
    applicableProducts: ['Smart Hubs', 'Smart Speakers', 'Smart Plugs', 'Wi-Fi Sensors'],
    tags: ['wifi', '2.4ghz', '5ghz', 'dual_band', 'router', 'ssid', 'mesh', 'vpn', 'ap_isolation'],
    content: 'Smart Home Hubs and IoT peripheral accessories operate exclusively on standard 2.4GHz Wi-Fi (802.11 b/g/n) frequencies for extended range and wall penetration. Modern dual-band and mesh routers that combine 2.4GHz and 5GHz under a single unified SSID will frequently drop IoT pairing requests. The customer smartphone must be connected to the 2.4GHz network band during initial provisioning, and any active VPN, private relay, or cellular data should be temporarily disabled.',
    steps: [
      'Ask the customer if their home router broadcasts separate 2.4GHz and 5GHz network names (SSIDs).',
      'Advise them to temporarily switch their smartphone Wi-Fi connection to the 2.4GHz network.',
      'Instruct the customer to disable any active VPNs, Apple Private Relay, or cellular data during setup.',
      'If using a mesh router with combined SSIDs, guide them to temporarily separate bands in router settings.',
      'Re-launch the mobile application pairing wizard once on the dedicated 2.4GHz frequency.'
    ]
  },
  {
    id: 'KB-BIL-001',
    category: 'billing_issue',
    title: 'Duplicate Billing Charges vs Pending Authorization Holds',
    sourceDoc: 'billing_disputes_and_authorization_holds.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Instant Void of Pending Hold / Full Refund of Duplicate',
    lastUpdated: '2026-08-08',
    applicableProducts: ['All Online Orders', 'Subscription Plans', 'Hardware Purchases'],
    tags: ['billing', 'duplicate_charge', 'pending_hold', 'double_charge', 'stripe', 'bank_statement', 'auth_hold'],
    content: 'When a transaction is submitted online, banking networks immediately place a "Pending Authorization Hold" to reserve funds. If a checkout attempt timed out or was retried, two pending items may appear on the customer banking app. In over 95% of cases, only one transaction has actually settled, while the second pending hold will automatically drop off without debiting funds within 3 to 5 business days. Agents can verify the settled status in Stripe.',
    steps: [
      'Look up the customer account and payment transaction history in Stripe / Payment Portal.',
      'Inspect the charges to determine if two transactions are "Captured / Succeeded" or if one is "Pending / Voided".',
      'If one is merely a pending hold, explain bank hold mechanics and assure them no extra money was taken.',
      'If a duplicate charge was genuinely captured twice in error, execute an instant one-click refund in Stripe.',
      'Provide the Stripe Refund Reference ID and explain bank posting timelines (2-5 business days).'
    ]
  },
  {
    id: 'KB-BIL-002',
    category: 'billing_issue',
    title: 'Subscription Cancellation, Auto-Renewal & Prorated Refunds',
    sourceDoc: 'subscription_lifecycle_and_billing_sop.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Full Prorated Refund within 48h of Auto-Renewal',
    lastUpdated: '2026-08-04',
    applicableProducts: ['Cloud Storage Subscription', 'ResolveAI Pro Plan', 'Smart Monitoring Plan'],
    tags: ['subscription', 'cancellation', 'auto_renewal', 'prorated_refund', 'saas', 'recurring_billing'],
    content: 'Customers may cancel recurring subscription plans at any time from their account dashboard or via support. Cancellations prevent any future billing cycles. If a customer was unexpectedly charged due to an automatic annual or monthly renewal and requests a cancellation within 48 hours of the charge, agents are authorized to immediately cancel the subscription and issue a 100% full refund for the renewal invoice.',
    steps: [
      'Verify customer account email and active subscription tier in the billing administration console.',
      'Check the renewal charge timestamp; confirm it occurred within the 48-hour grace period.',
      'Toggle "Cancel Subscription Immediately" in the billing portal to prevent upcoming invoices.',
      'Click "Issue Full Refund" on the renewal transaction ID and select "Customer Requested Cancellation".',
      'Send an automated cancellation and refund confirmation email receipt.'
    ]
  },
  {
    id: 'KB-SEC-001',
    category: 'account_access',
    title: 'Two-Factor Authentication (2FA) Identity Verification Override',
    sourceDoc: 'account_security_and_mfa_reset_sop.md',
    authorityLevel: 'Tier 1 Frontline Support (with Verification)',
    maxCompensation: 'Instant Security Unlock',
    lastUpdated: '2026-08-10',
    applicableProducts: ['ResolveAI Cloud Portal', 'User Account', 'Enterprise Dashboard'],
    tags: ['account_lockout', '2fa', 'mfa', 'security', 'identity_verification', 'unlock', 'authenticator'],
    content: 'To protect customer accounts from unauthorized takeover while assisting legitimate users who lost their authenticator device or phone, agents must complete a strict 3-point identity verification before overriding 2FA settings. The agent must verify: (1) Account primary email, (2) Billing zip/postal code or billing address, and (3) Last 4 digits of the payment method or secondary phone number on file. Once verified, 2FA can be temporarily suspended for 60 minutes.',
    steps: [
      'Request the customer to verify their full name, primary account email, and billing address zip code.',
      'Request the last 4 digits of the credit card on file or the secondary phone number registered.',
      'Once 3 data points match account records, navigate to Admin Security Controls and select "Temporary 2FA Override".',
      'Provide the customer with a one-time 15-minute temporary login token.',
      'Instruct the customer to configure a new Authenticator app immediately in their Security Settings.'
    ]
  },
  {
    id: 'KB-SEC-002',
    category: 'account_access',
    title: 'Password Reset Escalation & Account Lockout Clearance',
    sourceDoc: 'password_reset_and_security_lockout.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Instant Account Unlock',
    lastUpdated: '2026-08-03',
    applicableProducts: ['User Account', 'Web Portal', 'Mobile App'],
    tags: ['password_reset', 'lockout', 'failed_logins', 'recovery_link', 'incognito', 'security'],
    content: 'Accounts are automatically placed in a protective security lockout state after 5 consecutive incorrect password attempts. The lockout duration is 60 minutes by default. Support agents can manually clear the lockout flag in real time and dispatch an encrypted one-time password reset link to the customer verified email. The recovery link expires after 15 minutes and must be accessed in a clean browser window.',
    steps: [
      'Search for the user record in the customer database using their registered email.',
      'Click "Clear Failed Login Lockout" to reset the consecutive attempt counter to zero.',
      'Trigger an automated secure password reset email from the administrative panel.',
      'Advise the customer to check their inbox (including spam/promotions folder) for the reset link.',
      'Instruct them to open the link in a private/incognito window to avoid cached browser credentials.'
    ]
  },
  {
    id: 'KB-CLM-001',
    category: 'product_troubleshoot',
    title: 'Damaged Goods in Transit Claim & Expedited Replacement',
    sourceDoc: 'damaged_shipments_and_insurance_claims.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Free Zero-Dollar Expedited Replacement Unit',
    lastUpdated: '2026-08-07',
    applicableProducts: ['All Physical Hardware', 'Smart Speakers', 'Smart Hubs', 'Accessories'],
    tags: ['damaged', 'broken', 'transit_damage', 'replacement', 'carrier_claim', 'photo_verification', 'box'],
    content: 'If an item arrives damaged, cracked, or defective due to transit mishandling, the customer is entitled to an immediate zero-dollar priority replacement. Frontline support agents can approve replacement orders upon receiving photo confirmation of the damaged item and the shipping container. The customer is not required to return broken glass or hazardous damaged goods.',
    steps: [
      'Express sincere empathy for the damaged delivery and prioritize swift resolution.',
      'Request the customer to upload or email a photo of the damaged product and outer shipping box.',
      'Verify the original order number and confirm the matching SKU in the inventory system.',
      'Generate a zero-dollar priority expedited replacement order with 1-2 day express shipping.',
      'File an automated shipping insurance carrier damage claim using the provided photos.'
    ]
  },
  {
    id: 'KB-PRC-001',
    category: 'refund_request',
    title: 'Price Match Guarantee & 14-Day Post-Purchase Price Adjustment',
    sourceDoc: 'price_match_and_promotion_adjustment_policy.md',
    authorityLevel: 'Tier 1 Frontline Support',
    maxCompensation: 'Direct Refund of Difference up to $100',
    lastUpdated: '2026-07-25',
    applicableProducts: ['All Hardware', 'Accessories', 'Official Store Products'],
    tags: ['price_match', 'price_drop', 'adjustment', 'promotion', 'competitor', 'refund_difference'],
    content: 'If an item purchased from our store drops in price or goes on promotion within 14 calendar days of the original purchase date, customers are eligible for a 100% price adjustment refund for the difference. We also match active advertised prices from authorized major retailers (Amazon, Best Buy, Target) for identical new-in-box SKUs. The difference is refunded directly to the original payment method.',
    steps: [
      'Check the customer original purchase invoice date to verify it is within the 14-day window.',
      'Verify the lower price URL or promotional code to confirm identical model SKU and active in-stock status.',
      'Calculate the exact price difference including applicable taxes.',
      'Process a partial refund in the payment portal referencing "14-Day Price Drop Adjustment".',
      'Confirm the refunded difference and updated invoice receipt with the customer.'
    ]
  },
  {
    id: 'KB-VIP-001',
    category: 'vip_exceptions',
    title: 'VIP & High-Lifetime-Value Customer Escalation Protocol',
    sourceDoc: 'vip_customer_care_standards.md',
    authorityLevel: 'Tier 2 Senior & Supervisor',
    maxCompensation: 'Up to $50 Credit or Free Express Overnight Replacement',
    lastUpdated: '2026-08-09',
    applicableProducts: ['All Enterprise Accounts', 'VIP Tier Members', 'High LTV Customers'],
    tags: ['vip', 'enterprise', 'high_ltv', 'courtesy', 'white_glove', 'escalation', 'loyalty'],
    content: 'Customers with VIP loyalty tier status (over $500 lifetime spend or active Enterprise subscription) receive dedicated white-glove support routing. For high-tier customers experiencing repeated friction or multi-day delays, agents are empowered to waive standard return windows up to 120 days, provide overnight replacement hardware at zero cost, or grant up to $50 in account courtesy credits.',
    steps: [
      'Check customer CRM profile badge to verify VIP / Enterprise account tier status.',
      'Acknowledge and thank them for their valued loyalty at the beginning of the interaction.',
      'Apply white-glove exception rules (overnight shipping, waived return shipping, extended windows).',
      'Offer up to $50 account credit or personalized dedicated direct line follow-up.',
      'Notify the Account Management team with a brief interaction summary note.'
    ]
  },
  {
    id: 'KB-SEC-003',
    category: 'account_access',
    title: 'Data Privacy (GDPR/CCPA) & Right to Erasure Request Handling',
    sourceDoc: 'data_privacy_gdpr_ccpa_compliance_sop.md',
    authorityLevel: 'Tier 1 Intake / Privacy Operations Team',
    maxCompensation: 'Compliance SLA Fulfillment',
    lastUpdated: '2026-07-10',
    applicableProducts: ['User Account Data', 'Customer Analytics', 'Marketing Profiles'],
    tags: ['gdpr', 'ccpa', 'privacy', 'data_deletion', 'right_to_erasure', 'dsar', 'compliance'],
    content: 'Under GDPR and CCPA privacy frameworks, customers have the legal right to request a complete export of their personal data (DSAR) or permanent deletion of their account records. Frontline support agents must acknowledge privacy deletion requests within 24 business hours and log an official Data Privacy Request Ticket. Agents must explain that deletion removes all cloud recordings and purchase history permanently.',
    steps: [
      'Acknowledge the privacy request respectfully and confirm the legal right to erasure.',
      'Explain that account deletion is permanent and wipes all registered devices, warranties, and history.',
      'Ask the customer for final confirmation to proceed with the permanent deletion ticket.',
      'Create an official "Data Privacy Erasure" intake ticket routed to the Privacy Compliance Team.',
      'Provide the customer with their Data Request Tracking ID and state the 30-day fulfillment SLA.'
    ]
  }
];

// In-memory active Knowledge Base (initialized from realistic dataset)
export let KNOWLEDGE_BASE: KBArticle[] = [...INITIAL_KNOWLEDGE_BASE];

// Preset Knowledge Packs for 1-click Ingestion
export const PRESET_KNOWLEDGE_PACKS = [
  {
    id: 'pack_ecommerce_core',
    name: 'E-Commerce Core Support Pack',
    description: 'Essential shipping delays, refund matrices, price adjustments, and damaged goods SOPs.',
    category: 'E-Commerce',
    articleCount: 5,
    articles: INITIAL_KNOWLEDGE_BASE.filter(a => ['KB-SHP-001', 'KB-SHP-002', 'KB-RET-001', 'KB-CLM-001', 'KB-PRC-001'].includes(a.id))
  },
  {
    id: 'pack_hardware_iot',
    name: 'Smart Hardware & IoT Diagnostic Pack',
    description: 'Hardware resets, Wi-Fi 2.4GHz network pairing, warranty replacements, and device recovery.',
    category: 'Hardware & IoT',
    articleCount: 4,
    articles: INITIAL_KNOWLEDGE_BASE.filter(a => ['KB-TRB-001', 'KB-TRB-002', 'KB-RET-002', 'KB-CLM-001'].includes(a.id))
  },
  {
    id: 'pack_billing_subscriptions',
    name: 'SaaS, Billing & Subscription Pack',
    description: 'Duplicate authorization holds, Stripe refunds, auto-renewal cancellations, and prorated credits.',
    category: 'Billing & FinTech',
    articleCount: 3,
    articles: INITIAL_KNOWLEDGE_BASE.filter(a => ['KB-BIL-001', 'KB-BIL-002', 'KB-RET-001'].includes(a.id))
  },
  {
    id: 'pack_security_identity',
    name: 'Security, Identity & Compliance SOP Pack',
    description: '2FA authentication overrides, password security lockouts, VIP protocol, and GDPR data erasure.',
    category: 'Security & Legal',
    articleCount: 4,
    articles: INITIAL_KNOWLEDGE_BASE.filter(a => ['KB-SEC-001', 'KB-SEC-002', 'KB-SEC-003', 'KB-VIP-001'].includes(a.id))
  }
];

// Document Chunking Function: Breaks articles into granular, high-relevance semantic chunks
export function chunkArticle(article: KBArticle): KBChunk[] {
  const chunks: KBChunk[] = [];
  
  // Chunk 1: Summary & Scope
  chunks.push({
    chunkId: `${article.id}_chunk_summary`,
    articleId: article.id,
    title: `${article.title} - Policy Overview`,
    category: article.category,
    content: `DOCUMENT: ${article.title}\nCATEGORY: ${article.category}\nAUTHORITY LEVEL: ${article.authorityLevel || 'Tier 1'}\nPOLICY OVERVIEW: ${article.content}`,
    chunkType: 'summary',
    tags: article.tags
  });

  // Chunk 2: Actionable SOP Steps
  if (article.steps && article.steps.length > 0) {
    chunks.push({
      chunkId: `${article.id}_chunk_procedure`,
      articleId: article.id,
      title: `${article.title} - Standard Operating Procedure Steps`,
      category: article.category,
      content: `DOCUMENT: ${article.title}\nSTANDARD OPERATING PROCEDURE (SOP):\n${article.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      chunkType: 'procedure',
      tags: article.tags
    });
  }

  // Chunk 3: Compensation & Exception Rules
  if (article.maxCompensation || article.applicableProducts) {
    chunks.push({
      chunkId: `${article.id}_chunk_exceptions`,
      articleId: article.id,
      title: `${article.title} - Compensation & Authority Guidelines`,
      category: article.category,
      content: `DOCUMENT: ${article.title}\nMAX AUTHORIZED COMPENSATION: ${article.maxCompensation || 'None'}\nAPPLICABLE PRODUCTS: ${article.applicableProducts?.join(', ') || 'All Products'}\nAUTHORITY: ${article.authorityLevel || 'Tier 1 Frontline'}\nLAST UPDATED: ${article.lastUpdated || 'Current'}`,
      chunkType: 'exceptions',
      tags: article.tags
    });
  }

  return chunks;
}

// Generate all chunks for current knowledge base
export function getAllKnowledgeChunks(): KBChunk[] {
  const allChunks: KBChunk[] = [];
  for (const article of KNOWLEDGE_BASE) {
    const chunks = chunkArticle(article);
    allChunks.push(...chunks);
  }
  return allChunks;
}

// Vector math: Cosine Similarity
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// High-dimensional deterministic semantic hash fallback for offline vector math
export function generateSemanticFallbackVector(text: string, dimensions = 768): number[] {
  const vector = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    const weight = 1 + Math.log(1 + token.length);
    vector[idx] += weight;

    // Distribute semantic ripple across neighboring dimensions
    const neighbor1 = (idx + 7) % dimensions;
    const neighbor2 = (idx + 13) % dimensions;
    vector[neighbor1] += weight * 0.5;
    vector[neighbor2] += weight * 0.3;
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// In-memory Vector Index for Chunks and Articles
export interface VectorIndexItem {
  id: string;
  articleId: string;
  chunkId?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  vector: number[];
  chunkType: string;
}

export const activeVectorStore: VectorIndexItem[] = [];

// Lexical BM25 / Keyword Similarity Calculator
export function calculateKeywordScore(query: string, documentText: string, tags: string[] = []): number {
  const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 0;

  const docLower = documentText.toLowerCase();
  let hits = 0;
  let tagBonus = 0;

  for (const word of queryWords) {
    if (docLower.includes(word)) {
      hits += 1;
    }
    if (tags.some(t => t.toLowerCase().includes(word))) {
      tagBonus += 0.25;
    }
  }

  const queryMatchRatio = hits / queryWords.length;
  return Math.min(1.0, queryMatchRatio * 0.75 + tagBonus);
}

// Hybrid RAG Search: Combines Dense Vector Cosine Similarity + Sparse Lexical Keyword Score
export async function performHybridRAGSearch(
  query: string,
  options: {
    topK?: number;
    category?: string;
    minScore?: number;
    embeddingFunction?: (text: string) => Promise<number[]>;
  } = {}
): Promise<RAGSearchResult[]> {
  const { topK = 3, category, minScore = 0.15, embeddingFunction } = options;

  if (KNOWLEDGE_BASE.length === 0) {
    return [];
  }

  let queryVector: number[];
  if (embeddingFunction) {
    try {
      queryVector = await embeddingFunction(query);
    } catch {
      queryVector = generateSemanticFallbackVector(query);
    }
  } else {
    queryVector = generateSemanticFallbackVector(query);
  }

  // Score all knowledge base articles
  const scoredArticles: RAGSearchResult[] = KNOWLEDGE_BASE.map((article) => {
    const articleFullText = `${article.title}\n${article.content}\n${article.steps.join('\n')}\n${article.tags?.join(' ') || ''}`;
    const chunks = chunkArticle(article);

    // Compute semantic cosine similarity with article chunks
    let maxChunkSimilarity = 0;
    const scoredChunks = chunks.map((chunk) => {
      // Look up cached chunk vector if available
      const cached = activeVectorStore.find(v => v.chunkId === chunk.chunkId);
      const chunkVector = cached ? cached.vector : generateSemanticFallbackVector(chunk.content);
      const sim = cosineSimilarity(queryVector, chunkVector);
      if (sim > maxChunkSimilarity) maxChunkSimilarity = sim;
      return {
        ...chunk,
        relevanceScore: Number(sim.toFixed(3))
      };
    });

    // Compute lexical keyword score
    const keywordScore = calculateKeywordScore(query, articleFullText, article.tags);

    // Category bonus if specified or detected
    let categoryBonus = 0;
    if (category && article.category.toLowerCase() === category.toLowerCase()) {
      categoryBonus = 0.15;
    }

    // Hybrid formula: 60% dense vector similarity + 30% lexical keywords + 10% category boost
    const semanticSimilarity = Math.max(0, maxChunkSimilarity);
    const combinedScore = Math.min(
      0.99,
      Number((semanticSimilarity * 0.60 + keywordScore * 0.30 + categoryBonus).toFixed(3))
    );

    // Generate specific retrieval reason
    let retrievalReason = `Matched topic "${article.title}" based on semantic similarity.`;
    if (keywordScore > 0.4) {
      retrievalReason = `Direct keyword match on policy "${article.title}" (${article.category}).`;
    } else if (semanticSimilarity > 0.7) {
      retrievalReason = `High semantic relevance to customer issue regarding ${article.category.replace(/_/g, ' ')}.`;
    }

    return {
      article,
      score: combinedScore,
      semanticSimilarity: Number(semanticSimilarity.toFixed(3)),
      keywordScore: Number(keywordScore.toFixed(3)),
      matchedChunks: scoredChunks.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)),
      retrievalReason
    };
  });

  // Filter and sort by descending hybrid score
  return scoredArticles
    .filter(res => res.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Reset knowledge base to default official set
export function resetKnowledgeBaseToDefault(): KBArticle[] {
  KNOWLEDGE_BASE = [...INITIAL_KNOWLEDGE_BASE];
  return KNOWLEDGE_BASE;
}

// Ingest a new document into active knowledge base
export function ingestDocument(article: KBArticle): KBArticle {
  // Check if article ID already exists; replace or push
  const existingIdx = KNOWLEDGE_BASE.findIndex(a => a.id === article.id);
  if (existingIdx >= 0) {
    KNOWLEDGE_BASE[existingIdx] = article;
  } else {
    KNOWLEDGE_BASE.unshift(article);
  }
  return article;
}

// Delete an article from knowledge base
export function deleteDocument(articleId: string): boolean {
  const initialLen = KNOWLEDGE_BASE.length;
  KNOWLEDGE_BASE = KNOWLEDGE_BASE.filter(a => a.id !== articleId);
  return KNOWLEDGE_BASE.length < initialLen;
}
