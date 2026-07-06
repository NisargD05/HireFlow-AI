import os

from fastapi import APIRouter

from app.shared.chroma.client import get_chroma_collection
from app.shared.chroma.store import _load_fallback_items


router = APIRouter(tags=["Health"])


def runtime_info():
    commit = os.getenv("GIT_COMMIT", "unknown")
    return {
        "service": "ai-service",
        "runtime": "docker-compose",
        "environmentName": os.getenv("APP_ENV", "docker"),
        "gitBranch": os.getenv("GIT_BRANCH", "unknown"),
        "gitCommit": commit,
        "gitCommitShort": commit[:7],
        "buildVersion": os.getenv("BUILD_VERSION", f"1.0.0-{commit[:7]}"),
        "runningInDocker": os.getenv("RUNNING_IN_DOCKER", "false") == "true",
    }


@router.get("/")
def root_health_check():
    return {"message": "AI Hiring JD Service is running", "runtime": runtime_info()}


@router.get("/health")
def health_check():
    try:
        get_chroma_collection()
        return {"status": "ok", "chroma": "connected", "vector_store": "chromadb", "runtime": runtime_info()}
    except Exception as error:
        fallback_count = len(_load_fallback_items())
        if fallback_count:
            return {
                "status": "ok",
                "chroma": f"fallback: {error}",
                "vector_store": "fallback_json",
                "fallbackCount": fallback_count,
            }
        return {"status": "error", "chroma": f"unavailable: {error}", "vector_store": "none"}
