from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class InterviewCandidatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default="", alias="_id")
    name: str
    email: Optional[str] = ""
    currentCompany: Optional[str] = ""
    yearsOfExperience: Optional[float] = None
    notes: Optional[str] = ""


class InterviewResumePayload(BaseModel):
    resumeText: str = ""
    parsedSections: Dict[str, Any] = Field(default_factory=dict)


class InterviewRankingPayload(BaseModel):
    score: Optional[int] = None
    matchesWithJD: List[str] = Field(default_factory=list)
    missingWithJD: List[str] = Field(default_factory=list)
    missingLinks: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    recommendation: Optional[str] = ""
    rankingReason: Optional[str] = ""


class InterviewJobPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    roleName: str
    department: Optional[str] = ""
    skills: Optional[str] = ""
    mandatoryRequirements: Optional[str] = ""
    seniorityLevel: Optional[str] = ""
    experienceRequired: Optional[str] = ""
    approvedJD: Optional[str] = ""


class InterviewGenerationRequest(BaseModel):
    candidate: InterviewCandidatePayload
    resume: InterviewResumePayload
    ranking: InterviewRankingPayload = Field(default_factory=InterviewRankingPayload)
    job: InterviewJobPayload
    interview: Dict[str, Any] = Field(default_factory=dict)


class InterviewGenerationState(BaseModel):
    candidate: Dict[str, Any] = Field(default_factory=dict)
    resume: Dict[str, Any] = Field(default_factory=dict)
    ranking: Dict[str, Any] = Field(default_factory=dict)
    job: Dict[str, Any] = Field(default_factory=dict)
    interview: Dict[str, Any] = Field(default_factory=dict)
    kbChunks: List[Dict[str, Any]] = Field(default_factory=list)
    focusAreas: List[str] = Field(default_factory=list)
    generatedQuestions: Dict[str, Any] = Field(default_factory=dict)


class InterviewQuestionPacket(BaseModel):
    focusAreas: List[str] = Field(default_factory=list)
    technicalQuestions: List[Dict[str, str]] = Field(default_factory=list)
    followUpQuestions: List[Dict[str, str]] = Field(default_factory=list)
    weaknessProbes: List[Dict[str, str]] = Field(default_factory=list)
    behavioralQuestions: List[Dict[str, str]] = Field(default_factory=list)
    systemDesignQuestions: List[Dict[str, str]] = Field(default_factory=list)
    evaluationChecklist: List[str] = Field(default_factory=list)
    interviewerNotes: List[str] = Field(default_factory=list)
    rawModelOutput: Optional[Any] = None


class InterviewGenerationResponse(BaseModel):
    success: bool = True
    packet: InterviewQuestionPacket
    state: Dict[str, Any] = Field(default_factory=dict)
