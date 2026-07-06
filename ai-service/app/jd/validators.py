from app.jd.parser import find_missing_sections


def validate_jd_sections(job_description: str) -> tuple[bool, str | None]:
    draft = job_description or ""
    missing_sections = find_missing_sections(draft)
    review_passed = bool(draft.strip()) and not missing_sections
    if review_passed:
        return True, None
    return False, f"Generated JD is missing required sections: {', '.join(missing_sections)}"


def build_review_feedback(job_description: str) -> str | None:
    passed, feedback = validate_jd_sections(job_description)
    return None if passed else feedback
