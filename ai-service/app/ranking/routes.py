from fastapi import APIRouter, HTTPException

from app.ranking.schemas import CandidateRankingRequest, CandidateRankingResponse
from app.ranking.service import rank_candidate_against_job

router = APIRouter(prefix="/ranking", tags=["Candidate Ranking"])

@router.post("/candidate", response_model=CandidateRankingResponse)
def rank_candidate(payload: CandidateRankingRequest):
    try:
        return rank_candidate_against_job(payload)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))