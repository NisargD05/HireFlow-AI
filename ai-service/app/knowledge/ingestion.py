from app.shared.document.cleaner import clean_text
from app.shared.document.pdf_extractor import extract_pdf_text
from app.shared.config.settings import settings
from app.shared.chroma.store import upsert_chunks
from app.shared.rag.chunker import chunk_text

def ingest_text(text: str, source_file_name: str):
    cleaned = clean_text(text)
    chunks = chunk_text(cleaned)
    return [
        {
            "sourceFileName": source_file_name,
            "chunkIndex": index,
            "chunkText": chunk,
        }
        for index, chunk in enumerate(chunks)
    ]


def ingest_pdf(file_path: str, document_id: str, source_file_name: str):


    extracted_text = extract_pdf_text(file_path)
    cleaned = clean_text(extracted_text)
    if not cleaned:
        raise ValueError("PDF extraction produced empty text")

    chunks = chunk_text(cleaned)

    if not chunks:
        raise ValueError("No chunks generated from PDF")

    ids = [f"{document_id}:{index}" for index in range(len(chunks))]
    metadatas = [
        {
            "documentId": document_id,
            "sourceFileName": source_file_name,
            "chunkIndex": index,
        }
        for index in range(len(chunks))
    ]

    result = upsert_chunks(ids, chunks, metadatas=metadatas)

    return {
        "documentId": document_id,
        "sourceFileName": source_file_name,
        "chunkCount": len(chunks),
        "collectionName": result.get("collectionName", settings.chroma_collection_name),
        "vectorStoreFallback": result.get("fallback", False),
        "chunks": [
            {
                "id": ids[index],
                "text": chunk,
                "chunkIndex": index,
                "metadata": metadatas[index],
            }
            for index, chunk in enumerate(chunks)
        ],
    }