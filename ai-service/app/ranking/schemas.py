from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class CandidatePayload(BaseModel):
    _id: Optional[str] = ""
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    currentCompany: Optional[str] = ""
    yearsOfExperience: Optional[float] = None
    source: Optional[str] = ""
    notes: Optional[str] = ""


class ResumePayload(BaseModel):
    resumeText: str
    parsedSections: Dict[str, Any] = Field(default_factory=dict)


class JobPayload(BaseModel):
    _id: str
    roleName: str
    department: Optional[str] = ""
    requiredSkills: Optional[str] = ""
    mandatoryRequirements: Optional[str] = ""
    seniorityLevel: Optional[str] = ""
    experienceRequired: Optional[str] = ""
    fullJDText: Optional[str] = ""


class CandidateRankingRequest(BaseModel):
    candidate: CandidatePayload
    resume: ResumePayload
    job: JobPayload


class CandidateRankingResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    matchesWithJD: List[str] = Field(default_factory=list)
    missingWithJD: List[str] = Field(default_factory=list)
    missingLinks: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list, min_length=1)
    weaknesses: List[str] = Field(default_factory=list, min_length=1)
    recommendation: str = "Review"
    rankingReason: str = Field(min_length=8)
    companyContext: List[Dict[str, Any]] = Field(default_factory=list)
    rawModelOutput: Optional[Any] = None

    @field_validator("recommendation")
    @classmethod
    def validate_recommendation(cls, value):
        if value not in ["Shortlist", "Review", "Reject"]:
            raise ValueError("recommendation must be Shortlist, Review, or Reject")
        return value
