import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    app_name = os.getenv("APP_NAME", "AI Hiring JD Service")
    ai_provider = os.getenv("AI_PROVIDER", "gemini").lower()
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    gemini_fallback_models = [
        model.strip()
        for model in os.getenv(
            "GEMINI_FALLBACK_MODELS",
            "gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash-lite",
        ).split(",")
        if model.strip()
    ]
    llm_temperature = float(os.getenv("LLM_TEMPERATURE", "0.4"))
    llm_timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
    chroma_persist_directory = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_data")
    chroma_collection_name = os.getenv("CHROMA_COLLECTION_NAME", "knowledge_base_documents")
    chroma_http_host = os.getenv("CHROMA_HTTP_HOST") or os.getenv("CHROMA_HOST", "")
    chroma_http_port = int(os.getenv("CHROMA_HTTP_PORT") or os.getenv("CHROMA_PORT", "8000"))
    embedding_model_name = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    embedding_provider = os.getenv("EMBEDDING_PROVIDER", "sentence-transformers")

settings = Settings()