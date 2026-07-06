from typing import Any, Dict

from pydantic import BaseModel


class ResumeParseResponse(BaseModel):
    success: bool = True
    resumeText: str
    parsedSections: Dict[str, Any]
    characterCount: int
    extractionEngine: str = "pdfplumber/pypdf"
