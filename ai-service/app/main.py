from fastapi import FastAPI

from app.shared.config.settings import settings
from app.shared.routes.health import router as health_router
from app.jd.routes import router as jd_router
from app.knowledge.routes import router as knowledge_router, rag_router
from app.resume.routes import router as resume_router
from app.ranking.routes import router as ranking_router
from app.interview.routes import router as interview_router


app = FastAPI(title=settings.app_name)

app.include_router(health_router)
app.include_router(jd_router)
app.include_router(knowledge_router)
app.include_router(rag_router)
app.include_router(resume_router)
app.include_router(ranking_router)
app.include_router(interview_router)
