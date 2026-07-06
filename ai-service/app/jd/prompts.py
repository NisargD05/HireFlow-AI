from langchain_core.prompts import ChatPromptTemplate


jd_prompt_template = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You are an expert hiring strategist and job description writer.",
        ),
        (
            "human",
            """
Write a professional, company-aware job description using the recruiter's inputs and
the Knowledge Base context below. Use the context as supporting evidence only.
Do not invent company facts that are not supported by the context.
Avoid generic wording where specific role details are available.
Do not mention Knowledge Base, retrieved context, source documents, citations, RAG, or
internal retrieval details in the final job description.

The JD must include:
- Role Summary
- Responsibilities
- Required Qualifications
- Preferred Qualifications
- Job Details
- Mandatory Requirements

Recruiter job inputs:
- Role name: {role_name}
- Department: {department}
- Location: {location}
- Experience required: {experience_required}
- Salary range: {salary_range}
- Skills: {skills}
- Education: {education}
- Job type: {job_type}
- Number of openings: {number_of_openings}
- Seniority level: {seniority_level}
- Mandatory requirements: {mandatory_requirements}

Knowledge Base context:
{context_text}

Revision or review feedback to address:
{review_feedback}
""".strip(),
        ),
    ]
)


query_builder_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "You convert hiring role inputs into concise semantic search queries for a company knowledge base.",
        ),
        (
            "human",
            "Role: {role_name}\nDepartment: {department}\nSkills: {skills}\nSeniority: {seniority}\nMandatory requirements: {mandatory}\nReturn one concise search query only.",
        ),
    ]
)


def jd_prompt_variables(job_details, context_text: str, review_feedback: str = ""):
    return {
        "role_name": job_details.roleName,
        "department": job_details.department or "Not provided",
        "location": job_details.location or "Not provided",
        "experience_required": job_details.experienceRequired or "Not provided",
        "salary_range": job_details.salaryRange or "Not provided",
        "skills": job_details.skills or "Not provided",
        "education": job_details.education or "Not provided",
        "job_type": job_details.jobType or "Not provided",
        "number_of_openings": job_details.numberOfOpenings or 1,
        "seniority_level": job_details.seniorityLevel or "Not provided",
        "mandatory_requirements": job_details.mandatoryRequirements or "Not provided",
        "context_text": context_text,
        "review_feedback": review_feedback or "No prior review feedback.",
    }


def build_jd_prompt(job_details, context_text: str, review_feedback: str = "") -> str:
    return jd_prompt_template.format(**jd_prompt_variables(job_details, context_text, review_feedback))
