import json

from app.ranking.schemas import CandidateRankingResponse


def _as_list(value):
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def normalize_ranking_result(result):
    score = int(float(result.get("score", 0) or 0))
    recommendation = result.get("recommendation", "Review")
    if recommendation not in ["Shortlist", "Review", "Reject"]:
        recommendation = "Review"

    return {
        "score": max(0, min(100, score)),
        "matchesWithJD": _as_list(result.get("matchesWithJD")),
        "missingWithJD": _as_list(result.get("missingWithJD")),
        "missingLinks": _as_list(result.get("missingLinks")),
        "strengths": _as_list(result.get("strengths")) or ["No strong evidence returned"],
        "weaknesses": _as_list(result.get("weaknesses")) or ["No weakness detail returned"],
        "recommendation": recommendation,
        "rankingReason": str(result.get("rankingReason", "")) or "Ranking completed with limited model explanation.",
    }


def parse_and_validate_ranking(parsed_output):
    parsed = json.loads(parsed_output) if isinstance(parsed_output, str) else parsed_output
    normalized = normalize_ranking_result(parsed or {})
    validated = CandidateRankingResponse(**normalized)
    return validated.model_dump(exclude_none=True)
