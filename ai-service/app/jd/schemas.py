from typing import List, Optional

from pydantic import BaseModel


class JobDetails(BaseModel):
    roleName: str
    department: Optional[str] = ""
    location: Optional[str] = ""
    experienceRequired: Optional[str] = ""
    salaryRange: Optional[str] = ""
    skills: Optional[str] = ""
    education: Optional[str] = ""
    jobType: Optional[str] = ""
    numberOfOpenings: Optional[int] = 1
    seniorityLevel: Optional[str] = ""
    mandatoryRequirements: Optional[str] = ""


class KnowledgeContextItem(BaseModel):
    sourceFileName: Optional[str] = ""
    chunkText: str
    score: Optional[int] = 0


class GenerateJDRequest(BaseModel):
    jobDetails: JobDetails
    knowledgeContext: List[KnowledgeContextItem] = []


class GenerateJDResponse(BaseModel):
    jobDescription: str
    agentSteps: List[str] = []
