from langchain_google_genai import ChatGoogleGenerativeAI

from app.shared.config.settings import settings
from app.shared.exceptions.llm import GeminiRequestError

_llm_cache: dict[tuple, ChatGoogleGenerativeAI] = {}

def get_llm(temperature: float = 0.4, *, model_name: str | None = None, max_output_tokens: int | None = None):
    if settings.ai_provider != "gemini":
        raise GeminiRequestError(f"Gemini requires AI_PROVIDER=gemini; currentProvider={settings.ai_provider}")

    if not settings.gemini_api_key:
        raise GeminiRequestError(
            "Gemini API key missing. Set GEMINI_API_KEY in ai-service/.env or the ai-service container environment, then restart the AI service."
        )

    active_model = model_name or settings.gemini_model
    cache_key = (temperature, active_model, max_output_tokens)
    if cache_key not in _llm_cache:
        kwargs = {}
        if max_output_tokens:
            kwargs["max_output_tokens"] = max_output_tokens
        _llm_cache[cache_key] = ChatGoogleGenerativeAI(
            model=active_model,
            temperature=temperature,
            google_api_key=settings.gemini_api_key,
            convert_system_message_to_human=True,
            max_retries=0,
            **kwargs,
        )
    return _llm_cache[cache_key]