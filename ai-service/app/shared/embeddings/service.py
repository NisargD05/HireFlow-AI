import hashlib

from langchain_huggingface import HuggingFaceEmbeddings

from app.shared.config.settings import settings

_embeddings = None


def _hash_embedding(text: str, dimensions: int = 384):
    digest = hashlib.sha256((text or "").encode("utf-8")).digest()
    values = []
    while len(values) < dimensions:
        for byte in digest:
            values.append((byte / 255.0) - 0.5)
            if len(values) == dimensions:
                break
        digest = hashlib.sha256(digest).digest()
    return values


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.embedding_model_name,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def embed_texts(texts):
    if not texts:
        return []

    if settings.embedding_provider == "sentence-transformers":
        try:
            return get_embeddings().embed_documents(texts)
        except Exception:
            pass

    return [_hash_embedding(text) for text in texts]


def embed_text(text: str):
    if settings.embedding_provider == "sentence-transformers":
        try:
            return get_embeddings().embed_query(text)
        except Exception:
            pass

    return _hash_embedding(text)