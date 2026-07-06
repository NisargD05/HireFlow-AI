from fastapi import APIRouter, HTTPException

from app.jd.graph import run_jd_generation_graph
from app.jd.schemas import GenerateJDRequest, GenerateJDResponse


router = APIRouter(tags=["Job Description"])


def _build_response(payload: GenerateJDRequest, state: dict) -> GenerateJDResponse:
    return GenerateJDResponse(
        jobDescription=state.get("final_jd") or state.get("generated_jd") or "",
        agentSteps=[
            "Query agent converted job inputs into a retrieval query",
            f"Retrieval query: {state.get('retrieval_query', '')}",
            "Tool router selected Chroma-backed retrieval inside the AI service",
            f"Tool calls: {', '.join(result.get('tool', '') for result in state.get('tool_results', []))}",
            "Context agent assembled company context for the prompt",
            "JD writer agent called the configured LLM provider with review feedback when needed",
            "Review node checked required JD sections before returning the draft for recruiter approval",
        ],
    )


@router.post("/generate-jd", response_model=GenerateJDResponse)
def generate_jd(payload: GenerateJDRequest):
    try:
        return _build_response(payload, run_jd_generation_graph(payload))
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": str(error),
                "roleName": payload.jobDetails.roleName,
            },
        )


@router.post("/api/jd/generate", response_model=GenerateJDResponse)
def generate_jd_api(payload: GenerateJDRequest):
    return generate_jd(payload)
