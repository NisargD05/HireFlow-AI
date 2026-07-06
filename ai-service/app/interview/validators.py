from app.interview.schemas import InterviewQuestionPacket


def validate_interview_packet(generated_packet: dict) -> tuple[bool, str | None, dict]:
    try:
        packet = InterviewQuestionPacket(**(generated_packet or {})).model_dump(exclude_none=True)
        review_passed = bool(packet.get("focusAreas")) and bool(packet.get("technicalQuestions"))
        if review_passed:
            return True, None, packet
        return False, "Interview packet is missing focus areas or technical questions", packet
    except Exception as error:
        return False, str(error), {}


def request_human_approval(workflow: str, artifact, review_passed: bool, review_feedback: str = ""):
    if not review_passed:
        return {
            "workflow": workflow,
            "status": "revision_requested",
            "approved": False,
            "humanRequired": False,
            "feedback": review_feedback or "Review failed; revision required.",
        }

    return {
        "workflow": workflow,
        "status": "approved",
        "approved": True,
        "humanRequired": False,
        "feedback": "",
    }
