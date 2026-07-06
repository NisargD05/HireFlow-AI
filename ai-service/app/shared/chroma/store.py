import json
import math
import os

from app.shared.chroma.client import get_vector_store
from app.shared.config.settings import settings
from app.shared.embeddings.service import embed_text


def _fallback_store_path():
    return os.path.join(settings.chroma_persist_directory, "fallback_vector_store.json")


def _load_fallback_items():
    path = _fallback_store_path()
    if not os.path.exists(path):
        return []

    try:
        with open(path, "r", encoding="utf-8-sig") as handle:
            return json.load(handle)
    except Exception as error:
        return []


def _write_fallback_items(items):
    os.makedirs(settings.chroma_persist_directory, exist_ok=True)
    with open(_fallback_store_path(), "w", encoding="utf-8") as handle:
        json.dump(items, handle, ensure_ascii=True, indent=2)


def _cosine_similarity(left, right):
    if not left or not right:
        return 0.0

    size = min(len(left), len(right))
    dot = sum(float(left[index]) * float(right[index]) for index in range(size))
    left_norm = math.sqrt(sum(float(value) * float(value) for value in left[:size]))
    right_norm = math.sqrt(sum(float(value) * float(value) for value in right[:size]))
    if not left_norm or not right_norm:
        return 0.0

    return dot / (left_norm * right_norm)


def upsert_chunks(ids, documents, embeddings=None, metadatas=None):
    metadatas = metadatas or [{} for _ in documents]
    try:
        vector_store = get_vector_store(settings.chroma_collection_name)
        vector_store.add_texts(
            texts=documents,
            metadatas=metadatas,
            ids=ids,
        )
        return {
            "inserted": len(ids),
            "collectionName": settings.chroma_collection_name,
            "fallback": False,
        }
    except Exception as error:
        fallback_embeddings = embeddings or [embed_text(document) for document in documents]
        existing = {item.get("id"): item for item in _load_fallback_items()}
        for index, chunk_id in enumerate(ids):
            existing[chunk_id] = {
                "id": chunk_id,
                "document": documents[index],
                "embedding": fallback_embeddings[index],
                "metadata": metadatas[index],
            }
        _write_fallback_items(list(existing.values()))
        return {
            "inserted": len(ids),
            "collectionName": settings.chroma_collection_name,
            "fallback": True,
        }


def search_chunks(query: str, query_embedding=None, limit: int = 6):
    try:
        vector_store = get_vector_store(settings.chroma_collection_name)
        docs_and_scores = vector_store.similarity_search_with_relevance_scores(query, k=limit)
        return {
            "documents": [[document.page_content for document, _ in docs_and_scores]],
            "metadatas": [[document.metadata for document, _ in docs_and_scores]],
            "distances": [[1 - float(score) for _, score in docs_and_scores]],
        }
    except Exception as error:
        active_embedding = query_embedding or embed_text(query)
        scored = []
        seen_documents = set()
        for item in _load_fallback_items():
            document = item.get("document", "")
            if document in seen_documents:
                continue
            seen_documents.add(document)
            similarity = _cosine_similarity(active_embedding, item.get("embedding", []))
            scored.append((similarity, item))

        scored.sort(key=lambda entry: entry[0], reverse=True)
        top = scored[:limit]

        return {
            "documents": [[item.get("document", "") for _, item in top]],
            "metadatas": [[item.get("metadata", {}) for _, item in top]],
            "distances": [[1 - score for score, _ in top]],
        }
