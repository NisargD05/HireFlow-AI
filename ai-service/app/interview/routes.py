from fastapi import APIRouter, HTTPException

from app.interview.orchestrator import generate_interview_question_packet
from app.interview.schemas import InterviewGenerationRequest, InterviewGenerationResponse

router = APIRouter(prefix="/interview-agent", tags=["Interview Question Agent"])


@router.post("/generate", response_model=InterviewGenerationResponse)
def generate_packet(payload: InterviewGenerationRequest):
    try:
        return generate_interview_question_packet(payload)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error))
