from app.interview.schemas import InterviewGenerationRequest


def build_candidate_context(payload: InterviewGenerationRequest):
    resume_sections = payload.resume.parsedSections or {}
    resume_text = (payload.resume.resumeText or "").strip()

    return {
        "candidate": payload.candidate.model_dump(by_alias=True),
        "resume": {
            "resumeText": resume_text[:1600],
            "skills": resume_sections.get("skills", []),
            "experience": resume_sections.get("experience", []),
            "projects": resume_sections.get("projects", []),
            "education": resume_sections.get("education", ""),
            "certifications": resume_sections.get("certifications", []),
        },
    }


def build_jd_context(payload: InterviewGenerationRequest):
    job = payload.job
    return {
        "job": {
            "_id": job.id,
            "roleName": job.roleName,
            "department": job.department or "",
            "skills": job.skills or "",
            "mandatoryRequirements": job.mandatoryRequirements or "",
            "seniorityLevel": job.seniorityLevel or "",
            "experienceRequired": job.experienceRequired or "",
            "approvedJD": (job.approvedJD or "")[:2200],
        },
        "interview": payload.interview or {},
    }


def build_ranking_context(payload: InterviewGenerationRequest):
    ranking = payload.ranking.model_dump()
    focus_areas = []
    for value in ranking.get("weaknesses", []) + ranking.get("missingWithJD", []) + ranking.get("missingLinks", []):
        if value and value not in focus_areas:
            focus_areas.append(value)

    return {
        "ranking": ranking,
        "focusAreas": focus_areas[:6],
    }


def build_interview_kb_query(job_context, ranking_context):
    job = job_context.get("job", {})
    ranking = ranking_context.get("ranking", {})
    weak_areas = ", ".join(ranking.get("weaknesses", []) + ranking.get("missingWithJD", []))
    return (
        f"Interview standards and evaluation guidance for {job.get('roleName', '')}. "
        f"Required skills: {job.get('skills', '')}. "
        f"Mandatory requirements: {job.get('mandatoryRequirements', '')}. "
        f"Candidate weak areas: {weak_areas}."
    ).strip()
