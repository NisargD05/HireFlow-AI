from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CandidateRankingOutput(BaseModel):
    score: int = Field(description="Candidate match score from 0 to 100")
    matchesWithJD: List[str] = Field(default_factory=list)
    missingWithJD: List[str] = Field(default_factory=list)
    missingLinks: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    recommendation: str = Field(default="Review")
    rankingReason: str = Field(default="")


class InterviewQuestionItem(BaseModel):
    question: str = ""
    whyAsk: str = ""
    strongSignal: str = ""


class InterviewPacketOutput(BaseModel):
    focusAreas: List[str] = Field(default_factory=list)
    technicalQuestions: List[InterviewQuestionItem] = Field(default_factory=list)
    followUpQuestions: List[InterviewQuestionItem] = Field(default_factory=list)
    weaknessProbes: List[InterviewQuestionItem] = Field(default_factory=list)
    behavioralQuestions: List[InterviewQuestionItem] = Field(default_factory=list)
    systemDesignQuestions: List[InterviewQuestionItem] = Field(default_factory=list)
    evaluationChecklist: List[str] = Field(default_factory=list)
    interviewerNotes: List[str] = Field(default_factory=list)
    rawModelOutput: Optional[Any] = None


class JobDescriptionOutput(BaseModel):
    jobDescription: str = Field(description="Complete markdown job description")
    metadata: Dict[str, Any] = Field(default_factory=dict)
