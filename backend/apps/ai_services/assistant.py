"""
AI Feature 4 — "Ask HVRA" Conversational Query Assistant
Provides natural language Q&A over HVRA assessment data for
Collectors, District Officers, and Ministers.

Model: gpt-4o-mini
Fallback: Returns a helpful "AI unavailable" message.
"""
import logging
from .openai_client import get_openai_client

logger = logging.getLogger(__name__)

# System prompt defining HVRA assistant persona
SYSTEM_PROMPT = """You are HVRA Assistant — an AI-powered disaster risk intelligence copilot for the
Kerala State Disaster Management Authority (KSDMA) digital platform.

You help District Collectors, Senior Officers, and Ministers quickly understand:
- Flood hazard, vulnerability, exposure, and composite risk assessments
- Which local self-governments (LSGs) face the highest flood risk
- What the HVRA scores mean and how they are computed
- Recommended actions based on assessment data
- How to navigate or use the HVRA Digital Tool

Rules:
- Always be factual, concise, and professional (government context)
- If asked about specific data, refer to the context provided
- If data is not in context, say so clearly — do not fabricate numbers
- Flag all AI-generated recommendations as advisory only
- Never override statutory thresholds or approval requirements
- Keep answers under 200 words unless the user asks for more detail
"""


def ask_hvra(question: str, context: dict = None) -> dict:
    """
    Answer a natural language question about HVRA data.

    Args:
        question: The user's question in plain English/Malayalam transliterated
        context: Optional dict with current assessment data, district info, etc.

    Returns:
        {
          "answer": str,
          "query_type": "filter" | "advisory" | "general",
          "filter_params": dict | None,
          "ai_generated": bool
        }
    """
    client = get_openai_client()
    if client is None:
        return {
            "answer": (
                "The HVRA AI Assistant is currently unavailable. "
                "Please ensure your OPENAI_API_KEY is configured in the backend .env file. "
                "You can still use all manual features of the platform."
            ),
            "query_type": "general",
            "filter_params": None,
            "ai_generated": False,
        }

    # Build context string
    context_str = ""
    if context:
        district = context.get("district", "")
        module = context.get("module_type", "")
        results_count = len(context.get("results", []))
        avg_score = context.get("avg_score", "")
        top_units = context.get("top_units", [])

        context_str = f"""
Current Context:
- District: {district}
- Assessment Module: {module}
- Units assessed: {results_count}
- Average score: {avg_score}
- Highest risk units: {", ".join(top_units[:3]) if top_units else "N/A"}
"""

    try:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
        ]
        if context_str:
            messages.append({
                "role": "system",
                "content": f"Current assessment context:\n{context_str}",
            })
        messages.append({"role": "user", "content": question})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=400,
            temperature=0.3,
        )
        answer = response.choices[0].message.content.strip()

        # Detect query type based on keywords
        q_lower = question.lower()
        if any(kw in q_lower for kw in ["show", "filter", "list", "find", "where", "which"]):
            query_type = "filter"
        elif any(kw in q_lower for kw in ["should", "recommend", "action", "plan", "what to do", "priority"]):
            query_type = "advisory"
        else:
            query_type = "general"

        return {
            "answer": answer,
            "query_type": query_type,
            "filter_params": None,
            "ai_generated": True,
        }
    except Exception as exc:
        logger.error("Ask HVRA failed: %s", exc)
        return {
            "answer": "I encountered an error processing your question. Please try again shortly.",
            "query_type": "general",
            "filter_params": None,
            "ai_generated": False,
        }

