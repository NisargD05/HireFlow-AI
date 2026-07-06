from collections.abc import Callable
from typing import Any, TypeVar

from app.shared.config.settings import settings
from app.shared.exceptions.llm import GeminiRequestError

T = TypeVar("T")


def is_quota_or_rate_limit_error(error: Exception) -> bool:
    text = str(error).lower()
    return (
        "429" in text
        or "quota" in text
        or "rate limit" in text
        or "resourceexhausted" in text
        or "rate-limit" in text
    )


def model_candidates(primary: str | None = None) -> list[str]:
    primary_model = primary or settings.gemini_model
    seen: set[str] = set()
    models: list[str] = []
    for model in [primary_model, *settings.gemini_fallback_models]:
        if model and model not in seen:
            seen.add(model)
            models.append(model)
    return models


def invoke_chain_with_model_fallback(
    chain_builder: Callable[[str], Any],
    input_data: dict,
    *,
    label: str = "chain",
) -> Any:
    last_error: Exception | None = None
    for model_name in model_candidates():
        try:
            return chain_builder(model_name).invoke(input_data)
        except Exception as error:
            last_error = error
            if is_quota_or_rate_limit_error(error):
                continue
            raise

    if last_error:
        raise last_error
    raise GeminiRequestError("No Gemini models configured")
