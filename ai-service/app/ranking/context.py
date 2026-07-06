def build_candidate_kb_query(job) -> str:
    values = [
        getattr(job, "roleName", ""),
        getattr(job, "requiredSkills", ""),
        getattr(job, "mandatoryRequirements", ""),
        getattr(job, "seniorityLevel", ""),
        getattr(job, "experienceRequired", ""),
    ]
    return " ".join(value for value in values if value).strip()


def build_candidate_context(payload, kb_chunks=None, retrieval_query: str = ""):
    from app.shared.rag.retriever import retrieve_chunks
    from app.shared.schemas.retrieval import RetrievalRequest

    resume_sections = payload.resume.parsedSections or {}
    query = build_candidate_kb_query(payload.job)
    if kb_chunks is None:
        retrieved = retrieve_chunks(RetrievalRequest(query=query, limit=5))
        kb_chunks = [result.model_dump() for result in retrieved.results[:5]]

    resume_text = (payload.resume.resumeText or "").strip()
    jd_text = (payload.job.fullJDText or "").strip()
    required_skills = (payload.job.requiredSkills or "").strip()


    if not resume_text:
        raise ValueError("Candidate resume text is empty; cannot rank without resume evidence")
    if not payload.job.roleName:
        raise ValueError("Job role name is empty; cannot rank without an approved JD")
    if not jd_text and not required_skills and not payload.job.mandatoryRequirements:
        raise ValueError("Approved JD payload is empty; cannot rank without JD requirements")
    if not kb_chunks:
        raise ValueError("Company knowledge retrieval returned no chunks; cannot run tri-source RAG ranking")

    return {
        "resumeSummary": {
            "skills": resume_sections.get("skills", []),
            "experience": resume_sections.get("experience", []),
            "projects": resume_sections.get("projects", []),
            "education": resume_sections.get("education", ""),
            "certifications": resume_sections.get("certifications", []),
            "resumeText": resume_text[:800],
        },
        "jdSummary": {
            "roleName": payload.job.roleName,
            "requiredSkills": payload.job.requiredSkills,
            "mandatoryRequirements": payload.job.mandatoryRequirements,
            "seniorityLevel": payload.job.seniorityLevel,
            "experienceRequired": payload.job.experienceRequired,
            "fullJDText": jd_text[:1000],
        },
        "companyContext": [
            {
                **chunk,
                "chunkText": (chunk.get("chunkText") or "")[:250],
            }
            for chunk in kb_chunks
        ],
        "retrievalQuery": retrieval_query or query,
    }
