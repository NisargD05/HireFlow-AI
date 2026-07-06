import json
import re
from typing import Any, Dict, List

from app.interview.schemas import InterviewQuestionPacket


def _extract_json(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def _as_string_list(value: Any, limit: int) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()][:limit]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _as_question_list(value: Any, limit: int) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []

    questions = []
    for item in value:
        if isinstance(item, str):
            question = {"question": item.strip(), "whyAsk": "", "strongSignal": ""}
        elif isinstance(item, dict):
            question = {
                "question": str(item.get("question", "")).strip(),
                "whyAsk": str(item.get("whyAsk", item.get("why", ""))).strip(),
                "strongSignal": str(item.get("strongSignal", item.get("signal", ""))).strip(),
            }
        else:
            continue

        if question["question"]:
            questions.append(question)

    return questions[:limit]


def parse_interview_packet(raw_output: str) -> Dict[str, Any]:
    parsed = _extract_json(raw_output)
    normalized = {
        "focusAreas": _as_string_list(parsed.get("focusAreas"), 8),
        "technicalQuestions": _as_question_list(parsed.get("technicalQuestions"), 6),
        "followUpQuestions": _as_question_list(parsed.get("followUpQuestions"), 5),
        "weaknessProbes": _as_question_list(parsed.get("weaknessProbes"), 5),
        "behavioralQuestions": _as_question_list(parsed.get("behavioralQuestions"), 5),
        "systemDesignQuestions": _as_question_list(parsed.get("systemDesignQuestions"), 4),
        "evaluationChecklist": _as_string_list(parsed.get("evaluationChecklist"), 10),
        "interviewerNotes": _as_string_list(parsed.get("interviewerNotes"), 8),
        "rawModelOutput": {"modelOutput": (raw_output or "")[:2000]},
    }
    validated = InterviewQuestionPacket(**normalized)
    return validated.model_dump(exclude_none=True)
