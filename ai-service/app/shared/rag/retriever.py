from app.shared.chroma.client import get_retriever
from app.shared.chroma.store import search_chunks
from app.shared.embeddings.service import embed_text
from app.shared.schemas.retrieval import (
    RetrievalRequest,
    RetrievalResponse,
    RetrievalResult,
)


def retrieve_chunks(payload: RetrievalRequest) -> RetrievalResponse:
    query = (payload.query or "").strip()
    if not query:
        return RetrievalResponse(query="", results=[])

    try:
        retriever = get_retriever(k=payload.limit or 6)
        documents = retriever.invoke(query)
        if documents:
            results = [
                RetrievalResult(
                    sourceFileName=document.metadata.get(
                        "sourceFileName", "Knowledge base"
                    ),
                    chunkText=document.page_content or "",
                    score=1,
                )
                for document in documents[: payload.limit or 6]
            ]
            return RetrievalResponse(query=query, results=results)
    except Exception:
        pass

    try:
        embedding = embed_text(query)
        raw = search_chunks(query, embedding, limit=payload.limit or 6)
    except Exception as error:
        raise RuntimeError(f"Knowledge retrieval failed: {error}") from error

    documents = raw.get("documents", [[]])[0] if raw else []
    metadatas = raw.get("metadatas", [[]])[0] if raw else []
    distances = raw.get("distances", [[]])[0] if raw else []

    results = []
    for index, document in enumerate(documents):
        metadata = metadatas[index] if index < len(metadatas) else {}
        distance = distances[index] if index < len(distances) else 1

        results.append(
            RetrievalResult(
                sourceFileName=metadata.get("sourceFileName", "Knowledge base"),
                chunkText=document or "",
                score=max(0, 1 - float(distance)),
            )
        )

    return RetrievalResponse(query=query, results=results)