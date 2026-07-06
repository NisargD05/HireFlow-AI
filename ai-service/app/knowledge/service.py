from app.shared.rag.retriever import retrieve_chunks


def retrieve_context(payload):
    return retrieve_chunks(payload)
