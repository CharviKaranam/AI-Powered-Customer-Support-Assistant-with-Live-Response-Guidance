from typing import TypedDict, List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class ConversationMessage(BaseModel):
    sender: Literal["customer", "agent", "system"]
    text: str
    timestamp: Optional[str] = None
    intent: Optional[str] = None
    sentiment: Optional[str] = None
    emotion: Optional[str] = None
    frustration_score: Optional[int] = None
    escalation_risk: Optional[str] = None

class IntentSentimentOutput(BaseModel):
    intent: str = Field(description="Primary classified customer intent")
    secondary_intent: Optional[str] = None
    sentiment: Literal["Positive", "Neutral", "Negative"]
    emotion: str
    frustration_score: int = Field(ge=0, le=100, description="Frustration score from 0 to 100")
    satisfaction_trend: Literal["Improving", "Stable", "Declining"]
    urgency: Optional[str] = "medium"
    confidence: Optional[float] = 0.9
    key_phrases: List[str] = Field(default_factory=list)
    reasoning: Dict[str, str] = Field(default_factory=dict)

class KnowledgeItem(BaseModel):
    title: str
    category: Literal["Policy", "FAQ", "Troubleshooting", "Manual", "SOP", "Guide"]
    summary: str
    excerpt: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    reasoning: str

class KnowledgeRecommendationOutput(BaseModel):
    recommendations: List[KnowledgeItem] = Field(default_factory=list)
    status_message: Optional[str] = None
    query_used: Optional[str] = None
    context_summary: Optional[str] = None

class EscalationRiskOutput(BaseModel):
    escalation_score: int = Field(ge=0, le=100)
    risk_level: Literal["Low", "Medium", "High", "Critical"]
    confidence_score: int = 90
    reasoning: str
    recommended_actions: List[str] = Field(default_factory=list)
    detected_triggers: List[str] = Field(default_factory=list)
    recommended_action_code: Optional[str] = "continue"
    time_to_escalation_estimate: Optional[str] = None

class ResponseQualityScores(BaseModel):
    professionalism: int = 90
    empathy: int = 90
    clarity: int = 90
    completeness: int = 88
    courtesy: int = 92
    accuracy: int = 90
    actionability: int = 92

class AlternativeResponses(BaseModel):
    formal: str
    empathetic: str

class CoachingOutput(BaseModel):
    suggested_response: str
    response_quality: ResponseQualityScores = Field(default_factory=ResponseQualityScores)
    coaching_tips: List[str] = Field(default_factory=list)
    alternative_responses: Optional[AlternativeResponses] = None
    reasoning: str
    tone_feedback: Optional[str] = None
    tone_score: Optional[float] = 8.0
    grammar_issues: List[str] = Field(default_factory=list)
    empathy_rating: Optional[str] = "high"
    professionalism_rating: Optional[str] = "high"
    do_nots: List[str] = Field(default_factory=list)
    next_best_action: Optional[str] = None

class PostInteractionReport(BaseModel):
    session_id: str
    generated_at: str
    session_summary: str
    key_issues: List[str]
    resolution_status: Literal["Resolved", "Escalated", "Unresolved"]
    overall_quality_score: int
    resolution_score: int
    communication_score: int
    empathy_score: int
    professionalism_score: int
    strengths: List[str]
    areas_for_improvement: List[str]
    coaching_recommendations: List[str]
    sentiment_journey: List[Dict[str, Any]] = Field(default_factory=list)

# LangGraph Shared State TypedDict
class SupportGraphState(TypedDict, total=False):
    # Session metadata
    session_id: str
    scenario_name: str
    scenario_description: str
    customer_name: str
    product_name: str
    persona: str
    difficulty: str
    
    # Conversation history & active inputs
    messages: List[Dict[str, Any]]
    current_customer_message: str
    agent_last_message: Optional[str]
    turn_count: int
    
    # Graph Node Outputs (populated as execution flows through the graph)
    intent_sentiment: Optional[Dict[str, Any]]
    knowledge_recommendations: Optional[Dict[str, Any]]
    escalation_risk: Optional[Dict[str, Any]]
    coaching_output: Optional[Dict[str, Any]]
    post_interaction_report: Optional[Dict[str, Any]]
    
    # Control & Status Flags
    status: Literal["active", "resolved", "escalated"]
    should_escalate_immediately: bool
    execution_route: str
