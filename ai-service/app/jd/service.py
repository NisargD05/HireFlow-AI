from langchain_core.output_parsers import StrOutputParser

from app.jd.context import build_retrieval_query, format_context
from app.jd.parser import parse_jd_output
from app.jd.prompts import jd_prompt_template, jd_prompt_variables, query_builder_prompt
from app.jd.schemas import GenerateJDRequest
from app.shared.llm.gemini_client import get_llm
from app.shared.llm.invoker import invoke_chain_with_model_fallback

def _query_chain_for_model(model_name: str):
    return query_builder_prompt | get_llm(temperature=0.1, model_name=model_name) | StrOutputParser()


def _jd_writer_chain_for_model(model_name: str):
    return jd_prompt_template | get_llm(temperature=0.4, model_name=model_name) | StrOutputParser()


def prepare_query(payload: GenerateJDRequest) -> str:
    fallback_query = build_retrieval_query(payload.jobDetails)
    try:
        query = invoke_chain_with_model_fallback(
            _query_chain_for_model,
            {
                "role_name": payload.jobDetails.roleName,
                "department": payload.jobDetails.department or "",
                "skills": payload.jobDetails.skills or "",
                "seniority": payload.jobDetails.seniorityLevel or "",
                "mandatory": payload.jobDetails.mandatoryRequirements or "",
            },
            label="jd_query_builder",
        ).strip()
        return query or fallback_query
    except Exception as error:
        return fallback_query


def prepare_context(context_items):
    return format_context(context_items)


def build_fallback_job_description(job, context: str) -> str:
    role_line = f"{job.seniorityLevel} {job.roleName}".strip()

    responsibilities = [
        f"Own high-quality delivery for the {job.roleName} role.",
        "Collaborate with hiring, product, and technical stakeholders.",
        "Use company knowledge and hiring guidelines to make consistent decisions.",
    ]

    if job.skills:
        responsibilities.append(f"Apply practical expertise with {job.skills}.")

    required = []
    if job.experienceRequired:
        required.append(f"{job.experienceRequired} of relevant experience.")
    if job.education:
        required.append(job.education)
    if job.skills:
        required.append(f"Strong working knowledge of {job.skills}.")
    if job.mandatoryRequirements:
        required.append(job.mandatoryRequirements)
    if not required:
        required.append("Relevant experience in a comparable role.")

    return f"""# {role_line}

## Role Summary
We are hiring for the {job.roleName} role{f" in the {job.department} department" if job.department else ""}. This role is shaped by the recruiter's requirements and the company's hiring standards.

## Responsibilities
{chr(10).join(f"- {item}" for item in responsibilities)}

## Required Qualifications
{chr(10).join(f"- {item}" for item in required)}

## Preferred Qualifications
- Experience in structured hiring or operationally mature teams.
- Clear communication with cross-functional stakeholders.
- Ability to adapt company guidance into practical execution.

## Job Details
- Job type: {job.jobType or "To be confirmed"}
- Location: {job.location or "To be confirmed"}
- Experience expectations: {job.experienceRequired or "To be confirmed"}
- Salary range: {job.salaryRange or "To be confirmed"}
- Number of openings: {job.numberOfOpenings or 1}

## Mandatory Requirements
{job.mandatoryRequirements or "No mandatory requirements were provided beyond the qualifications above."}
"""


def write_job_description(job_details, context_text, review_feedback: str = ""):
    variables = jd_prompt_variables(job_details, context_text, review_feedback)
    try:
        llm_text = invoke_chain_with_model_fallback(
            _jd_writer_chain_for_model,
            variables,
            label="jd_writer",
        )
    except Exception as error:
        return build_fallback_job_description(job_details, context_text)

    if not llm_text:
        return build_fallback_job_description(job_details, context_text)

    return parse_jd_output(llm_text)
