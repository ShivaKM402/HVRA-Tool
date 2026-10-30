"""
AI Feature 3 — DDMP Mitigation Directives Generator
Generates block-specific, department-wise action directives for inclusion
in District Disaster Management Plans (DDMP).

Model: gpt-4o-mini
Departments: PWD, Health, LSGD, Water Resources, Revenue / KSDMA
Fallback: returns generic templated directives per department.
"""
import json
import logging
from .openai_client import get_openai_client

logger = logging.getLogger(__name__)

DEPARTMENTS = ["PWD", "Health", "LSGD", "Water Resources", "Revenue/KSDMA"]


def generate_mitigation_directives(report_data: dict) -> dict:
    """
    Generate department-wise DDMP mitigation directives for an assessment.

    Returns:
        {
          "directives": {dept: [directive1, directive2, ...]},
          "ai_generated": bool
        }
    """
    client = get_openai_client()
    if client is None:
        return {"directives": _fallback_directives(report_data), "ai_generated": False}

    module = report_data.get("module_type", "HAZARD")
    district = report_data.get("district", "Kerala")
    block = report_data.get("block") or report_data.get("name", "the area")
    results = report_data.get("block_results", report_data.get("results", []))

    top_units = sorted(results, key=lambda r: float(
        r.get("hazard_score") or r.get("vulnerability_score") or
        r.get("exposure_score") or r.get("risk_score") or 0
    ), reverse=True)[:5]
    top_summary = "; ".join(
        f"{r.get('unit_name', 'Unknown')} (score: {r.get('hazard_score') or r.get('vulnerability_score') or r.get('exposure_score') or r.get('risk_score', 'N/A')})"
        for r in top_units
    )

    module_label = {
        "HAZARD": "Flood Hazard",
        "VULNERABILITY": "Physical Vulnerability",
        "EXPOSURE": "Population & Asset Exposure",
        "RISK": "Composite Flood Risk",
    }.get(module, module)

    prompt = f"""You are a disaster management policy expert advising the Kerala State Disaster Management Authority (KSDMA).

Generate specific, actionable DDMP (District Disaster Management Plan) directives for {district} District, {block}.
Assessment Type: {module_label}
Highest-risk units: {top_summary}

For EACH of the following 5 departments, provide exactly 3 concise, specific directives (1 sentence each):
- PWD (Public Works Department)
- Health (Department of Health & Family Welfare)
- LSGD (Local Self-Government Department)
- Water Resources (Kerala Water Authority / Irrigation)
- Revenue/KSDMA (Revenue Department / State Disaster Management Authority)

Directives must be:
- Specific to flood risk in Kerala
- Actionable (start with a verb: Deploy, Establish, Conduct, Inspect, etc.)
- Based on the risk data provided
- Suitable for inclusion in an official government plan

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "PWD": ["directive1", "directive2", "directive3"],
  "Health": ["directive1", "directive2", "directive3"],
  "LSGD": ["directive1", "directive2", "directive3"],
  "Water Resources": ["directive1", "directive2", "directive3"],
  "Revenue/KSDMA": ["directive1", "directive2", "directive3"]
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a KSDMA disaster policy expert. Return only valid JSON, no markdown.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=700,
            temperature=0.3,
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        directives = json.loads(raw)
        return {"directives": directives, "ai_generated": True}
    except Exception as exc:
        logger.error("OpenAI mitigation directives generation failed: %s", exc)
        return {"directives": _fallback_directives(report_data), "ai_generated": False}


def _fallback_directives(report_data: dict) -> dict:
    district = report_data.get("district", "Kerala")
    return {
        "PWD": [
            f"Inspect and reinforce flood embankments and bunds in high-risk zones of {district} District.",
            "Ensure unobstructed drainage along all state and national highways before monsoon onset.",
            "Deploy emergency road repair teams and equipment at identified flood-prone road stretches.",
        ],
        "Health": [
            "Pre-position emergency medical kits, oral rehydration supplies, and anti-snake venom in flood-prone PHCs.",
            "Activate rapid response medical teams for deployment within 2 hours of flood onset notification.",
            "Conduct vector-borne disease surveillance and prophylactic spraying in inundation-prone localities.",
        ],
        "LSGD": [
            "Identify and prepare community flood shelters with capacity for identified vulnerable populations.",
            "Issue household-level flood preparedness advisories to all gram panchayats in high-hazard zones.",
            "Establish local-level flood monitoring committees with clear escalation protocols.",
        ],
        "Water Resources": [
            "Monitor reservoir levels and implement controlled releases per flood management protocols.",
            "Clear silt and debris from irrigation canals and drainage channels prior to monsoon season.",
            "Install early flood warning sensors at critical river gauging stations in the district.",
        ],
        "Revenue/KSDMA": [
            "Activate District Emergency Operations Centre (DEOC) and establish 24×7 control room operations.",
            "Coordinate multi-agency resource pre-positioning including NDRF/SDRF teams, boats, and life-jackets.",
            "Update and circulate district-level evacuation maps and relief camp lists to all LSG bodies.",
        ],
    }

