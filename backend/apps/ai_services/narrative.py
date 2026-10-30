"""
AI Feature 1 — Executive Narrative & Diagnostic Writer
Synthesises computed HVRA scores into a human-readable diagnostic paragraph
for inclusion in PDF/DOCX reports and the frontend Report View.

Model: gpt-4o-mini  (fast, cheap, accurate for structured text generation)
Fallback: returns a polished template string when OpenAI is unavailable.
"""
import logging
from .openai_client import get_openai_client

logger = logging.getLogger(__name__)


def _build_prompt(report_data: dict) -> str:
    module = report_data.get("module_type", "HAZARD")
    district = report_data.get("district", "Kerala")
    block = report_data.get("block") or report_data.get("name", "the assessment area")
    methodology = report_data.get("methodology", "KSDMA HVRA heuristic scoring framework")
    summary = report_data.get("classification_summary", {})
    results = report_data.get("block_results", report_data.get("results", []))

    # Build classification stats
    class_counts = {}
    scores = []
    for r in results:
        cls = r.get("hazard_class") or r.get("vulnerability_class") or r.get("exposure_class") or r.get("risk_class", "N/A")
        class_counts[cls] = class_counts.get(cls, 0) + 1
        score = r.get("hazard_score") or r.get("vulnerability_score") or r.get("exposure_score") or r.get("risk_score")
        if score is not None:
            try:
                scores.append(float(score))
            except (ValueError, TypeError):
                pass

    avg_score = round(sum(scores) / len(scores), 2) if scores else "N/A"
    top_units = sorted(results, key=lambda r: float(
        r.get("hazard_score") or r.get("vulnerability_score") or
        r.get("exposure_score") or r.get("risk_score") or 0
    ), reverse=True)[:3]
    top_names = ", ".join(r.get("unit_name", "Unknown") for r in top_units)

    module_label = {
        "HAZARD": "Flood Hazard",
        "VULNERABILITY": "Physical Vulnerability",
        "EXPOSURE": "Population & Asset Exposure",
        "RISK": "Composite Flood Risk",
    }.get(module, module)

    prompt = f"""You are an expert disaster risk analyst writing for the Kerala State Disaster Management Authority (KSDMA).

Write a professional executive diagnostic narrative (3–4 paragraphs, ~250 words) for the following assessment:

Assessment Type: {module_label}
District: {district}
Assessment Area: {block}
Methodology: {methodology}
Average Score: {avg_score} / 10
Classification Distribution: {class_counts}
Highest-scoring administrative units: {top_names}

Guidelines:
- Use formal government report language, suitable for a Collector or Minister briefing
- Paragraph 1: Introduce the assessment scope and methodology
- Paragraph 2: Summarise the key findings (scores, classifications, spatial pattern)
- Paragraph 3: Highlight the most critical areas and their implications
- Paragraph 4: Conclude with recommended immediate attention priorities
- Do NOT invent data — base all statements on the numbers provided
- Label this clearly as AI-generated analysis
- Plain prose only — no bullet points, no headings, no markdown
"""
    return prompt


def generate_assessment_narrative(report_data: dict) -> dict:
    """
    Generate an AI executive narrative for a completed assessment.

    Returns:
        {
          "narrative": str,   # the generated text
          "cached": bool,     # whether this was served from cache
          "ai_generated": bool
        }
    """
    # Return cached narrative if already generated
    metadata = report_data.get("_ai_cache", {})
    if metadata.get("narrative"):
        return {"narrative": metadata["narrative"], "cached": True, "ai_generated": True}

    client = get_openai_client()
    if client is None:
        return {
            "narrative": _fallback_narrative(report_data),
            "cached": False,
            "ai_generated": False,
        }

    try:
        prompt = _build_prompt(report_data)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior disaster risk analyst at KSDMA Kerala. "
                        "You write clear, authoritative, data-driven executive reports for government officials."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=600,
            temperature=0.4,
        )
        narrative = response.choices[0].message.content.strip()
        return {"narrative": narrative, "cached": False, "ai_generated": True}
    except Exception as exc:
        logger.error("OpenAI narrative generation failed: %s", exc)
        return {
            "narrative": _fallback_narrative(report_data),
            "cached": False,
            "ai_generated": False,
        }


def _fallback_narrative(report_data: dict) -> str:
    module = report_data.get("module_type", "HAZARD")
    district = report_data.get("district", "Kerala")
    block = report_data.get("block") or report_data.get("name", "the assessment area")
    module_label = {
        "HAZARD": "Flood Hazard",
        "VULNERABILITY": "Physical Vulnerability",
        "EXPOSURE": "Population & Asset Exposure",
        "RISK": "Composite Flood Risk",
    }.get(module, module)

    results = report_data.get("block_results", report_data.get("results", []))
    scores = []
    for r in results:
        s = r.get("hazard_score") or r.get("vulnerability_score") or r.get("exposure_score") or r.get("risk_score")
        if s is not None:
            try:
                scores.append(float(s))
            except (ValueError, TypeError):
                pass
    avg = round(sum(scores) / len(scores), 1) if scores else "N/A"

    return (
        f"This report presents the {module_label} Assessment for {block}, {district} District, "
        f"conducted using the KSDMA HVRA heuristic scoring framework. The assessment evaluated "
        f"{len(results)} administrative unit(s) across standardised indicators derived from "
        f"the 2018–19 flood inundation records and Census of India 2011 datasets. "
        f"The mean {module_label.lower()} score for the assessment area was computed at {avg}/10. "
        f"Units recording high scores require priority attention in district disaster management planning. "
        f"This analysis is provided to support evidence-based policy decisions by the District Collector "
        f"and Kerala State Disaster Management Authority."
    )

