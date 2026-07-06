import os
import shutil
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.knowledge.ingestion import ingest_pdf
from app.shared.document.pdf_extractor import extract_pdf_text
from app.shared.schemas.retrieval import RetrievalRequest, RetrievalResponse
from app.knowledge.service import retrieve_context


router = APIRouter(tags=["Knowledge"])


@router.get("/knowledge/status")
def knowledge_status():
    return {
        "status": "ready",
        "message": "Knowledge ingestion hooks are available for future direct AI-service uploads.",
    }


@router.post("/knowledge/index-pdf")
async def index_pdf(
    file: UploadFile = File(...),
    documentId: str = Form(...),
    sourceFileName: str = Form(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    temp_path = ""
    try:

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name

        result = ingest_pdf(temp_path, documentId, sourceFileName)
        return {
            "success": True,
            "message": "PDF indexed successfully",
            **result,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "message": str(error),
                "documentId": documentId,
            },
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/knowledge/test-pdf")
async def test_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name

        text = extract_pdf_text(temp_path)
        return {
            "success": True,
            "characterCount": len(text),
            "preview": text[:500],
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


rag_router = APIRouter(prefix="/rag", tags=["RAG"])


@rag_router.post("/retrieve", response_model=RetrievalResponse)
def retrieve(payload: RetrievalRequest):
    return retrieve_context(payload)
