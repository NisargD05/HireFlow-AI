from typing import List, Optional

from pydantic import BaseModel


class RetrievalRequest(BaseModel):
    query: str
    limit: Optional[int] = 6


class RetrievalResult(BaseModel):
    sourceFileName: str
    chunkText: str
    score: float = 0


class RetrievalResponse(BaseModel):
    query: str
    results: List[RetrievalResult] = []
