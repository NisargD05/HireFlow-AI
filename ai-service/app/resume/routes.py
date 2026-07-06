import os
import shutil
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.resume.schemas import ResumeParseResponse
from app.resume.service import parse_resume_file

router = APIRouter(prefix="/candidates", tags=["Candidates"])

@router.post("/parse-resume", response_model=ResumeParseResponse)
async def parse_resume(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name

        return {"success": True, **parse_resume_file(temp_path)}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)